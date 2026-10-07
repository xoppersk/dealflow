"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Check } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/shared/user-avatar";
import { completeFollowUp, rescheduleFollowUp, type ActivityListItem } from "@/lib/actions/activities";
import { formatDate, formatShortDate, relativeTime } from "@/lib/format";
import { wholeDaysBetween } from "@/lib/domain/stale-deals";
import { cn } from "@/lib/utils";
import { TypeIcon } from "./type-icon";

export interface ActivityCardProps {
  item: ActivityListItem;
  /** Rendered when the sync engine has this item queued (offline). */
  queued?: boolean;
  onLogOutcome: (activityId: string) => void;
  onChanged: () => void;
}

function typeLabel(type: ActivityListItem["type"]): string {
  switch (type) {
    case "call":
      return "Call";
    case "email":
      return "Email";
    case "meeting":
      return "Meeting";
    case "note":
      return "Note";
  }
}

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dueBadge(dueAt: string | null): { text: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const now = new Date();
  const due = new Date(dueAt);
  if (due.getTime() < now.getTime()) {
    const days = Math.max(0, wholeDaysBetween(dueAt, now.toISOString()));
    return { text: days === 0 ? "Overdue" : `${days}d overdue`, overdue: true };
  }
  return { text: relativeTime(dueAt), overdue: false };
}

export function ActivityCard({ item, queued = false, onLogOutcome, onChanged }: ActivityCardProps) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDue, setNewDue] = useState(() => toDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [busy, setBusy] = useState(false);

  const badge = dueBadge(item.dueAt);
  const title = item.subject || (item.isFollowUp ? `Follow up — ${typeLabel(item.type)}` : typeLabel(item.type));

  async function handleMarkDone() {
    setBusy(true);
    const result = await completeFollowUp({ activityId: item.id, outcome: "other" });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Marked done");
    onChanged();
  }

  async function handleReschedule() {
    if (!newDue) {
      toast.error("Pick a new date");
      return;
    }
    setBusy(true);
    const result = await rescheduleFollowUp({
      activityId: item.id,
      dueAt: new Date(`${newDue}T09:00`).toISOString(),
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Follow-up rescheduled");
    setRescheduleOpen(false);
    onChanged();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            badge?.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          <TypeIcon type={item.type} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            {badge && (
              <Badge variant={badge.overdue ? "destructive" : "secondary"} className="shrink-0">
                {badge.text}
              </Badge>
            )}
            {queued && (
              <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-600">
                Queued
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.dealId && (
              <Link href={`/deals/${item.dealId}`} className="font-medium text-primary hover:underline">
                {item.dealName ?? "Deal"}
              </Link>
            )}
            {item.contactId && (
              <Link href={`/contacts/${item.contactId}`} className="hover:underline">
                {item.contactName ?? "Contact"}
              </Link>
            )}
            <span className="inline-flex items-center gap-1">
              <UserAvatar userId={item.ownerId} name={item.ownerName} avatarUrl={item.ownerAvatarUrl} size="sm" />
              {item.ownerName}
            </span>
            <span title={formatDate(item.occurredAt)}>{relativeTime(item.occurredAt)}</span>
            {item.dueAt && !badge?.overdue && (
              <span title={formatDate(item.dueAt)}>Due {formatShortDate(item.dueAt)}</span>
            )}
          </div>
          {item.body && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button size="sm" variant="outline" onClick={() => onLogOutcome(item.id)} disabled={busy}>
          <Check className="h-4 w-4" aria-hidden />
          Log outcome
        </Button>
        <Popover open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" disabled={busy}>
              <CalendarClock className="h-4 w-4" aria-hidden />
              Reschedule
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-3">
              <Label htmlFor={`reschedule-${item.id}`}>New due date</Label>
              <Input
                id={`reschedule-${item.id}`}
                type="date"
                value={newDue}
                min={toDateInputValue(new Date())}
                onChange={(e) => setNewDue(e.target.value)}
              />
              <Button size="sm" className="w-full" onClick={handleReschedule} disabled={busy}>
                {busy ? "Saving…" : "Save new date"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Button size="sm" variant="ghost" onClick={handleMarkDone} disabled={busy}>
          Mark done
        </Button>
      </div>
    </div>
  );
}
