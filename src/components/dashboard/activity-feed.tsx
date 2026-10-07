"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { relativeTime } from "@/lib/format";
import { useActivitiesChannel, type ActivityInsertPayload } from "@/lib/realtime/channels";
import type { ActivityKind, TimelineEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeIcon } from "@/components/activities/type-icon";

const MAX_ITEMS = 20;
const FLASH_MS = 700;

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
      return "Update";
  }
}

/**
 * Latest team activities with live prepend via the activities realtime
 * channel. New rows flash briefly per the motion spec.
 */
export function ActivityFeed({
  initial,
  currentUserId,
  currentUserName,
}: {
  initial: TimelineEntry[];
  currentUserId: string;
  currentUserName: string;
}) {
  const [entries, setEntries] = useState<TimelineEntry[]>(initial.slice(0, MAX_ITEMS));
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
    };
  }, []);

  const handleInsert = useCallback(
    (payload: ActivityInsertPayload) => {
      const row = payload.new as Record<string, unknown> | null;
      if (!row || typeof row.id !== "string") return;
      const ownerId = typeof row.owner_id === "string" ? row.owner_id : "";
      const entry: TimelineEntry = {
        id: row.id,
        kind: (typeof row.type === "string" ? row.type : "note") as ActivityKind,
        subject: typeof row.subject === "string" ? row.subject : null,
        body: typeof row.body === "string" ? row.body : null,
        occurredAt: typeof row.occurred_at === "string" ? row.occurred_at : new Date().toISOString(),
        actorName: ownerId === currentUserId ? currentUserName : "A teammate",
        actorAvatarUrl: null,
        dealId: typeof row.deal_id === "string" ? row.deal_id : null,
        contactId: typeof row.contact_id === "string" ? row.contact_id : null,
      };

      setEntries((prev) => {
        if (prev.some((e) => e.id === entry.id)) return prev;
        return [entry, ...prev].slice(0, MAX_ITEMS);
      });
      setFreshIds((prev) => new Set(prev).add(entry.id));
      const existing = timers.current.get(entry.id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        entry.id,
        setTimeout(() => {
          setFreshIds((prev) => {
            const next = new Set(prev);
            next.delete(entry.id);
            return next;
          });
          timers.current.delete(entry.id);
        }, FLASH_MS),
      );
    },
    [currentUserId, currentUserName],
  );

  useActivitiesChannel(handleInsert);

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No team activity yet. Log the first call to get things moving.
      </p>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-border">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={cn(
            "flex items-start gap-3 py-3 transition-colors duration-700",
            freshIds.has(entry.id) && "bg-primary/5",
          )}
        >
          <UserAvatar userId="" name={entry.actorName} avatarUrl={entry.actorAvatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">{entry.actorName}</span>{" "}
              <span className="text-muted-foreground">
                {kindLabel(entry.kind).toLowerCase()}d
              </span>{" "}
              {entry.subject && <span className="font-medium">“{entry.subject}”</span>}
            </p>
            {entry.body && (
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{entry.body}</p>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <TypeIcon type={entry.kind} className="h-3.5 w-3.5" />
            {relativeTime(entry.occurredAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}
