"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

import { asAdmin } from "./guards";

/**
 * Audit log viewer (admin only). Append-only table — this action only reads.
 * Supports entity-type / action filters and page-based pagination.
 */

const PAGE_SIZE = 25;

export interface AuditEntry {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  diff: Record<string, unknown>;
}

export interface AuditList {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  entityTypes: string[];
  actions: string[];
}

const ListAuditLogSchema = z.object({
  entityType: z.string().trim().min(1).max(60).optional(),
  action: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export async function listAuditLog(
  input: z.input<typeof ListAuditLogSchema> = {},
): Promise<ActionResult<AuditList>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const parsed = ListAuditLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }
  const { entityType, action, page } = parsed.data;

  const supabase = await createClient();

  let query = supabase
    .from("audit_log")
    .select("id, created_at, actor_id, action, entity_type, entity_id, diff", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (entityType) query = query.eq("entity_type", entityType);
  if (action) query = query.eq("action", action);

  const { data: rows, count, error } = await query;
  if (error || !rows) return { ok: false, error: "LOAD_FAILED" };

  // Actor names + filter options.
  const actorIds = [...new Set(rows.map((r) => r.actor_id))];
  const [{ data: actors }, { data: distinct }] = await Promise.all([
    actorIds.length > 0
      ? supabase.from("users").select("id, full_name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    supabase.from("audit_log").select("entity_type, action").limit(1000),
  ]);
  const actorById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    actorId: r.actor_id,
    actorName: actorById.get(r.actor_id) ?? "Unknown",
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    diff: (r.diff ?? {}) as Record<string, unknown>,
  }));

  return {
    ok: true,
    data: {
      entries,
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      entityTypes: [...new Set((distinct ?? []).map((d) => d.entity_type))].sort(),
      actions: [...new Set((distinct ?? []).map((d) => d.action))].sort(),
    },
  };
}
