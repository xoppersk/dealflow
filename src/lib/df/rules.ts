/**
 * Move rules for the v2 board (HANDOVER §10), over real deal facts.
 * The salvaged v1 domain modules (src/lib/domain/) keep their own DB-shaped
 * rules + tests; this module expresses the same product rules over the v2
 * screen types:
 *
 * - Moving to Won is blocked while a next step "blocks the contract".
 * - Moving to Lost always requires the ConfirmLost dialog.
 * - Entering a stage checks its entry requirements (M-03 list) against
 *   REAL deal facts (DF-04 wired — see missingRequirements).
 */
import type { Activity, Contact, Deal, Stage } from "./types";

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

export interface RequirementContext {
  /** Contacts in the workspace (a deal's people also live in deal.detail). */
  contacts?: Contact[];
  /** Activities in the workspace (for the "first meeting" fact). */
  activities?: Activity[];
}

function isDeciderRole(role: string | undefined): boolean {
  if (!role) return false;
  return /decid|decision|approv|signs|signer/i.test(role);
}

/**
 * Entry requirements of a stage that a deal does not yet satisfy (M-03),
 * DF-04 WIRED to real deal facts:
 *
 * - "Company, owner" → missing when the deal has no company or no owner.
 * - "A contact …" → missing when no contact is linked to the deal
 *   (deal_contacts) and none exists at the deal's company; "… and a first
 *   meeting" additionally needs a Meeting activity on the deal.
 * - "Value and expected close date" → missing when value ≤ 0 or no
 *   closeDate is set.
 * - "Decision maker named" → missing when no linked deal_contact has a
 *   decider role (role text indicating decider/approver/signer).
 * - "Signed date and final value" (Won) → missing when value ≤ 0 or no
 *   closeDate (the close date is the signed/target date the data carries).
 * - "A reason from the list" (Lost) → served by the ConfirmLost dialog,
 *   which checkMove routes to first; never reported missing here.
 * - Any other label has no corresponding deal fact: per the task rule
 *   ("where a fact can't be known, don't block") it does not block, EXCEPT
 *   the standing §10 save gate — a deal with no dated next step is missing
 *   every otherwise-uncheckable requirement, and the caller asks inline
 *   for exactly the next step + date that clears it.
 */
export function missingRequirements(
  deal: Deal,
  stage: Stage,
  ctx: RequirementContext = {},
): string[] {
  const missing: string[] = [];
  const linkedPeople = deal.detail?.people ?? [];
  const companyContacts = (ctx.contacts ?? []).filter((c) => c.companyId === deal.companyId);
  const hasContact = linkedPeople.length > 0 || companyContacts.length > 0;
  const hasMeeting = (ctx.activities ?? []).some(
    (a) => a.dealId === deal.id && /^meeting/i.test(a.type),
  );
  const hasDatedNextStep = Boolean(deal.nextStep && deal.nextStep.dueDate);

  for (const raw of stage.requires) {
    const label = raw.trim();
    const lower = label.toLowerCase();
    if (/reason from the list/.test(lower)) {
      continue; // ConfirmLost dialog serves it.
    } else if (/company/.test(lower) && /owner/.test(lower)) {
      if (!deal.companyId || !deal.ownerId) missing.push(label);
    } else if (/decision/.test(lower)) {
      const named =
        linkedPeople.some((p) => isDeciderRole(p.role)) ||
        companyContacts.some((c) => isDeciderRole(c.title));
      if (!named) missing.push(label);
    } else if (/value/.test(lower) && /close/.test(lower)) {
      if (!(deal.value > 0) || !deal.closeDate) missing.push(label);
    } else if (/signed/.test(lower)) {
      if (!(deal.value > 0) || !deal.closeDate) missing.push(label);
    } else if (/contact/.test(lower) && /meeting/.test(lower)) {
      if (!hasContact || !hasMeeting) missing.push(label);
    } else if (/contact/.test(lower)) {
      if (!hasContact) missing.push(label);
    } else if (/meeting/.test(lower)) {
      if (!hasMeeting) missing.push(label);
    } else if (!hasDatedNextStep) {
      // Uncheckable label → §10 fallback gate only.
      missing.push(label);
    }
  }
  return missing;
}
