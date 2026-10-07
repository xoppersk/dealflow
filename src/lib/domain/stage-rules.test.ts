import { describe, expect, it } from "vitest";

import {
  checkReopen,
  checkStageMove,
  defaultStageForNewDeal,
  sortStagesForBoard,
} from "./stage-rules";
import type { PipelineStageRow } from "@/lib/supabase/types";

function stage(overrides: Partial<PipelineStageRow> = {}): PipelineStageRow {
  return {
    id: "stage-1",
    name: "Discovery",
    position: 1,
    color: "#2563EB",
    is_closed_won: false,
    is_closed_lost: false,
    default_probability: 25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const discovery = () => stage({ id: "discovery", name: "Discovery", position: 1 });
const proposal = () => stage({ id: "proposal", name: "Proposal", position: 2 });
const negotiation = () => stage({ id: "negotiation", name: "Negotiation", position: 3 });
const won = () =>
  stage({ id: "won", name: "Closed Won", position: 4, is_closed_won: true, default_probability: 100 });
const lost = () =>
  stage({ id: "lost", name: "Closed Lost", position: 5, is_closed_lost: true, default_probability: 0 });

describe("checkStageMove", () => {
  it("allows free movement between open stages, forward and backward", () => {
    expect(checkStageMove({ fromStage: discovery(), toStage: proposal() })).toEqual({
      ok: true,
      requiresCloseConfirmation: false,
    });
    // Sales processes regress legitimately.
    expect(checkStageMove({ fromStage: negotiation(), toStage: discovery() })).toEqual({
      ok: true,
      requiresCloseConfirmation: false,
    });
  });

  it("rejects a no-op move to the same stage", () => {
    const verdict = checkStageMove({ fromStage: discovery(), toStage: discovery() });
    expect(verdict.ok).toBe(false);
  });

  it("requires close confirmation when moving into a closed stage", () => {
    const verdict = checkStageMove({ fromStage: negotiation(), toStage: won() });
    expect(verdict).toEqual({ ok: true, requiresCloseConfirmation: true });

    const lostVerdict = checkStageMove({ fromStage: negotiation(), toStage: lost() });
    expect(lostVerdict).toEqual({ ok: true, requiresCloseConfirmation: true });
  });

  it("applies the move directly when close confirmation was already given", () => {
    expect(
      checkStageMove({ fromStage: negotiation(), toStage: won(), closeConfirmed: true }),
    ).toEqual({ ok: true, requiresCloseConfirmation: false });
  });

  it("rejects dragging OUT of a closed stage", () => {
    const verdict = checkStageMove({ fromStage: won(), toStage: negotiation() });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toMatch(/reopen/i);
    }
  });

  it("rejects moving between two closed stages by drag", () => {
    expect(checkStageMove({ fromStage: won(), toStage: lost() }).ok).toBe(false);
  });
});

describe("checkReopen", () => {
  it("allows managers and admins to reopen with a reason", () => {
    expect(checkReopen({ stage: won(), actorRole: "manager", reason: "Customer returned" })).toEqual({
      ok: true,
    });
    expect(checkReopen({ stage: lost(), actorRole: "admin", reason: "Won on appeal" })).toEqual({
      ok: true,
    });
  });

  it("rejects reps", () => {
    const verdict = checkReopen({ stage: won(), actorRole: "rep", reason: "Please" });
    expect(verdict).toEqual({
      ok: false,
      reason: "Only managers and admins can reopen closed deals.",
    });
  });

  it("requires a reason", () => {
    expect(checkReopen({ stage: won(), actorRole: "admin", reason: "   " }).ok).toBe(false);
  });

  it("rejects reopening an open stage", () => {
    expect(checkReopen({ stage: discovery(), actorRole: "admin", reason: "x" }).ok).toBe(false);
  });
});

describe("sortStagesForBoard", () => {
  it("orders by position with closed stages at the end", () => {
    const sorted = sortStagesForBoard([won(), negotiation(), lost(), discovery(), proposal()]);
    expect(sorted.map((s) => s.name)).toEqual([
      "Discovery",
      "Proposal",
      "Negotiation",
      "Closed Won",
      "Closed Lost",
    ]);
  });
});

describe("defaultStageForNewDeal", () => {
  it("returns the first open stage by position", () => {
    expect(defaultStageForNewDeal([proposal(), discovery(), won()])?.name).toBe("Discovery");
  });

  it("returns null when every stage is closed", () => {
    expect(defaultStageForNewDeal([won(), lost()])).toBeNull();
  });
});
