"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getActivityCounts,
  listActivities,
  type ActivityCounts,
  type ActivityListItem,
} from "@/lib/actions/activities";
import { cn } from "@/lib/utils";
import { ActivityCard } from "./activity-card";
import { ActivityComposer } from "./activity-composer";
import { FilterBar, type ActivityFilters } from "./filter-bar";
import { LogOutcomeDialog } from "./log-outcome-dialog";

type View = "overdue" | "upcoming" | "all";

export interface ActivitiesViewProps {
  initialView: View;
  initialItems: ActivityListItem[];
  initialCursor: string | null;
  counts: ActivityCounts;
  team: { id: string; name: string }[];
  openComposer?: boolean;
  /** Ids the sync engine has queued offline — rendered with a "Queued" badge. */
  queuedIds?: string[];
}

const VIEW_TABS: { value: View; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
];

function groupLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/**
 * Client container for /activities: segmented Overdue/Upcoming/All queue,
 * filters, keyset "load more", and the log-outcome / reschedule actions.
 */
export function ActivitiesView({
  initialView,
  initialItems,
  initialCursor,
  counts: initialCounts,
  team,
  openComposer = false,
  queuedIds,
}: ActivitiesViewProps) {
  const [view, setView] = useState<View>(initialView);
  const [filters, setFilters] = useState<ActivityFilters>({ type: "all", ownerId: "all", q: "" });
  const [items, setItems] = useState<ActivityListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [counts, setCounts] = useState<ActivityCounts>(initialCounts);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(openComposer);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(
    async (nextCursor: string | null, append: boolean) => {
      const result = await listActivities({
        view,
        type: filters.type === "all" ? undefined : filters.type,
        ownerId: filters.ownerId === "all" ? undefined : filters.ownerId,
        q: filters.q.trim() || undefined,
        cursor: nextCursor ?? undefined,
      });
      if (result.ok) {
        setItems((prev) => (append ? [...prev, ...result.data.items] : result.data.items));
        setCursor(result.data.nextCursor);
      }
    },
    [view, filters],
  );

  // Refetch when the view or filters change (debounce the search box).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      await fetchPage(null, false);
      setLoading(false);
    }, filters.q ? 300 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [view, filters, fetchPage]);

  async function handleLoadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    await fetchPage(cursor, true);
    setLoadingMore(false);
  }

  async function refreshAfterMutation() {
    await fetchPage(null, false);
    const countsResult = await getActivityCounts();
    if (countsResult.ok) setCounts(countsResult.data);
  }

  const grouped = useMemo(() => {
    if (view !== "upcoming") return null;
    const groups = new Map<string, ActivityListItem[]>();
    for (const item of items) {
      const label = groupLabel(new Date(item.dueAt ?? item.occurredAt));
      const list = groups.get(label) ?? [];
      list.push(item);
      groups.set(label, list);
    }
    return [...groups.entries()];
  }, [items, view]);

  return (
    <div className="space-y-4">
      {/* Segmented control with counts */}
      <div
        role="tablist"
        aria-label="Activity views"
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1"
      >
        {VIEW_TABS.map((tab) => {
          const count = counts[tab.value];
          const active = view === tab.value;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setView(tab.value)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <Badge
                variant={tab.value === "overdue" && count > 0 ? "destructive" : "secondary"}
                className="tabular-nums"
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      <FilterBar filters={filters} onChange={setFilters} team={team} />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyQueue view={view} />
      ) : view === "upcoming" && grouped ? (
        <div className="space-y-6">
          {grouped.map(([label, groupItems]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </h2>
              <div className="space-y-3">
                {groupItems.map((item) => (
                  <ActivityCard
                    key={item.id}
                    item={item}
                    queued={queuedIds?.includes(item.id)}
                    onLogOutcome={setOutcomeFor}
                    onChanged={refreshAfterMutation}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ActivityCard
              key={item.id}
              item={item}
              queued={queuedIds?.includes(item.id)}
              onLogOutcome={setOutcomeFor}
              onChanged={refreshAfterMutation}
            />
          ))}
        </div>
      )}

      {cursor && !loading && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}

      <LogOutcomeDialog
        activityId={outcomeFor}
        open={outcomeFor !== null}
        onOpenChange={(open) => {
          if (!open) setOutcomeFor(null);
        }}
        onDone={refreshAfterMutation}
      />

      {showComposer && (
        <ActivityComposer
          defaultOpen
          onSaved={() => {
            setShowComposer(false);
            refreshAfterMutation();
          }}
        />
      )}
    </div>
  );
}

function EmptyQueue({ view }: { view: View }) {
  if (view === "overdue") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">You&apos;re all caught up</h2>
        <p className="max-w-sm text-sm text-muted-foreground">Nothing is overdue. Nice work.</p>
      </div>
    );
  }
  if (view === "upcoming") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="text-lg font-semibold">Nothing scheduled</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          No upcoming follow-ups. Log an activity and schedule the next touch.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">No activities yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Log one from any deal or contact — calls, emails, meetings, and notes all land here.
      </p>
    </div>
  );
}
