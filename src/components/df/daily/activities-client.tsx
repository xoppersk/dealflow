"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { companyByIdSafe, isOpenDeal, personByIdSafe } from "@/lib/df/api";
import { completeFollowUp, logActivity } from "@/lib/df/actions";
import { dateLabel, isoDate } from "@/lib/df/format";
import type { Activity, Dataset, Person } from "@/lib/df/types";
import { DatasetProvider } from "../dataset-context";
import { OwnerAvatar, Segmented } from "../primitives";

type Filter = "all" | "calls" | "meetings" | "notes" | "tasks";
type LogType = "Call" | "Meeting" | "Note" | "Task";

const FILTER_MATCH: Record<Filter, (a: Activity) => boolean> = {
  all: () => true,
  calls: (a) => a.type === "Call",
  meetings: (a) => a.type === "Meeting" || a.type === "Meeting booked",
  notes: (a) => a.type === "Note",
  tasks: (a) => a.type === "Task",
};

function resolveDealId(ds: Dataset, param?: string): string {
  if (param) {
    const byId = ds.deals.find((d) => d.id === param);
    if (byId) return byId.id;
    const byCompany = ds.deals.find((d) => d.companyId === param);
    if (byCompany) return byCompany.id;
  }
  return ds.deals.find((d) => isOpenDeal(d))?.id ?? ds.deals[0]?.id ?? "";
}

/** Parse the drawn due text ("Wed, Oct 7", "Oct 7", "2026-10-07") to ISO. */
function parseDue(text: string): string | null {
  const trimmed = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed.replace(/^(\w{3}),\s*/, "$1 "));
  if (Number.isNaN(parsed.getTime())) return null;
  // Date.parse fills in the current year for "Oct 7" style input.
  return isoDate(parsed);
}

function fallbackPerson(id: string): Person {
  return {
    id, name: "Owner", firstName: "Owner", initials: "??", email: "", role: "Rep",
    openDeals: 0, openValue: 0, openValueLabel: "", avatarBg: "#F1EEE6", avatarColor: "#17201E", online: false,
  };
}

/**
 * D-03 Activities — Activities.html: type filters, the log form (next step
 * + date required; submitting calls the logActivity action and prepends to
 * Today), the day-grouped timeline with overdue follow-ups on act-tint
 * rows, and This week's numbers — all computed from the real dataset.
 * Honours ?deal= (prefill) and ?log= (focus the form).
 */
