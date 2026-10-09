"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DaysInStageBadge } from "@/components/shared/days-in-stage-badge";
import type { AttentionItem } from "@/lib/actions/dashboard";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ActivityComposer } from "@/components/activities/activity-composer";
import { LogOutcomeDialog } from "@/components/activities/log-outcome-dialog";

/**
 * One row of the Today "Due next steps" ledger: an overdue follow-up or a
 * stalled deal. Task-ledger anatomy — time cell, title/context, mono money —
 * with the inline quick actions (Log outcome / Log activity / View) pinned
 * under the context. Overdue rows carry the red time cell.
 */
export function AttentionRow({ item }: { item: AttentionItem }) {
  const router = useRouter();
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const isOverdue = item.kind === "overdue-activity";

  const detailHref = item.dealId
    ? `/deals/${item.dealId}`
    : item.contactId
      ? `/contacts/${item.contactId}`
      : null;

  function refresh() {
    router.refresh();
  }

  return (
    <article className={cn("df-task", isOverdue && "is-overdue")}>
      <time>
        {isOverdue
          ? item.daysOverdue === 0
            ? "Overdue"
            : `Overdue · ${item.daysOverdue}d`
          : `${item.daysInStage ?? 0}d stalled`}
      </time>
      <div className="min-w-0">
        <b className="truncate">{item.title}</b>
        <small className="truncate">{item.context}</small>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {isOverdue ? (
            <span className="df-urgency act">
              {item.daysOverdue === 0 ? "Overdue" : `${item.daysOverdue}d overdue`}
            </span>
          ) : (
            <DaysInStageBadge days={item.daysInStage ?? 0} />
          )}
          {isOverdue && item.activityId && (
            <>
              <Button size="sm" variant="outline" onClick={() => setOutcomeOpen(true)}>
                Log outcome
              </Button>
              <LogOutcomeDialog
                activityId={item.activityId}
                open={outcomeOpen}
                onOpenChange={setOutcomeOpen}
                onDone={refresh}
              />
            </>
          )}
          {!isOverdue && item.dealId && (
            <ActivityComposer
              dealId={item.dealId}
              trigger={
                <Button size="sm" variant="outline">
                  Log activity
                </Button>
              }
              onSaved={refresh}
            />
          )}
          {detailHref && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={detailHref}>View</Link>
            </Button>
          )}
        </div>
      </div>
      <span className="df-money text-sm">
        {item.dealValue != null
          ? formatCurrency(item.dealValue, item.dealCurrency ?? "USD")
          : ""}
      </span>
    </article>
  );
}
