"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { DaysInStageBadge } from "@/components/shared/days-in-stage-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { daysInStage, formatCompactCurrency } from "@/lib/format";
import type { DealCardData } from "@/lib/types";

interface DealCardProps {
  deal: DealCardData;
  /** Subtle pulse when a realtime event lands on this card. */
  pulse?: boolean;
  /** Rendered inside the DragOverlay while dragging (not sortable). */
  overlay?: boolean;
}

const CARD_CLASSES =
  "block w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md";

function CardBody({ deal }: { deal: DealCardData }) {
  return (
    <>
      <h3 className="text-sm font-medium leading-snug">{deal.name}</h3>
      {deal.companyName && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {deal.companyName}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="tnum text-sm font-semibold">
          {formatCompactCurrency(deal.value, deal.currency)}
        </span>
        <UserAvatar
          userId={deal.ownerId}
          name={deal.ownerName}
          avatarUrl={deal.ownerAvatarUrl}
          size="sm"
        />
      </div>
      <div className="mt-2">
        <DaysInStageBadge days={daysInStage(deal.stageEnteredAt)} />
      </div>
    </>
  );
}

function DealCardOverlay({ deal }: { deal: DealCardData }) {
  return (
    <article className={`${CARD_CLASSES} drag-lift cursor-grabbing`}>
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
      className={`${CARD_CLASSES} cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      } ${pulse ? "remote-pulse" : ""}`}
      aria-label={`${deal.name}, ${formatCompactCurrency(deal.value, deal.currency)}`}
    >
      <CardBody deal={deal} />
    </article>
  );
}

/**
 * Kanban card: name, company, compact value, owner avatar, days-in-stage
 * badge. Draggable via dnd-kit sortable; click navigates to the deal.
 */
export function DealCard({ deal, pulse = false, overlay = false }: DealCardProps) {
  if (overlay) return <DealCardOverlay deal={deal} />;
  return <SortableDealCard deal={deal} pulse={pulse} />;
}
