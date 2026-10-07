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

/**
 * One kanban column: header (color dot, name, count, column total) + card
 * stack + empty placeholder. The whole column is a drop target; cards are a
 * per-column SortableContext.
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
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-shadow ${
        isOver ? "drop-glow" : ""
      }`}
    >
      <header className="flex items-center gap-2 px-3 pt-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: stage.color }}
          aria-hidden="true"
        />
        <h2 className="truncate text-sm font-semibold">{stage.name}</h2>
        <span className="tnum text-xs text-muted-foreground">
          {deals.length}
        </span>
        <span className="tnum ml-auto text-xs font-medium text-muted-foreground">
          {formatCompactCurrency(total)}
        </span>
      </header>

      <div className="flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2">
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
          <div className="flex min-h-[96px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
            Drag deals here
          </div>
        )}
      </div>
    </section>
  );
}
