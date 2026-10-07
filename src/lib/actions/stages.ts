"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { PipelineStageRow } from "@/lib/supabase/types";
import type { ActionResult } from "@/lib/types";

import { asManagerOrAdmin } from "./guards";

/**
 * Pipeline stage configuration (APP-FLOW.md /settings/stages, UI-DESIGN.md 2.13).
 *
 * Reads are open to every signed-in user (the kanban board needs them);
 * every mutation requires manager or admin. Guards:
 * - a stage holding deals can't be deleted without a move target
 *   (returns HAS_DEALS with the count);
 * - the last closed-won / closed-lost stage can't be deleted
 *   (returns LAST_WON_STAGE / LAST_LOST_STAGE).
 */

const HEX_COLOR = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a #RRGGBB hex value");

export interface StageWithCount extends PipelineStageRow {
  dealCount: number;
}

async function dealCountsByStage(): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("deals").select("stage_id");
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.stage_id, (counts.get(row.stage_id) ?? 0) + 1);
  }
  return counts;
}

/** Every signed-in user may list stages. */
export async function listStages(): Promise<ActionResult<StageWithCount[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("position");
  if (error || !data) return { ok: false, error: "LOAD_FAILED" };

  const counts = await dealCountsByStage();
  return {
    ok: true,
    data: data.map((s) => ({ ...s, dealCount: counts.get(s.id) ?? 0 })),
  };
}

const CreateStageSchema = z.object({
  name: z.string().trim().min(1, "Stage name is required").max(60),
  color: HEX_COLOR,
});

export async function createStage(
  input: z.input<typeof CreateStageSchema>,
): Promise<ActionResult<PipelineStageRow>> {
  const guard = await asManagerOrAdmin();
  if (!guard.ok) return guard;

  const parsed = CreateStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("pipeline_stages")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);
  const position = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({
      name: parsed.data.name,
      color: parsed.data.color,
      position,
    })
    .select()
    .single();
  if (error || !data) return { ok: false, error: "CREATE_FAILED" };

  await supabase.from("audit_log").insert({
    actor_id: guard.me.id,
    action: "stage.created",
    entity_type: "pipeline_stage",
    entity_id: data.id,
    diff: { name: data.name },
  });

  return { ok: true, data };
}

const UpdateStageSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Stage name is required").max(60).optional(),
  color: HEX_COLOR.optional(),
  position: z.number().int().min(0).optional(),
});

export async function updateStage(
  input: z.input<typeof UpdateStageSchema>,
): Promise<ActionResult<PipelineStageRow>> {
  const guard = await asManagerOrAdmin();
  if (!guard.ok) return guard;

  const parsed = UpdateStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }
  const { id, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0) return { ok: false, error: "NOTHING_TO_UPDATE" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) return { ok: false, error: "NOT_FOUND" };

  await supabase.from("audit_log").insert({
    actor_id: guard.me.id,
    action: "stage.updated",
    entity_type: "pipeline_stage",
    entity_id: id,
    diff: fields as Record<string, unknown>,
  });

  return { ok: true, data };
}

const DeleteStageSchema = z.object({
  id: z.string().uuid(),
  moveDealsToId: z.string().uuid().optional(),
});

export type DeleteStageResult = { moved: number };

/**
 * Deletes a stage. When the stage holds deals and no move target is given,
 * returns `{ ok: false, error: "HAS_DEALS", data: { count } }` so the UI can
 * open the "move deals first" dialog.
 */
export async function deleteStage(
  input: z.input<typeof DeleteStageSchema>,
): Promise<ActionResult<DeleteStageResult> | { ok: false; error: string; data: { count: number } }> {
  const guard = await asManagerOrAdmin();
  if (!guard.ok) return guard;

  const parsed = DeleteStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }
  const { id, moveDealsToId } = parsed.data;

  const supabase = await createClient();
  const { data: stages, error: stagesError } = await supabase
    .from("pipeline_stages")
    .select("*");
  if (stagesError || !stages) return { ok: false, error: "LOAD_FAILED" };

  const stage = stages.find((s) => s.id === id);
  if (!stage) return { ok: false, error: "NOT_FOUND" };

  // Closed-stage guards: the pipeline must keep one won and one lost stage.
  if (stage.is_closed_won && !stages.some((s) => s.id !== id && s.is_closed_won)) {
    return { ok: false, error: "LAST_WON_STAGE" };
  }
  if (stage.is_closed_lost && !stages.some((s) => s.id !== id && s.is_closed_lost)) {
    return { ok: false, error: "LAST_LOST_STAGE" };
  }

  const counts = await dealCountsByStage();
  const dealCount = counts.get(id) ?? 0;

  if (dealCount > 0 && !moveDealsToId) {
    return { ok: false, error: "HAS_DEALS", data: { count: dealCount } };
  }

  let moved = 0;
  if (dealCount > 0 && moveDealsToId) {
    const target = stages.find((s) => s.id === moveDealsToId);
    if (!target || target.id === id) return { ok: false, error: "INVALID_TARGET" };

    const now = new Date().toISOString();
    const { data: movedDeals, error: moveError } = await supabase
      .from("deals")
      .update({ stage_id: moveDealsToId, stage_entered_at: now, last_touched_at: now })
      .eq("stage_id", id)
      .select("id");
    if (moveError) return { ok: false, error: "MOVE_FAILED" };
    moved = movedDeals?.length ?? 0;

    if (moved > 0) {
      await supabase.from("stage_history").insert(
        (movedDeals ?? []).map((d) => ({
          deal_id: d.id,
          from_stage_id: id,
          to_stage_id: moveDealsToId,
          changed_by: guard.me.id,
        })),
      );
    }
  }

  const { error: deleteError } = await supabase.from("pipeline_stages").delete().eq("id", id);
  if (deleteError) return { ok: false, error: "DELETE_FAILED" };

  await supabase.from("audit_log").insert({
    actor_id: guard.me.id,
    action: "stage.deleted",
    entity_type: "pipeline_stage",
    entity_id: id,
    diff: { name: stage.name, movedDealCount: moved, movedTo: moveDealsToId ?? null },
  });

  return { ok: true, data: { moved } };
}

const ReorderStagesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

/** Persists a drag-reordered stage list; positions become the array index. */
export async function reorderStages(
  input: z.input<typeof ReorderStagesSchema>,
): Promise<ActionResult<{ updated: number }>> {
  const guard = await asManagerOrAdmin();
  if (!guard.ok) return guard;

  const parsed = ReorderStagesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }

  const supabase = await createClient();
  const { data: stages } = await supabase.from("pipeline_stages").select("id");
  const known = new Set((stages ?? []).map((s) => s.id));
  if (!parsed.data.ids.every((id) => known.has(id))) {
    return { ok: false, error: "UNKNOWN_STAGE" };
  }

  // Position is unique — two passes via negative scratch values so no
  // transient collision can violate the constraint mid-reorder.
  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ position: -(1000 + index) })
      .eq("id", id);
    if (error) return { ok: false, error: "REORDER_FAILED" };
  }
  for (const [index, id] of parsed.data.ids.entries()) {
    const { error } = await supabase
      .from("pipeline_stages")
      .update({ position: index })
      .eq("id", id);
    if (error) return { ok: false, error: "REORDER_FAILED" };
  }

  return { ok: true, data: { updated: parsed.data.ids.length } };
}
