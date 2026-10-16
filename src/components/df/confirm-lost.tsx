"use client";

import { useEffect, useRef, useState } from "react";
import { companyById, contactById, contacts, personById, weightedForDeal } from "@/lib/df/api";
import { moneyCompact } from "@/lib/df/format";
import type { Deal } from "@/lib/df/types";

const REASONS = [
  "Went with someone else",
  "No budget this year",
  "No decision, went quiet",
  "Timing, try again later",
];

export interface LostInfo {
  reason: string;
  competitor: string;
  remind: boolean;
}

/**
 * ConfirmLost (§7 / X-04), screen-exact from LostDeal.html.
 * States the money effect first; reason is a required radio; competitor and
 * the Jan 6 check-in reminder are optional. Default focus: "Keep it open".
 */
export function ConfirmLost({
  deal,
  open,
  onClose,
  onConfirm,
}: {
  deal: Deal;
  open: boolean;
  onClose: () => void;
  onConfirm?: (deal: Deal, info: LostInfo) => void;
}) {
  const [reason, setReason] = useState(REASONS[0]!);
  const [competitor, setCompetitor] = useState("");
  const [remind, setRemind] = useState(true);
  const keepRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open) keepRef.current?.focus();
  }, [open ]);

  if (!open) return null;

  const company = companyById(deal.companyId);
  const owner = personById(deal.ownerId);
  const primaryContact = deal.detail?.people[0]
    ? contactById(deal.detail.people[0].contactId)
    : contacts.find((c) => c.companyId === deal.companyId);
  const weighted = deal.detail?.weighted ?? weightedForDeal(deal);

  function trapTab(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="scrim" style={{ padding: "0 16px", alignItems: "flex-start" }}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-lost-title"
        className="dialog"
        style={{ marginTop: 96 }}
        onKeyDown={trapTab}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm?.(deal, { reason, competitor, remind });
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span
            aria-hidden="true"
            style={{
              width: 40, height: 40, borderRadius: "var(--radius-l)", background: "#FBE7E4",
              display: "grid", placeItems: "center", flex: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#B4261A" strokeWidth="1.6" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </span>
          <h2 id="confirm-lost-title">Mark {company.name} as lost?</h2>
        </div>

        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>
          It leaves the open pipeline:{" "}
          <span className="mono" style={{ color: "var(--act)" }}>
            −{moneyCompact(deal.value)}
          </span>{" "}
          open,{" "}
          <span className="mono" style={{ color: "var(--act)" }}>
            −{moneyCompact(weighted)}
          </span>{" "}
          weighted.
          {primaryContact ? ` ${primaryContact.name} stays in Contacts.` : ""}
        </p>

        <fieldset style={{ margin: 0, padding: 0, border: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, paddingBottom: 8 }}>Why was it lost?</legend>
          {REASONS.map((r) => (
            <label key={r} className="rs">
              <input
                type="radio"
                name="lost-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                required
              />
              {r}
            </label>
          ))}
        </fieldset>

        <div className="f">
          <label htmlFor="confirm-lost-competitor">
            Who did they choose? <span className="opt">optional</span>
          </label>
          <input
            id="confirm-lost-competitor"
            className="in"
            placeholder="Competitor name"
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
          />
        </div>

        <label
          style={{
            display: "flex", gap: 10, alignItems: "center", padding: "12px 14px",
            borderRadius: "var(--radius-l)", background: "#F7F6F2", fontSize: 14, cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={remind}
            onChange={(e) => setRemind(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "var(--progress)", margin: 0 }}
          />
          Remind {owner.firstName} to check in again on Jan 6
        </label>

        <div
          style={{
            display: "flex", justifyContent: "flex-end", gap: 8,
            borderTop: "1px solid var(--rule)", marginTop: 2, paddingTop: 16,
          }}
        >
          <button type="button" className="btn" ref={keepRef} onClick={onClose}>
            Keep it open
          </button>
          <button type="submit" className="btn destructive-fill">
            Mark as lost
          </button>
        </div>
      </form>
    </div>
  );
}
