/**
 * Move rules for the v2 board (HANDOVER §10), layered on the fixture types.
 * The salvaged v1 domain modules (src/lib/domain/) keep their own DB-shaped
 * rules + tests; this module expresses the same product rules over fixtures:
 *
 * - Moving to Won is blocked while a next step "blocks the contract".
 * - Moving to Lost always requires the ConfirmLost dialog.
 * - Entering a stage checks its entry requirements (M-03 list); anything
 *   missing is asked for inline by the caller.
 */
import { stageById } from "./api";
import type { Deal } from "./types";

export type MoveVerdict =
  | { ok: true; needsLostConfirm?: boolean }
  | { ok: false; reason: string };

export function checkMove(deal: Deal, toStageId: string): MoveVerdict {
  if (deal.stageId === toStageId) {
    return { ok: false, reason: "That deal is already in this stage." };
  }
  if (toStageId === "won" && deal.nextStep?.blocks) {
    return {
      ok: false,
      reason:
        "Waiting on legal redlines — a next step blocks the contract, so this deal can't move to Won yet.",
    };
  }
  if (toStageId === "lost") {
    return { ok: true, needsLostConfirm: true };
  }
  return { ok: true };
}

/**
 * Entry requirements of a stage that a deal does not yet satisfy (M-03).
 *
 * Modelling (Sev's DF-04 ruling): requirement satisfaction derives from deal
 * facts the fixtures already carry — the §10 save rule (a deal can't be saved
 * without a next step and a date) is the stage-entry gate. A deal carrying a
 * dated next step satisfies entry to any stage; a deal without one is missing
 * the target stage's drawn requirement, and the caller asks for it inline
 * (the ask collects exactly the next step + date that clears the gate).
 *
 * The drawn labels are not each checked against a literal fact — several
 * have no corresponding deal fact anywhere in the fixtures, so as literal
 * checks they stay dormant (listed in FIX-LOG.md): "A contact and a first
 * meeting" (no meeting fact), "Decision maker named" (no per-deal fact
 * outside Bracken's detail.people), "Signed date and final value" (no
 * signed-date fact), "Value and expected close date" (closeDate exists on
 * one deal only; the §10 gate is the next-step rule, not the close date) and
 * "Company, owner" (companyId/ownerId are present on every fixture deal, so
 * it can never be missing). Lost's label ("A reason from the list") is
 * served by the ConfirmLost dialog, which checkMove routes to before this
 * function is consulted.
 */
export function missingRequirements(deal: Deal, toStageId: string): string[] {
  const stage = stageById(toStageId);
  const hasDatedNextStep = Boolean(deal.nextStep && deal.nextStep.dueDate);
  return hasDatedNextStep ? [] : [...stage.requires];
}
