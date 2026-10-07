import type { PipelineStageRow, UserRole } from "@/lib/supabase/types";

/**
 * Stage transition rules (TECHNICAL-REQUIREMENTS.md §2, PRD acceptance criteria).
 *
 * These rules live in a shared, unit-tested domain module and are enforced in
 * the `moveDeal` Server Action, with a database trigger as defense in depth:
 *
 * - Deals move freely between OPEN stages (forward and backward — sales
 *   processes regress legitimately).
 * - Moving OUT of a closed stage by drag is rejected; reopening requires the
 *   explicit `reopenDeal` action (manager/admin only) with a recorded reason.
 * - Moving INTO a closed stage requires the won/lost confirmation flag; the
 *   trigger sets `closed_at` and snapshots the final value.
 */

export type StageMoveVerdict =
  | { ok: true; requiresCloseConfirmation: boolean }
  | { ok: false; reason: string };

export function checkStageMove(args: {
  fromStage: PipelineStageRow;
  toStage: PipelineStageRow;
  /** Set when the user already confirmed the won/lost dialog. */
  closeConfirmed?: boolean;
}): StageMoveVerdict {
  const { fromStage, toStage, closeConfirmed = false } = args;

  if (fromStage.id === toStage.id) {
    return { ok: false, reason: "Deal is already in this stage." };
  }

  const leavingClosed = fromStage.is_closed_won || fromStage.is_closed_lost;
  if (leavingClosed) {
    return {
      ok: false,
      reason:
        "Closed deals can't be moved by drag — use Reopen (manager or admin only).",
    };
  }

  const enteringClosed = toStage.is_closed_won || toStage.is_closed_lost;
  if (enteringClosed && !closeConfirmed) {
    return { ok: true, requiresCloseConfirmation: true };
  }

  return { ok: true, requiresCloseConfirmation: false };
}

export type ReopenVerdict = { ok: true } | { ok: false; reason: string };

export function checkReopen(args: {
  stage: PipelineStageRow;
  actorRole: UserRole;
  reason: string;
}): ReopenVerdict {
  const { stage, actorRole, reason } = args;
  const isClosed = stage.is_closed_won || stage.is_closed_lost;
  if (!isClosed) {
    return { ok: false, reason: "Only closed deals can be reopened." };
  }
  if (actorRole !== "manager" && actorRole !== "admin") {
    return { ok: false, reason: "Only managers and admins can reopen closed deals." };
  }
  if (!reason.trim()) {
    return { ok: false, reason: "A reason is required to reopen a deal." };
  }
  return { ok: true };
}

/** Sort stages by position; closed stages sink to the end of the board. */
export function sortStagesForBoard(stages: PipelineStageRow[]): PipelineStageRow[] {
  return [...stages].sort((a, b) => {
    const aClosed = a.is_closed_won || a.is_closed_lost ? 1 : 0;
    const bClosed = b.is_closed_won || b.is_closed_lost ? 1 : 0;
    if (aClosed !== bClosed) return aClosed - bClosed;
    return a.position - b.position;
  });
}

/** The stage a deal lands in when created (first open stage by position). */
export function defaultStageForNewDeal(stages: PipelineStageRow[]): PipelineStageRow | null {
  const open = stages.filter((s) => !s.is_closed_won && !s.is_closed_lost);
  if (open.length === 0) return null;
  return open.reduce((a, b) => (a.position <= b.position ? a : b));
}
