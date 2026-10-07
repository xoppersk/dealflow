/**
 * Shared application types and contracts.
 *
 * Every Server Action returns `ActionResult<T>` — `{ ok: true, data }` on
 * success, `{ ok: false, error }` on failure — so clients handle errors
 * uniformly. Search results share one shape between the ⌘K palette and the
 * topbar search.
 */

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type SearchKind = "deal" | "contact" | "company";

export interface SearchResultItem {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
}

/** Deal row joined with the display fields the kanban board needs. */
export interface DealCardData {
  id: string;
  name: string;
  value: number;
  currency: string;
  stageId: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  companyName: string | null;
  probability: number | null;
  stageDefaultProbability: number;
  closeDate: string | null;
  version: number;
  /** ISO timestamp of when the deal entered its current stage. */
  stageEnteredAt: string;
  lastTouchedAt: string;
  boardPosition: number;
}

export interface StageColumnData {
  id: string;
  name: string;
  position: number;
  color: string;
  isClosedWon: boolean;
  isClosedLost: boolean;
  defaultProbability: number;
}

export type ActivityKind = "call" | "email" | "meeting" | "note";

export interface TimelineEntry {
  id: string;
  kind: ActivityKind | "stage-change" | "system";
  subject: string | null;
  body: string | null;
  occurredAt: string;
  actorName: string;
  actorAvatarUrl: string | null;
  dealId: string | null;
  contactId: string | null;
}
