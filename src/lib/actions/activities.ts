"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { fullName } from "@/lib/format";
import type { ActionResult, ActivityKind } from "@/lib/types";

/**
 * Activity Server Actions (APP-FLOW.md Flow 1 + Flow 7, UI-DESIGN.md §2.10).
 *
 * Activities are APPEND-ONLY: after creation only `completed_at` may change
 * (enforced by the `activities_immutable` trigger). Rescheduling therefore
 * completes the old follow-up and creates a new one — `due_at` is never
 * mutated in place. Logging an activity bumps the linked deal's
 * `last_touched_at` via the `activities_bump_deal` trigger.
 *
 * NOTE on `db()`: the checked-in Database type is incompatible with
 * supabase-js 2.117's GenericTable for two reasons — its tables lack
 * `Relationships`, and its row types are `interface`s (interfaces lack the
 * implicit index signature `Row: Record<string, unknown>` requires). Table
 * queries therefore infer `never`. This local shim restores the intended
 * shape. The durable fix is regenerating src/lib/supabase/types.ts (or
 * switching row types to `type` aliases and adding `Relationships: []`
 * per table) — that un-breaks every agent's action files at once.
 */
type Tables = Database["public"]["Tables"];
type FixedDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: {
      [K in keyof Tables]: {
        // Mapped (not interface): interfaces lack implicit index signatures,
        // which GenericTable's `Row: Record<string, unknown>` requires.
        Row: { [P in keyof Tables[K]["Row"]]: Tables[K]["Row"][P] };
        Insert: Tables[K]["Insert"];
        Update: Tables[K]["Update"];
        Relationships: [];
      };
    };
  };
};

async function db(): Promise<SupabaseClient<FixedDatabase>> {
  return (await createClient()) as unknown as SupabaseClient<FixedDatabase>;
}

const PAGE_SIZE = 20;

const logActivitySchema = z
  .object({
    type: z.enum(["call", "email", "meeting", "note"]),
    dealId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    occurredAt: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" }),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().max(5000).optional(),
    followUp: z
      .object({
        dueAt: z
          .string()
          .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid follow-up date" }),
      })
      .optional(),
  })
  .refine((d) => d.dealId || d.contactId, {
    message: "Link the activity to a deal or a contact",
  });

export type LogActivityInput = z.infer<typeof logActivitySchema>;

/**
 * Log an activity (call/email/meeting/note) against a deal and/or contact.
 * Optionally schedules a follow-up, which becomes a second activity with
 * `is_follow_up = true` and `due_at` set.
 */
export async function logActivity(
  input: LogActivityInput,
): Promise<ActionResult<{ id: string; followUpId: string | null }>> {
  const parsed = logActivitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await db();
  const data = parsed.data;

  const { data: activity, error } = await supabase
    .from("activities")
    .insert({
      type: data.type,
      subject: data.subject || null,
      body: data.body || null,
      occurred_at: new Date(data.occurredAt).toISOString(),
      deal_id: data.dealId ?? null,
      contact_id: data.contactId ?? null,
      owner_id: session.id,
    })
    .select("id")
    .single();

  if (error || !activity) {
    return { ok: false, error: error?.message ?? "Could not log the activity" };
  }

  let followUpId: string | null = null;
  if (data.followUp) {
    const { data: followUp, error: followUpError } = await supabase
      .from("activities")
      .insert({
        type: data.type,
        subject: data.subject ? `Follow up: ${data.subject}` : "Follow up",
        body: null,
        occurred_at: new Date().toISOString(),
        deal_id: data.dealId ?? null,
        contact_id: data.contactId ?? null,
        owner_id: session.id,
        is_follow_up: true,
        due_at: new Date(data.followUp.dueAt).toISOString(),
      })
      .select("id")
      .single();

    if (followUpError || !followUp) {
      return {
        ok: false,
        error: `Activity logged, but the follow-up could not be scheduled: ${followUpError?.message ?? "unknown error"}`,
      };
    }
    followUpId = followUp.id;
  }

  return { ok: true, data: { id: activity.id, followUpId } };
}

const OUTCOME_LABELS = {
  connected: "Connected",
  no_answer: "No answer",
  left_voicemail: "Left voicemail",
  not_interested: "Not interested",
  other: "Other",
} as const;

