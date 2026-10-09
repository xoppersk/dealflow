"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUser, isManagerOrAdmin } from "@/lib/auth";
import {
  checkReopen,
  checkStageMove,
  sortStagesForBoard,
} from "@/lib/domain/stage-rules";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  DealCardData,
  StageColumnData,
} from "@/lib/types";
import type {
  Database,
  DealRow,
  PipelineStageRow,
} from "@/lib/supabase/types";

/**
 * Pipeline Server Actions (TECHNICAL-REQUIREMENTS.md §2, §6).
 *
 * - getBoardData: board payload for /pipeline (stages in board order + deals
 *   with owner/company display joins, capped at 500 with a total count).
 * - moveDeal: optimistic-concurrency stage move. Validates with Zod, mirrors
 *   the DB trigger rules via checkStageMove, and writes with a
 *   `WHERE version = <clientVersion>` guard. A lost race returns
 *   VERSION_CONFLICT with the fresh row so the client can reconcile.
 * - reopenDeal: manager/admin-only move OUT of a closed stage. The 00010
 *   trigger permits it only when the same UPDATE clears closed_at and the
 *   caller is a manager/admin — this action does exactly that, atomically.
 */

export interface BoardData {
  stages: StageColumnData[];
  deals: DealCardData[];
  /** Total non-deleted deals (the board payload is capped at 500). */
  totalCount: number;
}

export type MoveDealResult =
  | { ok: true; data: DealCardData }
  | { ok: false; error: "VERSION_CONFLICT"; data: DealCardData }
  | { ok: false; error: string };

const MoveDealSchema = z.object({
  dealId: z.uuid(),
  toStageId: z.uuid(),
  version: z.number().int(),
  closeConfirmed: z.boolean().optional(),
});

const ReopenDealSchema = z.object({
  dealId: z.uuid(),
  toStageId: z.uuid(),
  reason: z.string().trim().min(1, "A reason is required to reopen a deal."),
});

/**
 * Inference-safe variant of the foundation Database type.
 *
 * The hand-written type predates supabase-js v2.117's stricter inference:
 * its tables lack the `Relationships` key that `GenericTable` requires, so
 * every select/update/insert collapses to `never`. We augment locally with
 * empty relationship lists (no embedded joins are used here) until the
 * foundation type is regenerated via `supabase gen types`.
 */
export type PipelineDatabase = {
  public: {
    Tables: {
      [K in keyof Database["public"]["Tables"]]: Database["public"]["Tables"][K] & {
        Relationships: [];
      };
    };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"];
    Enums: Database["public"]["Enums"];
  };
};

type Db = SupabaseClient<PipelineDatabase>;

/** Cast a foundation-typed client to the inference-safe variant. */
function db<T>(client: T): Db {
  return client as unknown as Db;
}

interface OwnerInfo {
  full_name: string;
  avatar_url: string | null;
}

function toStageColumn(row: PipelineStageRow): StageColumnData {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    color: row.color,
    isClosedWon: row.is_closed_won,
    isClosedLost: row.is_closed_lost,
    defaultProbability: row.default_probability,
  };
}

function toDealCard(
  row: DealRow,
  owners: Map<string, OwnerInfo>,
  companies: Map<string, string>,
  stages: Map<string, PipelineStageRow>,
  nextSteps: Map<string, { title: string; due: string }>,
): DealCardData {
  const owner = owners.get(row.owner_id);
  const next = nextSteps.get(row.id);
  return {
    id: row.id,
    name: row.name,
    // numeric(12,2) can arrive as a string from PostgREST — coerce defensively.
    value: Number(row.value),
    currency: row.currency,
    stageId: row.stage_id,
    ownerId: row.owner_id,
    ownerName: owner?.full_name ?? "Unknown",
    ownerAvatarUrl: owner?.avatar_url ?? null,
    companyName:
      row.company_id != null ? (companies.get(row.company_id) ?? null) : null,
    probability: row.probability,
    stageDefaultProbability:
      stages.get(row.stage_id)?.default_probability ?? 0,
    closeDate: row.close_date,
    version: row.version,
    stageEnteredAt: row.stage_entered_at,
    lastTouchedAt: row.last_touched_at,
    boardPosition: row.board_position,
    nextStepTitle: next?.title ?? null,
    nextStepDue: next?.due ?? null,
  };
}

