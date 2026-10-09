"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { daysInStage, formatCompactCurrency, initials } from "@/lib/format";
import type { DealCardData } from "@/lib/types";

interface DealCardProps {
  deal: DealCardData;
  /** Subtle pulse when a realtime event lands on this card. */
  pulse?: boolean;
  /** Rendered inside the DragOverlay while dragging (not sortable). */
  overlay?: boolean;
}

/**
 * Deal ticket (approved anatomy): company · deal name · compact mono value ·
 * "Nd in stage" mono age · owner avatar. Sharp 2px corners, no shadow —
 * a ledger ticket, not a card.
 */
function CardBody({ deal }: { deal: DealCardData }) {
  return (
    <>
      <strong>{deal.companyName ?? deal.name}</strong>
      {deal.companyName && <div className="deal-name">{deal.name}</div>}
      <span className="deal-money">
        {formatCompactCurrency(deal.value, deal.currency)}
      </span>
      {deal.nextStepTitle && deal.nextStepDue && (
        <p className="hero-next">
          {deal.nextStepTitle} · {deal.nextStepDue}
        </p>
      )}
      <div className="deal-meta">
        <span className="deal-age">
          {daysInStage(deal.stageEnteredAt)}d in stage
        </span>
        <span className="card-avatar" title={deal.ownerName}>
          {initials(deal.ownerName)}
        </span>
      </div>
    </>
  );
}

function DealCardOverlay({ deal }: { deal: DealCardData }) {
  return (
    <article className="df-deal drag-lift cursor-grabbing">
      <CardBody deal={deal} />
    </article>
  );
}

function SortableDealCard({
  deal,
  pulse = false,
}: {
  deal: DealCardData;
  pulse?: boolean;
}) {
  const router = useRouter();
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    data: { deal, stageId: deal.stageId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        downPos.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        // A real drag moves the pointer — don't navigate after one.
        const start = downPos.current;
        if (
          start &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8
        ) {
          return;
        }
        router.push(`/deals/${deal.id}`);
      }}
      className={`df-deal cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      } ${pulse ? "remote-pulse" : ""}`}
      aria-label={`${deal.name}, ${formatCompactCurrency(deal.value, deal.currency)}`}
    >
      <CardBody deal={deal} />
    </article>
  );
}

/**
 * Kanban deal ticket. Draggable via dnd-kit sortable; click navigates to
 * the deal.
 */
export function DealCard({ deal, pulse = false, overlay = false }: DealCardProps) {
  if (overlay) return <DealCardOverlay deal={deal} />;
  return <SortableDealCard deal={deal} pulse={pulse} />;
}