export function ActivitiesClient({
  dataset,
  dealParam,
  logParam,
}: {
  dataset: Dataset;
  dealParam?: string;
  logParam?: string;
}) {
  const router = useRouter();
  const deals = dataset.deals;
  const [filter, setFilter] = useState<Filter>("all");
  const [entries, setEntries] = useState<Activity[]>(dataset.activities);
  const [synced, setSynced] = useState(dataset.activities);
  if (synced !== dataset.activities) {
    setSynced(dataset.activities);
    setEntries(dataset.activities);
  }
  const [logType, setLogType] = useState<LogType>("Call");
  const [dealId, setDealId] = useState<string>(() => resolveDealId(dataset, dealParam));
  const selectedDeal = deals.find((d) => d.id === dealId);
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState(selectedDeal?.nextStep?.text ?? "");
  const [due, setDue] = useState(selectedDeal?.nextStep?.dueDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (logParam) {
      formRef.current?.scrollIntoView({ block: "start" });
      noteRef.current?.focus();
    }
  }, [logParam]);

  const overdueCount = entries.filter((a) => a.overdueDays !== undefined).length;

  const groups = useMemo(() => {
    const match = FILTER_MATCH[filter];
    const order: string[] = ["Overdue tasks", "Today", "Yesterday"];
    for (const a of entries) if (!order.includes(a.dayLabel)) order.push(a.dayLabel);
    return order
      .map((day) => ({ day, rows: entries.filter((a) => a.dayLabel === day && match(a)) }))
      .filter((g) => g.rows.length > 0);
  }, [entries, filter]);

  const week = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const inWeek = (a: Activity) => (a.occurredAt ? new Date(a.occurredAt).getTime() >= monday.getTime() : false);
    const staleCount = deals.filter(
      (d) =>
        isOpenDeal(d) &&
        d.lastTouchedAt &&
        now.getTime() - new Date(d.lastTouchedAt).getTime() > 14 * 86_400_000,
    ).length;
    return {
      label: `${dateLabel(monday)} – ${dateLabel(sunday)}`,
      calls: entries.filter((a) => a.type === "Call" && inWeek(a)).length,
      meetings: entries.filter((a) => (a.type === "Meeting" || a.type === "Meeting booked") && inWeek(a)).length,
      moved: entries.filter((a) => a.type === "Move" && inWeek(a)).length,
      stale: staleCount,
    };
  }, [entries, deals]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nextStep.trim() || !due.trim()) {
      setError("A deal can’t be saved without a next step and a date.");
      return;
    }
    const dueIso = parseDue(due);
    if (!dueIso) {
      setError("Add a due date — e.g. 2026-10-08 or Oct 8.");
      return;
    }
    const deal = deals.find((d) => d.id === dealId) ?? deals[0];
    if (!deal) {
      setError("Add a deal first — there is nothing to log against yet.");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await logActivity({
      dealId: deal.id,
      type: logType,
      body: note.trim() || undefined,
      subject: companyByIdSafe(dataset.companies, deal.companyId)?.name ?? deal.name,
      nextStepText: nextStep.trim(),
      nextStepDue: dueIso,
    });
    setSaving(false);
    if (!res.ok) {
      setError(`Couldn’t save — ${res.error}`);
      return;
    }
    const entry: Activity = {
      id: res.data?.id ?? `logged-${Date.now()}`,
      type: logType,
      subject: companyByIdSafe(dataset.companies, deal.companyId)?.name ?? deal.name,
      detail: note.trim() || undefined,
      meta: `Next step: ${nextStep.trim()} · ${dueIso}`,
      timeLabel: "Just now",
      dayLabel: "Today",
      ownerId: dataset.currentUserId,
      dealId: deal.id,
      occurredAt: new Date().toISOString(),
    };
    setEntries((list) => [entry, ...list]);
    setFilter("all");
    router.refresh();
  }

  async function markDone(a: Activity) {
    const res = await completeFollowUp(a.id);
    if (res.ok) {
      setEntries((list) => list.filter((x) => x.id !== a.id));
      router.refresh();
    }
  }

  return (
    <DatasetProvider dataset={dataset}>
      <div className="daily-layout">
        <main className="daily-main" style={{ gap: 22 }}>
          <div className="hero-row">
            <div>
              <h1 className="h1" style={{ marginTop: 0 }}>
                Activities
              </h1>
              <p className="lede">
                Every call, meeting, note and task, in one record the whole team reads.{" "}
                {overdueCount > 0 ? (
                  <b className="u-act" style={{ fontWeight: 600 }}>
                    {overdueCount} task{overdueCount === 1 ? " is" : "s are"} overdue.
                  </b>
                ) : (
                  <b style={{ fontWeight: 600 }}>Nothing is overdue.</b>
                )}
              </p>
            </div>
            <Segmented
              label="Show"
              options={[
                { value: "all", label: "All" },
                { value: "calls", label: "Calls" },
                { value: "meetings", label: "Meetings" },
                { value: "notes", label: "Notes" },
                { value: "tasks", label: "Tasks" },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>

          <form
            ref={formRef}
            className="panel"
            aria-labelledby="lg"
            style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}
            onSubmit={submit}
          >
            <h2 id="lg" style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>
              Log an activity
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Segmented
                label="Type"
                options={[
                  { value: "Call", label: "Call" },
                  { value: "Meeting", label: "Meeting" },
                  { value: "Note", label: "Note" },
                  { value: "Task", label: "Task" },
                ]}
                value={logType}
                onChange={setLogType}
              />
              <label htmlFor="dl" className="sr-only">
                Deal
              </label>
              <select
                id="dl"
                className="in"
                style={{ flex: 1, minWidth: 200, height: 36, width: "auto" }}
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
              >
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {companyByIdSafe(dataset.companies, d.companyId)?.name ?? d.name} · {d.name}
                  </option>
                ))}
              </select>
            </div>

            <label htmlFor="nt" className="sr-only">
              What happened
            </label>
            <textarea
              id="nt"
              ref={noteRef}
              className="in"
              style={{ height: 76, padding: "11px 12px", lineHeight: 1.5, resize: "vertical", width: "auto" }}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What happened"
            />

            <div className="log-next-row">
              <b className="lab-inline">
                <i aria-hidden="true" />
                Next step
              </b>
              <label htmlFor="ns" className="sr-only">
                Next step
              </label>
              <input
                id="ns"
                className="in"
                style={{ flex: 1, minWidth: 200, height: 34, width: "auto" }}
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                required
                aria-required="true"
              />
              <label htmlFor="nd" className="sr-only">
                Due
              </label>
              <input
                id="nd"
                className="in mono"
                style={{ width: 120, height: 34 }}
                value={due}
                onChange={(e) => setDue(e.target.value)}
                required
                aria-required="true"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                A deal can’t be saved without a next step and a date.
              </span>
              {error ? (
                <span className="form-error" role="alert">
                  {error}
                </span>
              ) : null}
              <button type="submit" className="btn pri" disabled={saving}>
                Log {logType.toLowerCase()}
              </button>
            </div>
          </form>

          <section className="panel timeline" aria-label="Timeline" style={{ overflow: "hidden" }}>
            {groups.map((g) => (
              <div key={g.day}>
                <div className={`day${g.day === "Overdue tasks" ? " act u-act" : ""}`}>{g.day}</div>
                {g.rows.map((a, i) => {
                  const owner = personByIdSafe(dataset.team, a.ownerId) ?? fallbackPerson(a.ownerId);
                  const overdue = a.overdueDays !== undefined;
                  const lastInGroup = i === g.rows.length - 1;
                  return (
                    <div
                      key={a.id}
                      className={`ev${overdue ? " overdue-row" : ""}`}
                      style={lastInGroup && g.day === "Overdue tasks" ? { borderRadius: "0 0 12px 12px" } : undefined}
                    >
                      <span className={`mono${overdue ? " u-act" : ""}`}>{a.timeLabel}</span>
                      <OwnerAvatar person={owner} large />
                      <span>
                        {a.type === "Move" ? (
                          <>
                            <b>{owner.firstName}</b> moved <b>{a.subject}</b> from {a.fromStage} to {a.toStage}
                            {a.detail ? <small>{a.detail}</small> : null}
                          </>
                        ) : (
                          <>
                            <b>{a.type}</b> · {a.subject}
                            {a.meta ? <> · {a.meta}</> : null}
                            {a.detail ? <small>{a.detail}</small> : null}
                            {overdue ? (
                              <small className="u-act" style={{ fontWeight: 600 }}>
                                {a.overdueDays} days overdue{" "}
                                <button type="button" className="btn sm" onClick={() => markDone(a)}>
                                  Mark done
                                </button>
                              </small>
                            ) : null}
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
            {groups.length === 0 ? (
              <p style={{ padding: "16px 20px", margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
                Nothing logged in this view yet.
              </p>
            ) : null}
          </section>
        </main>

        <aside className="side">
          <section aria-labelledby="tw" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="week-head">
              <h2 id="tw" className="lab">
                This week
              </h2>
              <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                {week.label}
              </span>
            </div>
            <div className="wk">
              <div>
                <small>Calls</small>
                <b>{week.calls}</b>
              </div>
              <div>
                <small>Meetings held</small>
                <b>{week.meetings}</b>
              </div>
              <div>
                <small>Deals moved forward</small>
                <b style={{ color: "var(--progress)" }}>{week.moved}</b>
              </div>
              <div>
                <small>Deals with no touch in 14 days</small>
                <b className="u-watch">{week.stale}</b>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </DatasetProvider>
  );
}
