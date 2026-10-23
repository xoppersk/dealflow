/** Dealflow Premium v2 — shared types for the data layer (HANDOVER §3, §9).
 *  In production these shapes are produced by src/lib/df/db.ts from real
 *  Supabase rows (see the ID contract in PRODUCTION-LOG.md): Deal/Company/
 *  Contact .id = DB uuid, Stage.id = stage slug, Person.id = user uuid. */

export type Urgency = "act" | "watch" | "on-track";

export interface Person {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  email: string;
  role: "Admin" | "Manager" | "Rep" | string;
  openDeals: number;
  openValue: number;
  openValueLabel: string;
  avatarBg: string;
  avatarColor: string;
  /** Honest presence: only the signed-in user is known to be online. */
  online: boolean;
  you?: boolean;
}

export interface Stage {
  id: string;
  /** DB uuid of the pipeline_stages row (Stage.id stays the slug). */
  uuid?: string;
  name: string;
  winChance: number;
  /** Design artefact: total at end of September. No DB source — the DB
   *  mapping sets 0; see PRODUCTION-LOG W3 derivations. */
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
  industry?: string;
  website?: string;
  sizeLabel?: string;
  city?: string;
  ownerId?: string;
  createdAt?: string;
}

export interface NextStep {
  text: string;
  /** Display label exactly as drawn on the screens, e.g. "Thu, Oct 8". */
  dueLabel: string;
  /** ISO date (yyyy-mm-dd) in workspace time. */
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
  /** ISO timestamp of last touch (real), when known. */
  lastTouchedAt?: string;
  createdAt?: string;
  closedAt?: string;
  presence?: string;
  stale?: boolean;
  justMoved?: JustMoved;
  closeDate?: string;
  detail?: DealDetailExtra;
  /** deal_attachments rows for this deal (metadata only). */
  attachments?: DealAttachment[];
}

export interface DealAttachment {
  id: string;
  dealId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  companyId: string;
  email: string;
  customer?: boolean;
  newLead?: boolean;
  phone?: string;
  prefers?: string;
  metThrough?: string;
  ownerId?: string;
  createdAt?: string;
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
  contactId?: string;
  overdueDays?: number;
  /** Screen tail ("Maya, 22 min" / a date) when the row carries one. */
  meta?: string;
  fromStage?: string;
  toStage?: string;
  isFollowUp?: boolean;
  completed?: boolean;
  dueAt?: string;
  /** Raw ISO instant of the activity (for period filtering/reporting). */
  occurredAt?: string;
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

export interface AuditEntry {
  id: string;
  type: string;
  subject: string;
  detail?: string;
  timeLabel: string;
  dayLabel: string;
  ownerId: string;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

/** The whole workspace dataset in v2 screen shapes — the single object
 *  server pages fetch (getDataset) and hand to client components. */
export interface Dataset {
  team: Person[];
  stages: Stage[];
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
  closed: ClosedSummary;
  settings: WorkspaceSettings;
  currentUserId: string;
  workspaceId: string;
  /** Caller's role in this workspace: "admin" | "manager" | "rep". */
  workspaceRole: string;
  audit: AuditEntry[];
  invites: PendingInvite[];
}
