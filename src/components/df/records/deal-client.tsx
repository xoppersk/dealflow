"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmLost } from "@/components/df/confirm-lost";
import { PulseIcon } from "@/components/df/icons";
import { Button, ButtonLink } from "@/components/df/primitives";
import type { StaleNoticeEntry } from "@/lib/df/records-data";
import { checkMove } from "@/lib/df/rules";
import type { Deal } from "@/lib/df/types";

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
 */
export function DealHeaderActions({ deal }: { deal: Deal }) {
  const [lostOpen, setLostOpen] = useState(false);
  const [status, setStatus] = useState("");
  const verdict = checkMove(deal, "won");
  const blockedReason = verdict.ok ? undefined : "Waiting on legal redlines";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
      <div className="rec-actions">
        <ButtonLink href="/app/activities">Log activity</ButtonLink>
        <Button
          blockedReason={blockedReason}
          aria-disabled={blockedReason ? true : undefined}
          style={
            blockedReason
              ? { background: "#F1EEE6", borderColor: "#E4E1D8", color: "#66716E", cursor: "not-allowed", opacity: 1 }
              : undefined
          }
        >
          <LockIcon />
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
        onConfirm={() => {
          setLostOpen(false);
          setStatus("Marked as lost — it leaves the open pipeline. (Fixture demo: nothing was saved.)");
        }}
      />
    </div>
  );
}

/**
 * R-01 next-step panel actions (screen-exact warm panel lives in the page;
 * this client island owns the buttons + the ?focus=next-step behaviour).
 * "Mark done" swaps in the set-the-next-step prompt, per §10.
 */
export function NextStepActions({
  primaryLabel = "Mark done and set the next step",
  secondaryLabel = "Reschedule",
  primaryMsg = "Done. Now set the next step — a deal can’t be saved without one and a date.",
  secondaryMsg = "Reschedule — pick a new date for this step.",
}: {
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryMsg?: string;
  secondaryMsg?: string;
}) {
  const [status, setStatus] = useState("");
  return (
    <>
      <div className="rec-ns-btns">
        <Button variant="pri" onClick={() => setStatus(primaryMsg)}>
          {primaryLabel}
        </Button>
        <Button onClick={() => setStatus(secondaryMsg)}>{secondaryLabel}</Button>
      </div>
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
 * X-05 stale notice actions: the drawn actions announce through an inline
 * status line; Mark lost opens the foundation ConfirmLost.
 */
export function StaleNoticeBlock({ deal, notice }: { deal: Deal; notice: StaleNoticeEntry }) {
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
        <Button variant="pri" onClick={() => setStatus(`${notice.draftLabel} — draft opened below the notice. (Fixture demo: nothing was sent.)`)}>
          {notice.draftLabel}
        </Button>
        <Button onClick={() => setStatus("Try another contact — the other people on this deal are listed on the right.")}>
          Try another contact
        </Button>
        <Button onClick={() => setStatus(`${notice.askLabel} — message drafted. (Fixture demo: nothing was sent.)`)}>
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
        onConfirm={() => {
          setLostOpen(false);
          setStatus("Marked as lost — it leaves the open pipeline. (Fixture demo: nothing was saved.)");
        }}
      />
    </section>
  );
}
