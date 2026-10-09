"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DaysInStageBadge } from "@/components/shared/days-in-stage-badge";
import type { AttentionItem } from "@/lib/actions/dashboard";
import { formatCurrency, formatLongDate, formatShortDate, formatTimeOfDay } from "@/lib/format";
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
  const isScheduled = item.kind === "scheduled-activity";

  /**
   * Artifact task-ledger time cell: "Overdue · Oct 5" / "8:45 AM" /
   * "Due October 8" / "16d stalled" — mono, red when overdue.
   */
  function timeLabel(): string {
    if (isOverdue) {
      if (!item.daysOverdue || !item.dueAt) return "Overdue";
      return `Overdue · ${formatShortDate(item.dueAt)}`;
    }
    if (isScheduled && item.dueAt) {
      const due = new Date(item.dueAt);
      const now = new Date();
      const sameDay =
        due.getFullYear() === now.getFullYear() &&
        due.getMonth() === now.getMonth() &&
        due.getDate() === now.getDate();
      return sameDay ? formatTimeOfDay(due) : `Due ${formatLongDate(due)}`;
    }
    return `${item.daysInStage ?? 0}d stalled`;
  }

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
      <time>{timeLabel()}</time>
      <div className="min-w-0">
        <b className="truncate">{item.title}</b>
        <small className="truncate">{item.context}</small>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {isOverdue ? (
            <span className="df-urgency act">
              {item.daysOverdue === 0 ? "Overdue" : `${item.daysOverdue}d overdue`}
            </span>
          ) : isScheduled ? null : (
            <DaysInStageBadge days={item.daysInStage ?? 0} />
          )}
          {(isOverdue || isScheduled) && item.activityId && (
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
          {!isOverdue && !isScheduled && item.dealId && (
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
