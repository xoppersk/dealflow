"use client";

import { useState } from "react";
import { CalendarClock, Check } from "lucide-react";
import { toast } from "sonner";

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

function dueLabel(dueAt: string | null): { text: string; overdue: boolean } {
  if (!dueAt) return { text: "No due date", overdue: false };
  const now = new Date();
  const due = new Date(dueAt);
  if (due.getTime() < now.getTime()) {
    const days = Math.max(0, wholeDaysBetween(dueAt, now.toISOString()));
    return { text: days === 0 ? "Overdue" : `Overdue · ${days}d`, overdue: true };
  }
  return { text: `Due ${formatShortDate(dueAt)}`, overdue: false };
}

/**
 * Activity queue row — ledger anatomy: time cell, title/context, urgency
 * badge; quick actions (Log outcome, Reschedule, Mark done) under the
 * context. Overdue rows carry the red time cell.
 */
export function ActivityCard({ item, queued = false, onLogOutcome, onChanged }: ActivityCardProps) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [newDue, setNewDue] = useState(() => toDateInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [busy, setBusy] = useState(false);

  const due = dueLabel(item.dueAt);
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
    <article className={cn("df-task", due.overdue && "is-overdue")}>
      <time title={item.dueAt ? formatDate(item.dueAt) : undefined}>{due.text}</time>
      <div className="min-w-0">
        <b className="truncate">{title}</b>
        <small className="truncate">
          {item.dealName ?? item.contactName ?? typeLabel(item.type)}
          {" · "}
          <span className="tnum">{relativeTime(item.occurredAt)}</span>
        </small>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={cn("df-urgency", due.overdue ? "act" : "track")}>
            <TypeIcon type={item.type} className="h-3.5 w-3.5" aria-hidden />
            {typeLabel(item.type)}
          </span>
          {queued && (
            <span className="df-urgency watch">Queued</span>
          )}
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
      <span className="flex items-center gap-1.5">
        <UserAvatar userId={item.ownerId} name={item.ownerName} avatarUrl={item.ownerAvatarUrl} size="xs" />
      </span>
    </article>
  );
}
