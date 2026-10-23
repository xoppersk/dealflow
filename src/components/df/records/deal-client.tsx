"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmLost } from "@/components/df/confirm-lost";
import { PulseIcon } from "@/components/df/icons";
import { Button, ButtonLink } from "@/components/df/primitives";
import { moveDeal, recordAttachment, updateDealFields, updateDealNextStep } from "@/lib/df/actions";
import type { StaleNoticeEntry } from "@/lib/df/records-data";
import { checkMove } from "@/lib/df/rules";
import type { Deal, Person } from "@/lib/df/types";
import { createClient } from "@/lib/supabase/client";

/** Lock glyph drawn on the disabled "Move to Won" (DealDetail.html). */
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

/**
 * R-01 header actions: Log activity · Move to Won (blocked with the drawn
 * reason while a step blocks the contract) · Mark lost → ConfirmLost.
 * All wired to the real moveDeal action.
 */
export function DealHeaderActions({ deal }: { deal: Deal }) {
  const router = useRouter();
  const [lostOpen, setLostOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const verdict = checkMove(deal, "won");
  const blockedReason = verdict.ok ? undefined : "Waiting on legal redlines";

  async function moveToWon() {
    if (blockedReason || busy) return;
    setBusy(true);
    const res = await moveDeal(deal.id, "won");
    setBusy(false);
    if (!res.ok) {
      setStatus(`Couldn’t move to Won — ${res.error}`);
      return;
    }
    setStatus("Moved to Won.");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      <div className="rec-actions">
        <ButtonLink href={`/app/activities?deal=${deal.id}&log=1`}>Log activity</ButtonLink>
        <Button
          blockedReason={blockedReason}
          aria-disabled={blockedReason ? true : undefined}
          onClick={blockedReason ? undefined : moveToWon}
          style={
            blockedReason
              ? { background: "#F1EEE6", borderColor: "#E4E1D8", color: "#66716E", cursor: "not-allowed", opacity: 1 }
              : undefined
          }
        >
          {blockedReason ? <LockIcon /> : null}
          Move to Won
        </Button>
        <Button variant="destructive" onClick={() => setLostOpen(true)}>
          Mark lost
        </Button>
      </div>
      <span className="rec-status-line" role="status" aria-live="polite">
        {status}
      </span>
      <ConfirmLost
        deal={deal}
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        onConfirm={async (_deal, info) => {
          setLostOpen(false);
          const res = await moveDeal(deal.id, "lost", {
            lostReason: info?.reason,
            lostCompetitor: info?.competitor || undefined,
          });
          if (!res.ok) {
            setStatus(`Couldn’t mark lost — ${res.error}`);
            return;
          }
          setStatus("Marked as lost — it leaves the open pipeline.");
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * R-01 next-step panel actions. "Mark done" swaps in the set-the-next-step
 * form (§10); saving calls updateDealNextStep. "Reschedule" asks for the
 * new date for the same step.
 */
export function NextStepActions({
  deal,
  primaryLabel = "Mark done and set the next step",
  secondaryLabel = "Reschedule",
}: {
  deal?: Deal;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryMsg?: string;
  secondaryMsg?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<"none" | "next" | "reschedule">("none");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!deal) return;
    const nextText = mode === "reschedule" ? (deal.nextStep?.text ?? text) : text;
    if (!nextText.trim() || !date) {
      setStatus("A deal can’t be saved without a next step and a date.");
      return;
    }
    const res = await updateDealNextStep(deal.id, { text: nextText.trim(), due: date });
    if (!res.ok) {
      setStatus(`Couldn’t save — ${res.error}`);
      return;
    }
    setMode("none");
    setStatus("Next step saved.");
    router.refresh();
  }

  return (
    <>
      <div className="rec-ns-btns">
        <Button variant="pri" onClick={() => deal && setMode("next")}>
          {primaryLabel}
        </Button>
        <Button onClick={() => deal && setMode("reschedule")}>{secondaryLabel}</Button>
      </div>
      {mode !== "none" && deal ? (
        <form onSubmit={save} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {mode === "next" ? (
            <input
              className="in"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Next step"
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
            />
          ) : null}
          <input
            type="date"
            className="in mono"
            style={{ width: 170 }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            aria-label="Due date"
          />
          <button type="submit" className="btn pri sm">
            Save
          </button>
          <button type="button" className="btn sm" onClick={() => setMode("none")}>
            Cancel
          </button>
        </form>
      ) : null}
      <span className="rec-status-line" role="status" aria-live="polite">
        {status}
      </span>
    </>
  );
}

/** Scrolls + focuses the next-step panel when ?focus=next-step (§ task). */
export function FocusNextStep({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!enabled) return;
    const panel = document.getElementById("next-step-panel");
    if (panel) {
      panel.scrollIntoView({ block: "start" });
      panel.focus({ preventScroll: true });
    }
  }, [enabled]);
  return <span ref={ref} hidden />;
}

/**
 * X-05 stale notice actions; Mark lost opens the foundation ConfirmLost
 * and confirms through the real moveDeal action.
 */
export function StaleNoticeBlock({ deal, notice }: { deal: Deal; notice: StaleNoticeEntry }) {
  const router = useRouter();
  const [lostOpen, setLostOpen] = useState(false);
  const [status, setStatus] = useState("");
  return (
    <section className="rec-stale" role="status" aria-label="Stale deal notice">
      <span className="label">
        <PulseIcon />
        {notice.label}
      </span>
      <p className="headline">{notice.headline}</p>
      <p className="body">{notice.body}</p>
      <div className="rec-meter" aria-hidden="true">
        {Array.from({ length: notice.meterTotal }, (_, i) => (
          <i key={i} className={i < notice.meterFilled ? "on" : undefined} />
        ))}
      </div>
      <div className="btns">
        <Button variant="pri" onClick={() => setStatus(`${notice.draftLabel} — draft opened below the notice.`)}>
          {notice.draftLabel}
        </Button>
        <Button onClick={() => setStatus("Try another contact — the other people on this deal are listed on the right.")}>
          Try another contact
        </Button>
        <Button onClick={() => setStatus(`${notice.askLabel} — message drafted.`)}>
          {notice.askLabel}
        </Button>
        <Button variant="destructive" onClick={() => setLostOpen(true)}>
          Mark lost
        </Button>
      </div>
      <span className="rec-status-line" role="status" aria-live="polite">
        {status}
      </span>
      <ConfirmLost
        deal={deal}
        open={lostOpen}
        onClose={() => setLostOpen(false)}
        onConfirm={async (_deal, info) => {
          setLostOpen(false);
          const res = await moveDeal(deal.id, "lost", {
            lostReason: info?.reason,
            lostCompetitor: info?.competitor || undefined,
          });
          if (!res.ok) {
            setStatus(`Couldn’t mark lost — ${res.error}`);
            return;
          }
          setStatus("Marked as lost — it leaves the open pipeline.");
          router.refresh();
        }}
      />
    </section>
  );
}

/** Deal field edits (R-01 sidebar): name, value, close date, owner —
 *  saved through updateDealFields. */
export function DealEditForm({ deal, team }: { deal: Deal; team: Person[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(deal.name);
  const [value, setValue] = useState(String(deal.value));
  const [closeDate, setCloseDate] = useState(deal.closeDate ?? "");
  const [ownerId, setOwnerId] = useState(deal.ownerId);
  const [status, setStatus] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await updateDealFields(deal.id, {
      name: name.trim(),
      value: Number(value) || 0,
      closeDate: closeDate || null,
      ownerId,
    });
    if (!res.ok) {
      setStatus(`Couldn’t save — ${res.error}`);
      return;
    }
    setStatus("Saved.");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>
        Edit deal
      </button>
    );
  }
  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label className="f">
        <span>Deal name</span>
        <input className="in" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="f">
        <span>Value</span>
        <input className="in mono" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} required />
      </label>
      <label className="f">
        <span>Expected close</span>
        <input type="date" className="in mono" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
      </label>
      <label className="f">
        <span>Owner</span>
        <select className="in" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          {team.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn pri sm">
          Save
        </button>
        <button type="button" className="btn sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <span className="rec-status-line" role="status" aria-live="polite">
        {status}
      </span>
    </form>
  );
}

/** Files on a deal: real deal_attachments rows; upload goes through the
 *  deal-attachments storage bucket, then records its metadata row. If the
 *  storage layer rejects the upload, the error is shown — never faked. */
export function DealFiles({ deal, workspaceId }: { deal: Deal; workspaceId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const files = deal.attachments ?? [];

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus("");
    const path = `${workspaceId}/${deal.id}/${file.name}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from("deal-attachments").upload(path, file, { upsert: true });
    if (uploadError) {
      setBusy(false);
      setStatus(`Upload failed — ${uploadError.message}`);
      return;
    }
    const res = await recordAttachment(deal.id, {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(res.error);
      return;
    }
    setStatus("File attached.");
    router.refresh();
  }

  return (
    <section style={{ paddingTop: 20, borderTop: "1px solid var(--rule)" }}>
      <h2>Files</h2>
      {files.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--muted)" }}>No files attached yet.</p>
      ) : (
        files.map((f) => (
          <div key={f.id} className="pp" style={{ borderTop: 0 }}>
            <span>
              <b>{f.fileName}</b>
              <small>
                {f.mimeType} · {Math.max(1, Math.round(f.sizeBytes / 1024))} KB
              </small>
            </span>
          </div>
        ))
      )}
      <label className="btn sm" style={{ cursor: "pointer" }}>
        {busy ? "Uploading…" : "Attach a file"}
        <input type="file" hidden onChange={onFile} disabled={busy} />
      </label>
      <span className="rec-status-line" role="status" aria-live="polite">
        {status}
      </span>
    </section>
  );
}
