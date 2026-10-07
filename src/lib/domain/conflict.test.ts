import { describe, expect, it } from "vitest";

import { conflictToastMessage, mergeServerRow, resolveMoveConflict } from "./conflict";

describe("resolveMoveConflict", () => {
  it("applies the move when the client version matches the server", () => {
    expect(resolveMoveConflict(7, 7)).toEqual({ kind: "applied", newVersion: 8 });
  });

  it("rejects a stale write and reports the server version", () => {
    expect(resolveMoveConflict(7, 8)).toEqual({ kind: "stale", serverVersion: 8 });
  });

  it("treats a client ahead of the server as stale (never trust the client)", () => {
    expect(resolveMoveConflict(9, 8).kind).toBe("stale");
  });
});

describe("mergeServerRow", () => {
  it("prefers the server row when its version is newer", () => {
    const local = { version: 7, stageId: "proposal" };
    const server = { version: 8, stageId: "negotiation" };
    expect(mergeServerRow(local, server)).toEqual(server);
  });

  it("keeps the local row when it is already at the server version", () => {
    const local = { version: 8, stageId: "negotiation" };
    const server = { version: 8, stageId: "negotiation" };
    expect(mergeServerRow(local, server)).toEqual(local);
  });
});

describe("conflictToastMessage", () => {
  it("names the mover, the deal, and the winning stage", () => {
    const msg = conflictToastMessage({
      moverName: "Maya",
      dealName: "Harborlight Renewal",
      stageName: "Negotiation",
    });
    expect(msg).toBe(
      "Maya moved Harborlight Renewal to Negotiation while you were dragging — your move wasn't applied.",
    );
  });
});