const completeFollowUpSchema = z.object({
  activityId: z.string().uuid(),
  outcome: z.enum(["connected", "no_answer", "left_voicemail", "not_interested", "other"]),
  note: z.string().trim().max(5000).optional(),
  nextDueAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid follow-up date" })
    .optional(),
});

export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>;

/**
 * Complete a follow-up: marks it done (completed_at), appends the outcome as
 * a new note activity, and optionally creates the next follow-up.
 */
export async function completeFollowUp(
  input: CompleteFollowUpInput,
): Promise<ActionResult<{ completedId: string; outcomeId: string; nextFollowUpId: string | null }>> {
  const parsed = completeFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await db();
  const { activityId, outcome, note, nextDueAt } = parsed.data;

  const { data: followUp, error: fetchError } = await supabase
    .from("activities")
    .select("id,is_follow_up,completed_at,type,subject,deal_id,contact_id")
    .eq("id", activityId)
    .single();

  if (fetchError || !followUp) {
    return { ok: false, error: "Follow-up not found" };
  }
  if (!followUp.is_follow_up) {
    return { ok: false, error: "This activity is not a follow-up" };
  }
  if (followUp.completed_at) {
    return { ok: false, error: "This follow-up is already done" };
  }

  // Only completed_at may change on an existing activity (append-only trigger).
  const { error: doneError } = await supabase
    .from("activities")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", activityId);

  if (doneError) {
    return { ok: false, error: doneError.message };
  }

  const { data: outcomeActivity, error: outcomeError } = await supabase
    .from("activities")
    .insert({
      type: "note",
      subject: OUTCOME_LABELS[outcome],
      body: note || null,
      occurred_at: new Date().toISOString(),
      deal_id: followUp.deal_id,
      contact_id: followUp.contact_id,
      owner_id: session.id,
    })
    .select("id")
    .single();

  if (outcomeError || !outcomeActivity) {
    return { ok: false, error: outcomeError?.message ?? "Could not record the outcome" };
  }

  let nextFollowUpId: string | null = null;
  if (nextDueAt) {
    const { data: next, error: nextError } = await supabase
      .from("activities")
      .insert({
        type: followUp.type,
        subject: followUp.subject ? `Follow up: ${followUp.subject}` : "Follow up",
        body: null,
        occurred_at: new Date().toISOString(),
        deal_id: followUp.deal_id,
        contact_id: followUp.contact_id,
        owner_id: session.id,
        is_follow_up: true,
        due_at: new Date(nextDueAt).toISOString(),
      })
      .select("id")
      .single();

    if (nextError || !next) {
      return {
        ok: false,
        error: `Outcome logged, but the next follow-up could not be scheduled: ${nextError?.message ?? "unknown error"}`,
      };
    }
    nextFollowUpId = next.id;
  }

  return {
    ok: true,
    data: { completedId: activityId, outcomeId: outcomeActivity.id, nextFollowUpId },
  };
}

const rescheduleFollowUpSchema = z.object({
  activityId: z.string().uuid(),
  dueAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" }),
});

export type RescheduleFollowUpInput = z.infer<typeof rescheduleFollowUpSchema>;

/**
 * Reschedule a follow-up. The append-only trigger forbids mutating `due_at`
 * in place, so rescheduling completes the old follow-up and creates a new
 * one with the same links, type, and subject.
 */
export async function rescheduleFollowUp(
  input: RescheduleFollowUpInput,
): Promise<ActionResult<{ id: string; supersededId: string }>> {
  const parsed = rescheduleFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await db();
  const { activityId, dueAt } = parsed.data;

  const { data: followUp, error: fetchError } = await supabase
    .from("activities")
    .select("id,is_follow_up,completed_at,type,subject,deal_id,contact_id")
    .eq("id", activityId)
    .single();

  if (fetchError || !followUp) {
    return { ok: false, error: "Follow-up not found" };
  }
  if (!followUp.is_follow_up) {
    return { ok: false, error: "This activity is not a follow-up" };
  }
  if (followUp.completed_at) {
    return { ok: false, error: "This follow-up is already done" };
  }

  const { error: doneError } = await supabase
    .from("activities")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", activityId);

  if (doneError) {
    return { ok: false, error: doneError.message };
  }

  const { data: next, error: nextError } = await supabase
    .from("activities")
    .insert({
      type: followUp.type,
      subject: followUp.subject,
      body: null,
      occurred_at: new Date().toISOString(),
      deal_id: followUp.deal_id,
      contact_id: followUp.contact_id,
      owner_id: session.id,
      is_follow_up: true,
      due_at: new Date(dueAt).toISOString(),
    })
    .select("id")
    .single();

  if (nextError || !next) {
    return { ok: false, error: nextError?.message ?? "Could not reschedule the follow-up" };
  }

  return { ok: true, data: { id: next.id, supersededId: activityId } };
}

