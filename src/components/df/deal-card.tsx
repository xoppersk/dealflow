import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";
import { companyById, personById, stageById } from "@/lib/df/api";
import { moneyCompact, deltaVsSep } from "@/lib/df/format";
import type { Deal, Stage } from "@/lib/df/types";
import { AgeMeter, Monogram, OwnerAvatar } from "./primitives";

/** Drag wiring supplied by the board's @dnd-kit useDraggable (Daily group). */
export interface CardDrag {
  ref: (el: HTMLElement | null) => void;
  style?: CSSProperties;
  listeners?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  isDragging?: boolean;
}

export function dealHref(deal: Deal): string {
  return `/app/deals/${deal.companyId}`;
}

/**
 * DealCard (§7). Board cards are links: Enter opens the deal (§11); a plain
 * click selects it when the board passes onSelect (the selected-deal panel is
 * the point of D-02). M / L / N are handled by the board's keydown delegation.
 */
export function DealCard({
  deal,
  selected = false,
  onSelect,
  drag,
  onPlanNextStep,
}: {
  deal: Deal;
  selected?: boolean;
  onSelect?: (deal: Deal) => void;
  drag?: CardDrag;
  onPlanNextStep?: (deal: Deal) => void;
}) {
  const company = companyById(deal.companyId);
  const owner = personById(deal.ownerId);
  const step = deal.nextStep;

  const stateClass = selected
    ? " selected"
    : deal.justMoved
      ? " moved"
      : !step
        ? " act"
        : deal.stale
          ? " watch"
          : "";

  function handleClick(e: MouseEvent) {
    if (onSelect && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault();
      onSelect(deal);
    }
  }

  return (
    <Link
      href={dealHref(deal)}
      className={`card${stateClass}`}
      aria-current={selected ? "true" : undefined}
      data-deal-id={deal.id}
      onClick={onSelect ? handleClick : undefined}
      ref={drag ? (drag.ref as (el: HTMLAnchorElement | null) => void) : undefined}
      style={drag?.style}
      {...(drag?.listeners ?? {})}
      {...(drag?.attributes ?? {})}
    >
      {deal.justMoved ? (
        <span className="moved-flag">Just moved by {personById(deal.justMoved.byId).firstName}</span>
      ) : null}
      <span className="co">
        <Monogram initials={company.initials} bg={company.mgBg} color={company.mgColor} />
        <span className="n">
          <b>{company.name}</b>
          <small>{deal.name}</small>
        </span>
        <span className="val">{moneyCompact(deal.value)}</span>
      </span>

      {step ? (
        <span className={`nx${step.urgency === "act" ? " act" : step.urgency === "watch" ? " watch" : ""}`}>
          <em>
            <i />
            {step.dueLabel}
          </em>
          {step.text}
        </span>
      ) : (
        <span className="nx act">
          <em>
            <i />
            No next step
          </em>
          Last touch was {deal.lastTouchLabel}
          <span
            className="plan-link"
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              if (onPlanNextStep) {
                e.preventDefault();
                e.stopPropagation();
                onPlanNextStep(deal);
              }
            }}
          >
            Plan the next step
          </span>
        </span>
      )}

      <span className="ft">
        {deal.presence ? (
          <span className="presence-line">
            <span className="presence-dot" />
            {deal.presence}
          </span>
        ) : deal.justMoved ? (
          <span>{deal.enteredStageLabel}</span>
        ) : (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AgeMeter days={deal.daysInStage} amber={deal.stale} />
            <span className={deal.stale ? "u-watch" : undefined} style={deal.stale ? { fontWeight: 600 } : undefined}>
              {deal.enteredStageLabel}
            </span>
          </span>
        )}
        <OwnerAvatar person={owner} />
      </span>
    </Link>
  );
}

/** StageHeader (§7) — name, total, "N deals · W% win", change vs last period. */
export function StageHeader({
  stage,
  deals,
  failed = false,
  headingId,
}: {
  stage: Stage;
  deals: Deal[];
  failed?: boolean;
  headingId?: string;
}) {
  const total = deals.reduce((s, d) => s + d.value, 0);
  const delta = deltaVsSep(total, stage.valueSep);
  return (
    <div className={`ch${failed ? " failed" : ""}`}>
      <div className="t">
        <b id={headingId}>{stage.name}</b>
        <span>{failed ? "—" : moneyCompact(total)}</span>
      </div>
      <div className="s">
        <span>
          {deals.length} deals · {stage.winChance}% win
        </span>
        {failed ? (
          <span className="u-act">Couldn’t load</span>
        ) : (
          <span className={delta.up ? undefined : "u-watch"} style={delta.up ? { color: "var(--progress)" } : undefined}>
            {delta.label}
          </span>
        )}
      </div>
    </div>
  );
}

export function stageName(id: string): string {
  return stageById(id).name;
}
