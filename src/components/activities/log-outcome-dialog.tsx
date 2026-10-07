"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { completeFollowUp } from "@/lib/actions/activities";

export interface LogOutcomeDialogProps {
  activityId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}

const OUTCOMES = [
  { value: "connected", label: "Connected" },
  { value: "no_answer", label: "No answer" },
  { value: "left_voicemail", label: "Left voicemail" },
  { value: "not_interested", label: "Not interested" },
  { value: "other", label: "Other" },
] as const;

type OutcomeValue = (typeof OUTCOMES)[number]["value"];

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Log the outcome of a follow-up: marks it done (append-only — the outcome
 * is recorded as a new activity) and optionally schedules the next one.
 */
export function LogOutcomeDialog({ activityId, open, onOpenChange, onDone }: LogOutcomeDialogProps) {
  const [outcome, setOutcome] = useState<OutcomeValue>("connected");
  const [note, setNote] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toDateInputValue(tomorrow);
  });
  const [saving, setSaving] = useState(false);

  // Reset the form each time the dialog opens (in the open handler, not an
  // effect — avoids setState-in-effect cascading renders).
  function handleOpenChange(next: boolean) {
    if (next) {
      setOutcome("connected");
      setNote("");
      setScheduleNext(false);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setNextDate(toDateInputValue(tomorrow));
    }
    onOpenChange(next);
  }

  async function handleSubmit() {
    if (!activityId) return;
    if (scheduleNext && !nextDate) {
      toast.error("Pick a date for the next follow-up");
      return;
    }
    setSaving(true);
    const result = await completeFollowUp({
      activityId,
      outcome,
      note: note.trim() || undefined,
      nextDueAt: scheduleNext ? new Date(`${nextDate}T09:00`).toISOString() : undefined,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(scheduleNext ? "Outcome logged, next follow-up scheduled" : "Outcome logged");
    onOpenChange(false);
    onDone?.();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log outcome</DialogTitle>
          <DialogDescription>What happened, and what comes next</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="outcome-select">Outcome</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as OutcomeValue)}>
              <SelectTrigger id="outcome-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="outcome-note">Note</Label>
            <Textarea
              id="outcome-note"
              placeholder="Anything worth remembering…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={5000}
            />
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="outcome-next" className="text-sm font-medium">
                  Schedule next follow-up
                </Label>
                <p className="text-xs text-muted-foreground">Keeps the deal warm</p>
              </div>
              <Switch id="outcome-next" checked={scheduleNext} onCheckedChange={setScheduleNext} />
            </div>
            {scheduleNext && (
              <div className="mt-3 space-y-2">
                <Label htmlFor="outcome-next-date">Due date</Label>
                <Input
                  id="outcome-next-date"
                  type="date"
                  value={nextDate}
                  min={toDateInputValue(new Date())}
                  onChange={(e) => setNextDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save outcome"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
