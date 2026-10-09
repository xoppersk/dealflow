"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { DealCard } from "@/components/pipeline/deal-card";
import { formatCompactCurrency } from "@/lib/format";
import type { DealCardData, StageColumnData } from "@/lib/types";

interface StageColumnProps {
  stage: StageColumnData;
  deals: DealCardData[];
  /** Deal ids currently pulsing from a realtime event. */
  pulsingDealIds?: ReadonlySet<string>;
}

function paddedCount(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * One kanban lane: market-tape header (stage name · deal count · column
 * total · win probability) over a flat ticket stack. The whole lane is a
 * drop target; cards are a per-lane SortableContext.
 */
export function StageColumn({ stage, deals, pulsingDealIds }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  const total = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <section
      ref={setNodeRef}
      aria-label={`${stage.name} column`}
      className={`df-lane flex w-72 shrink-0 flex-col pb-2 transition-colors md:w-80 ${
        isOver ? "is-over" : ""
      }`}
    >
      <div className="df-tape">
        <strong>{stage.name}</strong>
        <span className="tape-count">
          {paddedCount(deals.length)} {deals.length === 1 ? "deal" : "deals"}
        </span>
        <span className="tape-value">
          {formatCompactCurrency(total, deals[0]?.currency ?? "USD")}
        </span>
        <span className="tape-prob">{stage.defaultProbability}% win</span>
      </div>

      <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto px-2">
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              pulse={pulsingDealIds?.has(deal.id) ?? false}
            />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <div className="flex min-h-[96px] items-center justify-center border border-dashed border-border text-xs text-muted-foreground">
            Drag deals here
          </div>
        )}
      </div>
    </section>
  );
}