/** "due October 8" / "overdue October 5" label for a follow-up due date. */
function nextStepDueLabel(dueAt: string, now: Date = new Date()): string {
  const due = new Date(dueAt);
  const label = due.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const overdue =
    due.getTime() < new Date(now.toDateString()).getTime();
  return `${overdue ? "overdue" : "due"} ${label}`;
}

/**
 * Next open follow-up per deal (nearest due date first): the hero next-step
 * line on board tickets and the Today ledger's next-step card.
 */
async function nextStepsForDeals(
  supabase: Db,
  dealIds: string[],
): Promise<Map<string, { title: string; due: string }>> {
  const map = new Map<string, { title: string; due: string }>();
  if (dealIds.length === 0) return map;
  const { data, error } = await supabase
    .from("activities")
    .select("deal_id, subject, due_at")
    .in("deal_id", dealIds)
    .eq("is_follow_up", true)
    .is("completed_at", null)
    .not("due_at", "is", null)
    .order("due_at", { ascending: true })
    .limit(500);
  if (error) {
    console.error("[pipeline] next-step lookup failed", error);
    return map;
  }
  for (const r of data ?? []) {
    if (!r.deal_id || map.has(r.deal_id) || !r.due_at) continue;
    map.set(r.deal_id, {
      title: r.subject ?? "Follow up",
      due: nextStepDueLabel(r.due_at),
    });
  }
  return map;
}

/** Single-row variant of the display joins (conflict + reopen paths). */
async function toDealCardWithLookups(
  supabase: Db,
  row: DealRow,
  stageMap: Map<string, PipelineStageRow>,
): Promise<DealCardData> {
  const owners = new Map<string, OwnerInfo>();
  const companies = new Map<string, string>();

  const { data: owner } = await supabase
    .from("users")
    .select("id, full_name, avatar_url")
    .eq("id", row.owner_id)
    .maybeSingle();
  if (owner) {
    owners.set(owner.id, {
      full_name: owner.full_name,
      avatar_url: owner.avatar_url,
    });
  }

  if (row.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", row.company_id)
      .maybeSingle();
    if (company) companies.set(company.id, company.name);
  }

  const nextSteps = await nextStepsForDeals(supabase, [row.id]);

  return toDealCard(row, owners, companies, stageMap, nextSteps);
}

/** Next board_position for a card landing at the end of a column. */
async function nextBoardPosition(
  supabase: Db,
  stageId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("deals")
    .select("board_position")
    .eq("stage_id", stageId)
    .is("deleted_at", null)
    .order("board_position", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.board_position ?? -1) + 1;
}

export async function getBoardData(): Promise<ActionResult<BoardData>> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Unauthorized." };

  try {
    const supabase = db(await createClient());

    const [stagesRes, dealsRes, countRes] = await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("*")
        .order("position", { ascending: true }),
      supabase
        .from("deals")
        .select("*")
        .is("deleted_at", null)
        .order("board_position", { ascending: true })
        .limit(500),
      supabase
        .from("deals")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null),
    ]);

    if (stagesRes.error) throw stagesRes.error;
    if (dealsRes.error) throw dealsRes.error;

    const stageRows = sortStagesForBoard(stagesRes.data ?? []);
    const dealRows = dealsRes.data ?? [];
    const stageMap = new Map(stageRows.map((s) => [s.id, s]));

    const ownerIds = [...new Set(dealRows.map((d) => d.owner_id))];
    const companyIds = [
      ...new Set(
        dealRows
          .map((d) => d.company_id)
          .filter((c): c is string => c !== null),
      ),
    ];

    const owners = new Map<string, OwnerInfo>();
    if (ownerIds.length > 0) {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, avatar_url")
        .in("id", ownerIds);
      if (error) throw error;
      for (const u of data ?? []) {
        owners.set(u.id, { full_name: u.full_name, avatar_url: u.avatar_url });
      }
    }

    const companies = new Map<string, string>();
    if (companyIds.length > 0) {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds);
      if (error) throw error;
      for (const c of data ?? []) companies.set(c.id, c.name);
    }

    const nextSteps = await nextStepsForDeals(
      supabase,
      dealRows.map((d) => d.id),
    );

    return {
      ok: true,
      data: {
        stages: stageRows.map(toStageColumn),
        deals: dealRows.map((d) =>
          toDealCard(d, owners, companies, stageMap, nextSteps),
        ),
        totalCount: countRes.count ?? dealRows.length,
      },
    };
  } catch (e) {
    console.error("[pipeline] getBoardData failed", e);
    return { ok: false, error: "Couldn't load the pipeline. Please try again." };
  }
}

