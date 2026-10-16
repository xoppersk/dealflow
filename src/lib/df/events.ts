/**
 * Mock event stream (HANDOVER §10 "Realtime").
 *
 * Stands in for the realtime channel: presence, moves and edits are events on
 * a tiny in-process bus. The board seeds the stream with the one event the
 * canvas draws (Maya moved Solace Energy to Proposal, 2 min ago) and every
 * local move/undo announces through the same bus, so a future realtime
 * transport only has to republish these events.
 */

export type DealflowEvent =
  | {
      kind: "deal-moved";
      dealId: string;
      dealName: string;
      companyName: string;
      fromStageId: string;
      toStageId: string;
      toStageName: string;
      byId: string;
      byName: string;
      agoLabel: string;
      /** True when two people moved the same card at the same time (§10). */
      conflict?: boolean;
    }
  | { kind: "announce"; message: string };

type Listener = (event: DealflowEvent) => void;

const listeners = new Set<Listener>();

export function subscribeEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitEvent(event: DealflowEvent): void {
  listeners.forEach((l) => l(event));
}

/** The seeded live line from the canvas (D-02): Maya's move, 2 min ago. */
export const seedMoveEvent: DealflowEvent = {
  kind: "deal-moved",
  dealId: "solace-energy-field-team-package",
  dealName: "Field team package",
  companyName: "Solace Energy",
  fromStageId: "discovery",
  toStageId: "proposal",
  toStageName: "Proposal",
  byId: "maya-jordan",
  byName: "Maya",
  agoLabel: "2 min ago",
};
