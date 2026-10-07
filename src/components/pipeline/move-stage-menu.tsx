"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

import { CloseDealDialog } from "@/components/pipeline/close-deal-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { moveDeal, type MoveDealResult } from "@/lib/actions/pipeline";
import { checkStageMove } from "@/lib/domain/stage-rules";
import type { PipelineStageRow } from "@/lib/supabase/types";

/**
 * Stage shape the menu needs. Closed flags are optional so the deal-detail
 * page's minimal `{ id, name, color }` stages keep working (treated as open —
 * that page has its own mark won/lost UI).
 */
export interface MoveStageMenuStage {
  id: string;
  name: string;
  color: string;
  isClosedWon?: boolean;
  isClosedLost?: boolean;
}

export interface MoveStageMenuProps {
  dealId: string;
  dealName?: string;
  currentStageId: string;
  version: number;
  stages: MoveStageMenuStage[];
  /**
   * Called with the moveDeal result. When omitted (deal-detail page), the
   * menu toasts + refreshes itself.
   */
  onMoved?: (result: MoveDealResult) => void;
}

/** Adapter for the shared domain rule (only id/closed flags are read). */
function asRow(stage: MoveStageMenuStage): PipelineStageRow {
  return {
    id: stage.id,
    name: stage.name,
    position: 0,
    color: stage.color,
    is_closed_won: stage.isClosedWon ?? false,
    is_closed_lost: stage.isClosedLost ?? false,
    default_probability: 0,
    created_at: "",
    updated_at: "",
  };
}

/**
 * "Move stage" dropdown for the deal-detail page (also usable anywhere a
 * deal's stage needs changing outside the board). Lists open stages plus a
 * separated Close section (won/lost); closed targets open the
 * CloseDealDialog. Transition rules are enforced client-side via the shared
 * domain function before the Server Action runs.
 */
export function MoveStageMenu({
  dealId,
  dealName = "This deal",
  currentStageId,
  version,
  stages,
  onMoved,
}: MoveStageMenuProps) {
  const router = useRouter();
  const [closeStage, setCloseStage] = useState<MoveStageMenuStage | null>(null);
  const [busy, setBusy] = useState(false);

  const openStages = stages.filter((s) => !s.isClosedWon && !s.isClosedLost);
  const closeStages = stages.filter((s) => s.isClosedWon || s.isClosedLost);
  const current = stages.find((s) => s.id === currentStageId);

  async function commit(
    toStageId: string,
    closeConfirmed: boolean,
    versionOverride?: number,
  ) {
    setBusy(true);
    try {
      const result = await moveDeal({
        dealId,
        toStageId,
        version: versionOverride ?? version,
        closeConfirmed,
      });

      if (onMoved) {
        onMoved(result);
        return;
      }

      if (result.ok) {
        const name =
          stages.find((s) => s.id === toStageId)?.name ?? "the new stage";
        toast.success(`Deal moved to ${name}.`);
        router.refresh();
        return;
      }

      if (result.error === "VERSION_CONFLICT" && "data" in result) {
        const freshVersion = result.data.version;
        toast.warning(
          "This deal was just moved by a teammate — your change wasn't applied.",
          {
            action: {
              label: "Retry",
              onClick: () =>
                void commit(toStageId, closeConfirmed, freshVersion),
            },
          },
        );
        router.refresh();
        return;
      }

      if (result.error === "CLOSE_CONFIRMATION_REQUIRED") {
        const target = stages.find((s) => s.id === toStageId);
        if (target) setCloseStage(target);
        return;
      }

      toast.error(result.error);
    } finally {
      setBusy(false);
    }
  }

  function handleSelect(stage: MoveStageMenuStage) {
    if (!current || stage.id === currentStageId) return;
    const verdict = checkStageMove({
      fromStage: asRow(current),
      toStage: asRow(stage),
    });
    if (!verdict.ok) {
      toast.error(verdict.reason);
      return;
    }
    if (verdict.requiresCloseConfirmation) {
      setCloseStage(stage);
      return;
    }
    void commit(stage.id, false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy}>
            <ArrowRightLeft className="h-4 w-4" />
            Move stage
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
          {openStages.map((stage) => (
            <DropdownMenuItem
              key={stage.id}
              disabled={stage.id === currentStageId}
              onSelect={() => handleSelect(stage)}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: stage.color }}
                aria-hidden="true"
              />
              {stage.name}
              {stage.id === currentStageId && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Current
                </span>
              )}
            </DropdownMenuItem>
          ))}
          {closeStages.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Close</DropdownMenuLabel>
              {closeStages.map((stage) => (
                <DropdownMenuItem
                  key={stage.id}
                  disabled={stage.id === currentStageId}
                  onSelect={() => handleSelect(stage)}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                    aria-hidden="true"
                  />
                  {stage.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {closeStage && (
        <CloseDealDialog
          deal={{ id: dealId, name: dealName }}
          stage={{
            id: closeStage.id,
            name: closeStage.name,
            isClosedWon: closeStage.isClosedWon ?? false,
            isClosedLost: closeStage.isClosedLost ?? false,
          }}
          open
          onOpenChange={(open) => {
            if (!open) setCloseStage(null);
          }}
          onConfirm={() => {
            const target = closeStage;
            setCloseStage(null);
            void commit(target.id, true);
          }}
        />
      )}
    </>
  );
}