/** Rich activity row for the /activities queue and dashboard lists. */
export interface ActivityListItem {
  id: string;
  type: ActivityKind;
  subject: string | null;
  body: string | null;
  occurredAt: string;
  dueAt: string | null;
  completedAt: string | null;
  isFollowUp: boolean;
  dealId: string | null;
  dealName: string | null;
  contactId: string | null;
  contactName: string | null;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
}

export interface ListActivitiesResult {
  items: ActivityListItem[];
  nextCursor: string | null;
}

const listActivitiesSchema = z.object({
  view: z.enum(["overdue", "upcoming", "all"]),
  type: z.enum(["call", "email", "meeting", "note"]).optional(),
  ownerId: z.string().uuid().optional(),
  q: z.string().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export type ListActivitiesInput = z.infer<typeof listActivitiesSchema>;

function encodeCursor(at: string, id: string): string {
  return Buffer.from(JSON.stringify({ at, id }), "utf-8").toString("base64url");
}

function decodeCursor(cursor: string): { at: string; id: string } | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { at?: unknown }).at === "string" &&
      typeof (parsed as { id?: unknown }).id === "string"
    ) {
      return parsed as { at: string; id: string };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Paginated activity queue. Overdue = follow-up with due_at in the past and
 * no completed_at. Upcoming = follow-up due now or later. All = everything,
 * filterable by type, owner, and deal/subject search. Keyset pagination via
 * an opaque cursor.
 */
export async function listActivities(
  input: ListActivitiesInput,
): Promise<ActionResult<ListActivitiesResult>> {
  const parsed = listActivitiesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await db();
  const { view, type, ownerId, q, cursor, limit } = parsed.data;
  const pageSize = limit ?? PAGE_SIZE;
  const nowIso = new Date().toISOString();

  let query = supabase
    .from("activities")
    .select(
      "id,type,subject,body,occurred_at,due_at,completed_at,is_follow_up,deal_id,contact_id,owner_id",
    );

  if (view === "overdue") {
    query = query
      .eq("is_follow_up", true)
      .lt("due_at", nowIso)
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .order("id", { ascending: true });
  } else if (view === "upcoming") {
    query = query
      .eq("is_follow_up", true)
      .gte("due_at", nowIso)
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .order("id", { ascending: true });
  } else {
    query = query
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false });
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      const key = view === "all" ? "occurred_at" : "due_at";
      const op = view === "all" ? "lt" : "gt";
      // Keyset: (key, id) strictly past the cursor in the sort order.
      query = query.or(
        `and(${key}.${op}.${decoded.at},id.${op}.${decoded.id}),and(${key}.eq.${decoded.at},id.${op}.${decoded.id})`,
      );
    }
  }

  if (type) query = query.eq("type", type);
  if (ownerId) query = query.eq("owner_id", ownerId);

  if (q && q.trim()) {
    const needle = q.trim().replace(/[%_,]/g, "").slice(0, 60);
    if (needle) {
      const { data: deals } = await supabase
        .from("deals")
        .select("id")
        .ilike("name", `%${needle}%`)
        .is("deleted_at", null)
        .limit(50);
      const dealIds = (deals ?? []).map((d) => d.id);
      const parts = [`subject.ilike.%${needle}%`, `body.ilike.%${needle}%`];
      if (dealIds.length > 0) parts.push(`deal_id.in.(${dealIds.join(",")})`);
      query = query.or(parts.join(","));
    }
  }

  const { data: rows, error } = await query.limit(pageSize + 1);
  if (error) {
    return { ok: false, error: error.message };
  }

  const page = (rows ?? []).slice(0, pageSize);
  const hasMore = (rows ?? []).length > pageSize;

  const ownerIds = [...new Set(page.map((r) => r.owner_id))];
  const dealIds = [...new Set(page.map((r) => r.deal_id).filter((id): id is string => id !== null))];
  const contactIds = [...new Set(page.map((r) => r.contact_id).filter((id): id is string => id !== null))];

  const [usersRes, dealsRes, contactsRes] = await Promise.all([
    ownerIds.length > 0
      ? supabase.from("users").select("id,full_name,avatar_url").in("id", ownerIds)
      : null,
    dealIds.length > 0 ? supabase.from("deals").select("id,name").in("id", dealIds) : null,
    contactIds.length > 0
      ? supabase.from("contacts").select("id,first_name,last_name").in("id", contactIds)
      : null,
  ]);

  const userById = new Map((usersRes?.data ?? []).map((u) => [u.id, u]));
  const dealById = new Map((dealsRes?.data ?? []).map((d) => [d.id, d]));
  const contactById = new Map((contactsRes?.data ?? []).map((c) => [c.id, c]));

  const items: ActivityListItem[] = page.map((r) => {
    const owner = userById.get(r.owner_id);
    const deal = r.deal_id ? dealById.get(r.deal_id) : undefined;
    const contact = r.contact_id ? contactById.get(r.contact_id) : undefined;
    return {
      id: r.id,
      type: r.type,
      subject: r.subject,
      body: r.body,
      occurredAt: r.occurred_at,
      dueAt: r.due_at,
      completedAt: r.completed_at,
      isFollowUp: r.is_follow_up,
      dealId: r.deal_id,
      dealName: deal?.name ?? null,
      contactId: r.contact_id,
      contactName: contact ? fullName(contact.first_name, contact.last_name) : null,
      ownerId: r.owner_id,
      ownerName: owner?.full_name ?? "Unknown",
      ownerAvatarUrl: owner?.avatar_url ?? null,
    };
  });

  let nextCursor: string | null = null;
  if (hasMore) {
    const last = page[page.length - 1];
    if (last) {
      const key = view === "all" ? last.occurred_at : (last.due_at ?? last.occurred_at);
      nextCursor = encodeCursor(key, last.id);
    }
  }

  return { ok: true, data: { items, nextCursor } };
}

