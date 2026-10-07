"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveDeal, type PipelineDatabase } from "@/lib/actions/pipeline";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/format";

const LOST_REASONS = [
  "Price",
  "Timing",
  "Lost to competitor",
  "No response",
  "Other",
] as const;

interface PrimaryDeal {
  id: string;
  name: string;
  value?: number;
  currency?: string;
}

interface PrimaryStage {
  id: string;
  name: string;
  isClosedWon: boolean;
  isClosedLost: boolean;
}

export type CloseDealDialogProps =
  | {
      /** Primary contract: pipeline board + MoveStageMenu. */
      deal: PrimaryDeal;
      stage: PrimaryStage;
      open: boolean;
      onOpenChange: (open: boolean) => void;
      /** Won passes undefined; lost passes the required reason. */
      onConfirm: (reason?: string) => void;
    }
  | {
      /**
       * Deal-detail ⋯ menu contract (kept working): the dialog resolves the
       * closed-won / closed-lost stage and performs the close itself.
       */
      dealId: string;
      dealName: string;
      mode: "won" | "lost";
      open: boolean;
      onOpenChange: (open: boolean) => void;
      onClosed?: () => void;
    };

function isLegacy(
  props: CloseDealDialogProps,
): props is Extract<CloseDealDialogProps, { mode: "won" | "lost" }> {
  return "mode" in props;
}

/**
 * Won/lost confirmation before a deal enters a closed stage. Closing as lost
 * requires picking a reason (Price/Timing/Lost to competitor/No
 * response/Other).
 */
export function CloseDealDialog(props: CloseDealDialogProps) {
  const legacy = isLegacy(props);
  const won = legacy ? props.mode === "won" : props.stage.isClosedWon;
  const dealName = legacy ? props.dealName : props.deal.name;
  const dealValue =
    !legacy && props.deal.value != null ? props.deal.value : null;
  const dealCurrency = !legacy ? (props.deal.currency ?? "USD") : "USD";

  const router = useRouter();
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);

  function dismiss() {
    setReason("");
    props.onOpenChange(false);
  }

  async function handleConfirm() {
    if (!won && !reason) return;

    if (!legacy) {
      props.onConfirm(won ? undefined : reason);
      setReason("");
      return;
    }

    // Legacy path: resolve the closed stage + a fresh version, then close.
    setBusy(true);
    try {
      // Same Relationships inference gap as the server actions (see pipeline.ts).
      const supabase = createClient() as unknown as SupabaseClient<PipelineDatabase>;
      const [stagesRes, dealRes] = await Promise.all([
        supabase
          .from("pipeline_stages")
          .select("id, is_closed_won, is_closed_lost"),
        supabase
          .from("deals")
          .select("id, version")
          .eq("id", props.dealId)
          .maybeSingle(),
      ]);
      const target = (stagesRes.data ?? []).find((s) =>
        won ? s.is_closed_won : s.is_closed_lost,
      );
      if (!target || !dealRes.data) {
        toast.error("Couldn't close the deal — please try again.");
        return;
      }
      const result = await moveDeal({
        dealId: props.dealId,
        toStageId: target.id,
        version: dealRes.data.version,
        closeConfirmed: true,
      });
      if (!result.ok) {
        if (result.error === "VERSION_CONFLICT" && "data" in result) {
          toast.warning(
            "This deal was just moved by a teammate — your change wasn't applied.",
            { description: "Please try again." },
          );
        } else {
          toast.error(result.error);
        }
        return;
      }
      toast.success(`Deal marked as ${props.mode}.`);
      props.onClosed?.();
      dismiss();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{won ? "Mark as won?" : "Mark as lost?"}</DialogTitle>
          <DialogDescription>
            {won ? (
              <>
                <span className="font-medium text-foreground">{dealName}</span>{" "}
                will be closed as won
                {dealValue != null ? (
                  <>
                    {" "}
                    at{" "}
                    <span className="tnum font-medium text-foreground">
                      {formatCurrency(dealValue, dealCurrency)}
                    </span>
                  </>
                ) : null}
                .
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{dealName}</span>{" "}
                will be closed as lost. A reason is required so the team can
                learn from it.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!won && (
          <div className="grid gap-1.5">
            <Label htmlFor="close-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="close-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={dismiss} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={won ? "default" : "destructive"}
            onClick={handleConfirm}
            disabled={busy || (!won && !reason)}
          >
            {won ? "Mark as won" : "Mark as lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
