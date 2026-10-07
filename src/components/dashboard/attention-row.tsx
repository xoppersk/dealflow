"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DaysInStageBadge } from "@/components/shared/days-in-stage-badge";
import type { AttentionItem } from "@/lib/actions/dashboard";
import { cn } from "@/lib/utils";
import { ActivityComposer } from "@/components/activities/activity-composer";
import { LogOutcomeDialog } from "@/components/activities/log-outcome-dialog";

/**
 * One row of the dashboard "Needs attention" list: an overdue follow-up or
 * a stalled deal, with inline quick actions (Log outcome / Log activity)
 * and a link through to the record.
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
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          isOverdue ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600",
        )}
        aria-hidden
      >
        {isOverdue ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="truncate text-xs text-muted-foreground">{item.context}</p>
      </div>

      {isOverdue ? (
        <Badge variant="destructive" className="shrink-0 tabular-nums">
          {item.daysOverdue === 0 ? "Overdue" : `${item.daysOverdue}d overdue`}
        </Badge>
      ) : (
        <DaysInStageBadge days={item.daysInStage ?? 0} />
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        {isOverdue && item.activityId ? (
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
        ) : (
          item.dealId && (
            <ActivityComposer
              dealId={item.dealId}
              trigger={
                <Button size="sm" variant="outline">
                  Log activity
                </Button>
              }
              onSaved={refresh}
            />
          )
        )}
        {detailHref && (
          <Button size="sm" variant="ghost" asChild>
            <Link href={detailHref}>View</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
