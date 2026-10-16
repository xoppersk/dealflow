"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { activities as fixtureActivities, companyById, deals, personById } from "@/lib/df/api";
import type { Activity } from "@/lib/df/types";
import { OwnerAvatar, Segmented } from "../primitives";

/** activities.json carries two screen-only fields beyond the shared type:
 *  `meta` (the "· Maya, 22 min" / date tail on a row) and the move's
 *  from/to stage names for the Solace move row. */
type ExtActivity = Activity & { meta?: string; fromStage?: string; toStage?: string };

const ALL_ACTIVITIES = fixtureActivities as ExtActivity[];

type Filter = "all" | "calls" | "meetings" | "notes" | "tasks";
type LogType = "Call" | "Meeting" | "Note" | "Task";

const FILTER_MATCH: Record<Filter, (a: ExtActivity) => boolean> = {
  all: () => true,
  calls: (a) => a.type === "Call",
  meetings: (a) => a.type === "Meeting" || a.type === "Meeting booked",
  notes: (a) => a.type === "Note",
  tasks: (a) => a.type === "Task",
};

const DAY_ORDER = ["Today", "Yesterday", "Overdue tasks"];

function resolveDealId(param?: string): string {
  if (param) {
    const byId = deals.find((d) => d.id === param);
    if (byId) return byId.id;
    const byCompany = deals.find((d) => d.companyId === param);
    if (byCompany) return byCompany.id;
  }
  return "vesper-studio-agency-partnership";
}

/**
 * D-03 Activities — Activities.html: type filters, the log form (next step +
 * date required; submitting prepends to Today), the day-grouped timeline
 * with the 2 overdue tasks on act-tint rows, and This week's numbers.
 * Honours ?deal= (prefill) and ?log= (focus the form).
 */
export function ActivitiesClient({ dealParam, logParam }: { dealParam?: string; logParam?: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [entries, setEntries] = useState<ExtActivity[]>(ALL_ACTIVITIES);
  const [logType, setLogType] = useState<LogType>("Call");
  const [dealId, setDealId] = useState<string>(() => resolveDealId(dealParam));
  const [note, setNote] = useState("Lena is fine with the 12-month term. Wants the onboarding fee split across two invoices.");
  const [nextStep, setNextStep] = useState("Send revised terms with split fee");
  const [due, setDue] = useState("Wed, Oct 7");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (logParam) {
      formRef.current?.scrollIntoView({ block: "start" });
      noteRef.current?.focus();
    }
  }, [logParam]);

  const groups = useMemo(() => {
    const match = FILTER_MATCH[filter];
    return DAY_ORDER.map((day) => ({
      day,
      rows: entries.filter((a) => a.dayLabel === day && match(a)),
    })).filter((g) => g.rows.length > 0);
  }, [entries, filter]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nextStep.trim() || !due.trim()) {
      setError("A deal can’t be saved without a next step and a date.");
      return;
    }
    setError(null);
    const deal = deals.find((d) => d.id === dealId) ?? deals[0]!;
    const company = companyById(deal.companyId);
    const entry: ExtActivity = {
      id: `logged-${Date.now()}`,
      type: logType,
      subject: company.name,
      detail: note.trim() || undefined,
      meta: `Next step: ${nextStep.trim()} · ${due.trim()}`,
      timeLabel: "Just now",
      dayLabel: "Today",
      ownerId: "sheku-koroma",
      dealId: deal.id,
    };
    setEntries((list) => [entry, ...list]);
    setFilter("all");
  }

  return (
    <div className="daily-layout">
      <main className="daily-main" style={{ gap: 22 }}>
        <div className="hero-row">
          <div>
            <h1 className="h1" style={{ marginTop: 0 }}>
              Activities
            </h1>
            <p className="lede">
              Every call, meeting, note and task, in one record the whole team reads.{" "}
              <b className="u-act" style={{ fontWeight: 600 }}>
                2 tasks are overdue.
              </b>
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
                  {companyById(d.companyId).name} · {d.name}
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
            <button type="submit" className="btn pri">
              Log {logType.toLowerCase()}
            </button>
          </div>
        </form>

        <section className="panel timeline" aria-label="Timeline" style={{ overflow: "hidden" }}>
          {groups.map((g) => (
            <div key={g.day}>
              <div className={`day${g.day === "Overdue tasks" ? " act u-act" : ""}`}>{g.day}</div>
              {g.rows.map((a, i) => {
                const owner = personById(a.ownerId);
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
                          {a.detail ? (
                            <small>
                              {a.detail.replace("+ $8K", "").replace("+$8K", "").trimEnd()}{" "}
                              <span style={{ color: "var(--progress)", fontWeight: 600 }}>+$8K</span>
                            </small>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <b>{a.type}</b> · {a.subject}
                          {a.meta && !a.id.startsWith("logged-") ? <> · {a.meta}</> : null}
                          {a.id.startsWith("logged-") ? (
                            <>
                              {a.detail ? <small>{a.detail}</small> : null}
                              {a.meta ? (
                                <small style={{ color: "var(--progress-deep)", fontWeight: 500 }}>{a.meta}</small>
                              ) : null}
                            </>
                          ) : a.detail ? (
                            <small>{a.detail}</small>
                          ) : null}
                          {overdue ? (
                            <small className="u-act" style={{ fontWeight: 600 }}>
                              {a.overdueDays} days overdue
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
              Oct 5 – 11
            </span>
          </div>
          <div className="wk">
            <div>
              <small>Calls</small>
              <b>14</b>
            </div>
            <div>
              <small>Meetings held</small>
              <b>6</b>
            </div>
            <div>
              <small>Deals moved forward</small>
              <b style={{ color: "var(--progress)" }}>1</b>
            </div>
            <div>
              <small>Deals with no touch in 14 days</small>
              <b className="u-watch">1</b>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
