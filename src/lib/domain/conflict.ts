/**
 * Optimistic-concurrency conflict handling for kanban drags
 * (TECHNICAL-REQUIREMENTS.md §6, APP-FLOW.md Flow F).
 *
 * Every `deals` row carries a `version` counter. `moveDeal` accepts the
 * client's known version; on mismatch the server rejects (409 semantics)
 * with the fresh row. The client patches its cache to the server state and
 * shows an explanatory toast with Retry — no update is silently lost and
 * both boards converge.
 */

export interface Versioned {
  version: number;
}

export type ConflictResolution =
  | { kind: "applied"; newVersion: number }
  | { kind: "stale"; serverVersion: number };

/**
 * Decide whether a client's move applies against the server's current row.
 * Pure function so both the Server Action and unit tests share the logic.
 */
export function resolveMoveConflict(clientVersion: number, serverVersion: number): ConflictResolution {
  if (clientVersion === serverVersion) {
    return { kind: "applied", newVersion: serverVersion + 1 };
  }
  return { kind: "stale", serverVersion };
}

/** Human message for the reconciliation toast shown to the losing client. */
export function conflictToastMessage(args: {
  moverName: string;
  dealName: string;
  stageName: string;
}): string {
  const { moverName, dealName, stageName } = args;
  return `${moverName} moved ${dealName} to ${stageName} while you were dragging — your move wasn't applied.`;
}

/**
 * Merge a realtime UPDATE payload into local state: the server row always
 * wins (it is newer by definition — version only moves forward).
 */
export function mergeServerRow<T extends Versioned>(local: T, server: T): T {
  return server.version >= local.version ? server : local;
}