/**
 * Overdue follow-up count for the topbar bell. Single count query, no rows
 * fetched. RLS scopes it to what the caller may see.
 */
export async function getOverdueCount(): Promise<ActionResult<number>> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await db();

  const { count, error } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("is_follow_up", true)
    .lt("due_at", new Date().toISOString())
    .is("completed_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: count ?? 0 };
}

export interface ActivityCounts {
  overdue: number;
  upcoming: number;
  all: number;
}

/** Tab counts for the /activities segmented control. */
export async function getActivityCounts(): Promise<ActionResult<ActivityCounts>> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await db();
  const nowIso = new Date().toISOString();

  const [overdueRes, upcomingRes, allRes] = await Promise.all([
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("is_follow_up", true)
      .lt("due_at", nowIso)
      .is("completed_at", null),
    supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("is_follow_up", true)
      .gte("due_at", nowIso)
      .is("completed_at", null),
    supabase.from("activities").select("id", { count: "exact", head: true }),
  ]);

  if (overdueRes.error) return { ok: false, error: overdueRes.error.message };
  if (upcomingRes.error) return { ok: false, error: upcomingRes.error.message };
  if (allRes.error) return { ok: false, error: allRes.error.message };

  return {
    ok: true,
    data: {
      overdue: overdueRes.count ?? 0,
      upcoming: upcomingRes.count ?? 0,
      all: allRes.count ?? 0,
    },
  };
}

/** Active team members for the owner filter (RLS: active users are visible). */
export async function listTeamMembers(): Promise<ActionResult<{ id: string; name: string }[]>> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await db();

  const { data, error } = await supabase
    .from("users")
    .select("id,full_name")
    .eq("is_active", true)
    .order("full_name");

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map((u) => ({ id: u.id, name: u.full_name })) };
}