/**
 * Build the VERSION_CONFLICT result: record the rejected attempt in
 * audit_log (both sides of a collision stay auditable) and hand the fresh
 * row back so the client can patch to server state + offer Retry.
 */
async function versionConflict(
  supabase: Db,
  actorId: string,
  freshRow: DealRow,
  fromStage: PipelineStageRow,
  attemptedToStage: PipelineStageRow,
  clientVersion: number,
  stageMap: Map<string, PipelineStageRow>,
): Promise<MoveDealResult> {
  try {
    await supabase.from("audit_log").insert({
      actor_id: actorId,
      action: "deal.move_conflict",
      entity_type: "deal",
      entity_id: freshRow.id,
      diff: {
        from_stage_id: fromStage.id,
        attempted_to_stage_id: attemptedToStage.id,
        client_version: clientVersion,
        server_version: freshRow.version,
        server_stage_id: freshRow.stage_id,
      },
    });
  } catch (e) {
    // Never let the audit write mask the conflict itself.
    console.error("[pipeline] moveDeal audit_log insert failed", e);
  }

  const card = await toDealCardWithLookups(supabase, freshRow, stageMap);
  return { ok: false, error: "VERSION_CONFLICT", data: card };
}

export async function moveDeal(input: unknown): Promise<MoveDealResult> {
  const parsed = MoveDealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Unauthorized." };

  const {
    dealId,
    toStageId,
    version: clientVersion,
    closeConfirmed = false,
  } = parsed.data;

  try {
    const supabase = db(await createClient());

    const [dealRes, stagesRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*")
        .eq("id", dealId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase.from("pipeline_stages").select("*"),
    ]);
    if (dealRes.error) throw dealRes.error;
    if (stagesRes.error) throw stagesRes.error;

    const deal = dealRes.data;
    if (!deal) return { ok: false, error: "Deal not found." };

    const stageRows = stagesRes.data ?? [];
    const fromStage = stageRows.find((s) => s.id === deal.stage_id);
    const toStage = stageRows.find((s) => s.id === toStageId);
    if (!fromStage || !toStage) {
      return { ok: false, error: "Unknown pipeline stage." };
    }

    // App-level mirror of the DB trigger rules (TECHNICAL-REQUIREMENTS.md §2).
    const verdict = checkStageMove({ fromStage, toStage, closeConfirmed });
    if (!verdict.ok) return { ok: false, error: verdict.reason };
    if (verdict.requiresCloseConfirmation && !closeConfirmed) {
      return { ok: false, error: "CLOSE_CONFIRMATION_REQUIRED" };
    }

    const stageMap = new Map(stageRows.map((s) => [s.id, s]));

    // Fast-path conflict: the row moved since the client last read it.
    if (deal.version !== clientVersion) {
      return await versionConflict(
        supabase,
        session.id,
        deal,
        fromStage,
        toStage,
        clientVersion,
        stageMap,
      );
    }

    const position = await nextBoardPosition(supabase, toStageId);

    const { data: updated, error: updateError } = await supabase
      .from("deals")
      .update({
        stage_id: toStageId,
        board_position: position,
        version: deal.version + 1,
      })
      .eq("id", dealId)
      .eq("version", clientVersion)
      .is("deleted_at", null)
      .select("*");

    if (updateError) {
      if (updateError.message.includes("DEALFLOW_CLOSED_STAGE_MOVE")) {
        return {
          ok: false,
          error:
            "Closed deals can't be moved by drag — use Reopen (manager or admin only).",
        };
      }
      throw updateError;
    }

    const updatedRow = updated?.[0];
    if (!updatedRow) {
      // Lost the race between the read and the write — same handling.
      const { data: fresh } = await supabase
        .from("deals")
        .select("*")
        .eq("id", dealId)
        .maybeSingle();
      if (!fresh) return { ok: false, error: "Deal not found." };
      return await versionConflict(
        supabase,
        session.id,
        fresh,
        fromStage,
        toStage,
        clientVersion,
        stageMap,
      );
    }

    const { error: historyError } = await supabase
      .from("stage_history")
      .insert({
        deal_id: dealId,
        from_stage_id: fromStage.id,
        to_stage_id: toStage.id,
        changed_by: session.id,
      });
    if (historyError) throw historyError;

    const card = await toDealCardWithLookups(supabase, updatedRow, stageMap);

    revalidatePath("/pipeline");
    return { ok: true, data: card };
  } catch (e) {
    console.error("[pipeline] moveDeal failed", e);
    return { ok: false, error: "Couldn't move the deal. Please try again." };
  }
}

