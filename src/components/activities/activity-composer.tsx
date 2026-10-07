"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { logActivity } from "@/lib/actions/activities";
import { cn } from "@/lib/utils";
import type { ActivityKind } from "@/lib/types";
import { TypeIcon } from "./type-icon";

export interface ActivityComposerProps {
  dealId?: string;
  contactId?: string;
  trigger?: ReactNode;
  onSaved?: () => void;
  defaultType?: ActivityKind;
  /** Open immediately on mount (used for ?create=1 deep links). */
  defaultOpen?: boolean;
}

const TYPES: { value: ActivityKind; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

/** "2026-10-06T19:42" for <input type="datetime-local">. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tomorrowInputValue(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateInputValue(tomorrow);
}

/**
 * Log-activity composer. Dialog on desktop, bottom sheet on mobile.
 * Used inline on deal/contact pages and from the topbar ＋ New menu.
 */
export function ActivityComposer({
  dealId,
  contactId,
  trigger,
  onSaved,
  defaultType = "call",
  defaultOpen = false,
}: ActivityComposerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [type, setType] = useState<ActivityKind>(defaultType);
  const [occurredAt, setOccurredAt] = useState(() => toLocalInputValue(new Date()));
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [dueDate, setDueDate] = useState(() => tomorrowInputValue());
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();

  // Reset the form each time the composer opens (in the open handler, not an
  // effect — avoids setState-in-effect cascading renders).
  function handleOpenChange(next: boolean) {
    if (next) {
      setType(defaultType);
      setOccurredAt(toLocalInputValue(new Date()));
      setSubject("");
      setBody("");
      setScheduleFollowUp(false);
      setDueDate(tomorrowInputValue());
    }
    setOpen(next);
  }

  async function handleSubmit() {
    if (!dealId && !contactId) {
      toast.error("Link this activity to a deal or a contact first");
      return;
    }
    if (scheduleFollowUp && !dueDate) {
      toast.error("Pick a date for the follow-up");
      return;
    }
    setSaving(true);
    const result = await logActivity({
      type,
      dealId,
      contactId,
      occurredAt: new Date(occurredAt).toISOString(),
      subject: subject.trim() || undefined,
      body: body.trim() || undefined,
      followUp: scheduleFollowUp ? { dueAt: new Date(`${dueDate}T09:00`).toISOString() } : undefined,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(scheduleFollowUp ? "Activity logged, follow-up scheduled" : "Activity logged");
    setOpen(false);
    onSaved?.();
  }

  const form = (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Type</Label>
        <div className="grid grid-cols-4 gap-2">
          {TYPES.map((t) => {
            const selected = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <TypeIcon type={t.value} className="h-5 w-5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity-when">Date and time</Label>
        <Input
          id="activity-when"
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity-subject">Subject</Label>
        <Input
          id="activity-subject"
          placeholder="Discovery call with Maya"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity-body">Notes</Label>
        <Textarea
          id="activity-body"
          placeholder="What was discussed, next steps…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={5000}
        />
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="activity-followup" className="text-sm font-medium">
              Schedule follow-up
            </Label>
            <p className="text-xs text-muted-foreground">Adds it to your activity queue</p>
          </div>
          <Switch id="activity-followup" checked={scheduleFollowUp} onCheckedChange={setScheduleFollowUp} />
        </div>
        {scheduleFollowUp && (
          <div className="mt-3 space-y-2">
            <Label htmlFor="activity-due">Due date</Label>
            <Input
              id="activity-due"
              type="date"
              value={dueDate}
              min={toDateInputValue(new Date())}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );

  const defaultTrigger = (
    <Button size="sm">
      <Plus className="h-4 w-4" aria-hidden />
      Log activity
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{trigger ?? defaultTrigger}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-xl">
          <SheetHeader className="text-left">
            <SheetTitle>Log activity</SheetTitle>
            <SheetDescription>Record what happened and what comes next</SheetDescription>
          </SheetHeader>
          <div className="py-4">{form}</div>
          <div className="flex flex-col gap-2 pb-2">
            <Button onClick={handleSubmit} disabled={saving} className="w-full">
              {saving ? "Saving…" : "Save activity"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving} className="w-full">
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
          <DialogDescription>Record what happened and what comes next</DialogDescription>
        </DialogHeader>
        <div className="py-2">{form}</div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save activity"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
