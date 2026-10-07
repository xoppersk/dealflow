"use client";

/**
 * Timeline — chronological activity feed + stage-history entries.
 * Stage changes render as distinct "system" items (muted pill, history
 * icon); everything else renders as an activity card with type icon,
 * actor avatar, subject/body, and relative time.
 */

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatDate, relativeTime } from "@/lib/format";
import type { TimelineEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeIcon } from "./type-icon";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "call", label: "Calls" },
  { value: "email", label: "Emails" },
  { value: "meeting", label: "Meetings" },
  { value: "note", label: "Notes" },
  { value: "stage-change", label: "Stage changes" },
] as const;

function kindLabel(kind: TimelineEntry["kind"]): string {
  switch (kind) {
    case "call":
      return "Call";
    case "email":
      return "Email";
    case "meeting":
      return "Meeting";
    case "note":
      return "Note";
    case "stage-change":
      return "Stage change";
    case "system":
      return "System";
  }
}

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const [filter, setFilter] = useState<string>("all");

  const visible = entries.filter((e) => filter === "all" || e.kind === filter);

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Log the first call to start this timeline."
        illustration="activity"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === f.value
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nothing in this category yet.</p>
      ) : (
        <ol className="flex flex-col">
          {visible.map((entry) => {
            const isSystem = entry.kind === "stage-change" || entry.kind === "system";

            if (isSystem) {
              return (
                <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                  <span
                    className="absolute top-6 left-[15px] h-[calc(100%-1.5rem)] w-px bg-border last:hidden"
                    aria-hidden
                  />
                  <span
                    className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    aria-hidden
                  >
                    <TypeIcon type={entry.kind} />
                  </span>
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/60 px-4 py-2">
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {entry.subject ?? kindLabel(entry.kind)}
                    </span>
                    <span
                      className="ml-auto shrink-0 text-xs text-muted-foreground/70"
                      title={formatDate(entry.occurredAt)}
                    >
                      {relativeTime(entry.occurredAt)}
                    </span>
                  </div>
                </li>
              );
            }

            return (
              <li key={entry.id} className="relative flex gap-3 pb-6 last:pb-0">
                <span
                  className="absolute top-8 left-[15px] h-[calc(100%-2rem)] w-px bg-border last:hidden"
                  aria-hidden
                />
                <span
                  className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
                  aria-hidden
                >
                  <TypeIcon type={entry.kind} />
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="shrink-0">
                      {kindLabel(entry.kind)}
                    </Badge>
                    {entry.subject && <span className="truncate font-medium">{entry.subject}</span>}
                    <span
                      className="ml-auto shrink-0 text-xs text-muted-foreground"
                      title={formatDate(entry.occurredAt)}
                    >
                      {relativeTime(entry.occurredAt)}
                    </span>
                  </div>
                  {entry.body && (
                    <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{entry.body}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserAvatar userId="" name={entry.actorName} avatarUrl={entry.actorAvatarUrl} size="sm" />
                    <span>{entry.actorName}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
