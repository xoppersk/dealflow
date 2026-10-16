import type { ReactNode } from "react";
import type { Deal } from "@/lib/df/types";
import { Button } from "./primitives";

/** Next-step box as drawn in the D-02 selected-deal panel (aside variant). */
export function NextStepBox({
  eyebrow,
  due,
  tone,
  text,
  children,
}: {
  eyebrow: string;
  due: string;
  tone?: "watch" | "default";
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="next-box">
      <div className={`head${tone === "watch" ? " u-watch" : ""}`}>
        <span>{eyebrow}</span>
        <span>{due}</span>
      </div>
      <p>{text}</p>
      {children ? <div className="row">{children}</div> : null}
    </div>
  );
}

/**
 * NextStep panel (§7, detail pages): 2px --progress panel, urgency on the
 * right, the 18px step sentence, why it matters and what it blocks, then
 * "Mark done and set the next step" / "Reschedule".
 */
export function NextStepPanel({
  deal,
  why,
  onMarkDone,
  onReschedule,
}: {
  deal: Deal;
  why?: string;
  onMarkDone?: () => void;
  onReschedule?: () => void;
}) {
  const step = deal.nextStep;
  if (!step) return null;
  return (
    <section
      aria-label="Next step"
      style={{
        border: "2px solid var(--progress)",
        borderRadius: "var(--radius-l)",
        padding: "18px 20px",
        background: "var(--card)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <span className="lab" style={{ color: "var(--progress-deep)" }}>
          Next step
        </span>
        <span className={`urgency u-${step.urgency}`}>{step.dueLabel}</span>
      </div>
      <p style={{ margin: 0, fontSize: 18, lineHeight: 1.4, fontWeight: 500 }}>{step.text}</p>
      {why ? <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)" }}>{why}</p> : null}
      {step.blocks ? (
        <p style={{ margin: 0, fontSize: 13.5 }} className="u-watch">
          This step blocks the contract — the deal can’t move to Won until it’s done.
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
        <Button variant="pri" onClick={onMarkDone}>
          Mark done and set the next step
        </Button>
        <Button onClick={onReschedule}>Reschedule</Button>
      </div>
    </section>
  );
}
