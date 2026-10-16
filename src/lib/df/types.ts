/** Dealflow Premium v2 — shared types for the fixture data layer (HANDOVER §3, §9). */

export type Urgency = "act" | "watch" | "on-track";

export interface Person {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  email: string;
  role: "Admin" | "Rep" | string;
  openDeals: number;
  openValue: number;
  openValueLabel: string;
  avatarBg: string;
  avatarColor: string;
  online: boolean;
  you?: boolean;
}

export interface Stage {
  id: string;
  name: string;
  winChance: number;
  valueSep: number;
  staleLimitDays: number;
  /** Requirement labels a deal must satisfy to enter the stage (M-03). */
  requires: string[];
}

export interface Company {
  id: string;
  name: string;
  initials: string;
  mgBg: string;
  mgColor: string;
  customer?: boolean;
}

export interface NextStep {
  text: string;
  /** Display label exactly as drawn on the screens, e.g. "Thu, Oct 8". */
  dueLabel: string;
  /** ISO date (yyyy-mm-dd) in workspace time, Oct 2026. */
  dueDate: string;
  urgency: Urgency;
  blocks?: boolean;
  stale?: boolean;
}

export interface JustMoved {
  byId: string;
  fromStageId: string;
  toStageId: string;
  agoLabel: string;
}

export interface DealDetailExtra {
  composition: { label: string; value: number }[];
  source: string;
  weighted: number;
  stageHistory: { stageId: string; dateLabel: string }[];
  people: { contactId: string; role: string }[];
}

export interface Deal {
  id: string;
  companyId: string;
  name: string;
  value: number;
  stageId: string;
  daysInStage: number;
  /** Footer label on the card, e.g. "3 days" / "In Proposal 2 min". */
  enteredStageLabel: string;
  ownerId: string;
  nextStep: NextStep | null;
  lastTouchLabel?: string;
  presence?: string;
  stale?: boolean;
  justMoved?: JustMoved;
  closeDate?: string;
  detail?: DealDetailExtra;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  companyId: string;
  email: string;
  customer?: boolean;
  newLead?: boolean;
}

export interface Activity {
  id: string;
  type: string;
  subject: string;
  detail?: string;
  timeLabel: string;
  dayLabel: string;
  ownerId: string;
  dealId?: string;
  overdueDays?: number;
}

export interface ClosedSummary {
  won: number;
  lost: number;
  winRate: number;
  daysToClose: number[];
  averageDaysToClose: number;
}

export interface WorkspaceSettings {
  workspaceName: string;
  workspaceScope: string;
  staleLimitDays: number;
  staleLimitPendingDays: number;
  pendingInviteEmail: string;
}
