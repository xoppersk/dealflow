/**
 * Event bus (HANDOVER §10 "Realtime").
 *
 * A tiny in-process bus: board moves and announcements publish here and the
 * app shell's aria-live region subscribes. There is no seeded/fixture
 * event in production — events only ever come from real user actions in
 * this session; a future realtime transport only has to republish them.
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