export async function reopenDeal(
  input: unknown,
): Promise<ActionResult<DealCardData>> {
  const parsed = ReopenDealSchema.safeParse(input);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, error: message };
  }

  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Unauthorized." };
  if (!isManagerOrAdmin(session.profile.role)) {
    return {
      ok: false,
      error: "Only managers and admins can reopen closed deals.",
    };
  }

  const { dealId, toStageId, reason } = parsed.data;

  try {
    const supabase = db(await createClient());

    const [dealRes, stagesRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*")
        .eq("id", dealId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase.from("pipeline_stages").select("*"),
    ]);
    if (dealRes.error) throw dealRes.error;
    if (stagesRes.error) throw stagesRes.error;

    const deal = dealRes.data;
    if (!deal) return { ok: false, error: "Deal not found." };

    const stageRows = stagesRes.data ?? [];
    const fromStage = stageRows.find((s) => s.id === deal.stage_id);
    const toStage = stageRows.find((s) => s.id === toStageId);
    if (!fromStage || !toStage) {
      return { ok: false, error: "Unknown pipeline stage." };
    }

    const verdict = checkReopen({
      stage: fromStage,
      actorRole: session.profile.role,
      reason,
    });
    if (!verdict.ok) return { ok: false, error: verdict.reason };
    if (toStage.is_closed_won || toStage.is_closed_lost) {
      return { ok: false, error: "Reopened deals must move to an open stage." };
    }

    const stageMap = new Map(stageRows.map((s) => [s.id, s]));
    const position = await nextBoardPosition(supabase, toStageId);

    // The 00010 trigger permits leaving a closed stage only when closed_at is
    // cleared in the same UPDATE by a manager/admin — done here atomically.
    // The trigger also resets stage_entered_at and bumps last_touched_at.
    const { data: updated, error: updateError } = await supabase
      .from("deals")
      .update({
        stage_id: toStageId,
        closed_at: null,
        board_position: position,
        version: deal.version + 1,
      })
      .eq("id", dealId)
      .is("deleted_at", null)
      .select("*");

    if (updateError) {
      if (updateError.message.includes("DEALFLOW_CLOSED_STAGE_MOVE")) {
        return {
          ok: false,
          error: "Couldn't reopen the deal — the database rejected the move.",
        };
      }
      throw updateError;
    }

    const updatedRow = updated?.[0];
    if (!updatedRow) return { ok: false, error: "Deal not found." };

    const { error: historyError } = await supabase
      .from("stage_history")
      .insert({
        deal_id: dealId,
        from_stage_id: fromStage.id,
        to_stage_id: toStage.id,
        changed_by: session.id,
      });
    if (historyError) throw historyError;

    // Privileged action — keep the reason in the audit trail.
    try {
      await supabase.from("audit_log").insert({
        actor_id: session.id,
        action: "deal.reopen",
        entity_type: "deal",
        entity_id: dealId,
        diff: {
          from_stage_id: fromStage.id,
          to_stage_id: toStage.id,
          reason,
        },
      });
    } catch (e) {
      console.error("[pipeline] reopenDeal audit_log insert failed", e);
    }

    const card = await toDealCardWithLookups(supabase, updatedRow, stageMap);

    revalidatePath("/pipeline");
    return { ok: true, data: card };
  } catch (e) {
    console.error("[pipeline] reopenDeal failed", e);
    return { ok: false, error: "Couldn't reopen the deal. Please try again." };
  }
}
