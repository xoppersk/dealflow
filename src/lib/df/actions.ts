"use server";

/**
 * lib/df/actions.ts — production mutations (server actions).
 *
 * Every action: getContext() (auth + workspace membership) → zod-validate
 * → write through the caller's OWN Supabase client (RLS enforced, never
 * service role) → audit row (audit_log has no triggers; RLS allows member
 * insert, admin read) → revalidate. Actions return a result object so
 * client components can revert optimistic UI on failure.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getContext, type DfContext } from "./db";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

async function insertAudit(
  ctx: DfContext,
  action: string,
  entityType: string,
  entityId: string,
  diff: Row,
): Promise<void> {
  try {
    await ctx.supabase.from("audit_log").insert({
      actor_id: ctx.user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      diff,
      workspace_id: ctx.workspaceId,
    });
  } catch {
    // Audit is append-only bookkeeping; never fail the user's write for it.
  }
}

async function stageRow(ctx: DfContext, slug: string): Promise<Row> {
  const { data, error } = await ctx.supabase
    .from("pipeline_stages")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("slug", slug)
    .single();
  if (error || !data) throw new Error(`Unknown stage ${slug}`);
  return data as Row;
}

async function dealRow(ctx: DfContext, dealId: string): Promise<Row> {
  const { data, error } = await ctx.supabase
    .from("deals")
    .select("*")
    .eq("workspace_id", ctx.workspaceId)
    .eq("id", dealId)
    .is("deleted_at", null)
    .single();
  if (error || !data) throw new Error("Deal not found in this workspace");
  return data as Row;
}

function revalidateDeals() {
  revalidatePath("/app");
  revalidatePath("/app/pipeline");
  revalidatePath("/app/activities");
  revalidatePath("/app/contacts");
  revalidatePath("/app/companies");
  revalidatePath("/app/reports");
}

/* ---------------- deals ---------------- */

const createDealSchema = z.object({
  name: z.string().trim().min(1).max(200),
  companyId: z.string().uuid().optional(),
  companyName: z.string().trim().max(200).optional(),
  contactId: z.string().uuid().optional(),
  contactName: z.string().trim().max(200).optional(),
  contactTitle: z.string().trim().max(200).optional(),
  value: z.number().finite().min(0).max(1_000_000_000),
  stageSlug: z.string().trim().min(1).max(60),
  closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextStepText: z.string().trim().max(500).optional(),
  nextStepDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  source: z.string().trim().max(200).optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;

export async function createDeal(input: CreateDealInput): Promise<ActionResult<{ id: string }>> {
  try {
    const data = createDealSchema.parse(input);
    const ctx = await getContext();
    const stage = await stageRow(ctx, data.stageSlug);

    let companyId = data.companyId ?? null;
    if (!companyId && data.companyName) {
      const { data: existing } = await ctx.supabase
        .from("companies")
        .select("id")
        .eq("workspace_id", ctx.workspaceId)
        .ilike("name", data.companyName)
        .is("deleted_at", null)
        .limit(1);
      if (existing?.[0]) {
        companyId = existing[0].id as string;
      } else {
        const { data: created, error } = await ctx.supabase
          .from("companies")
          .insert({
            name: data.companyName,
            workspace_id: ctx.workspaceId,
            owner_id: ctx.user.id,
            created_by: ctx.user.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        companyId = created.id as string;
      }
    }

    const { data: deal, error } = await ctx.supabase
      .from("deals")
      .insert({
        name: data.name,
        company_id: companyId,
        stage_id: stage.id,
        value: data.value,
        close_date: data.closeDate ?? null,
        owner_id: ctx.user.id,
        created_by: ctx.user.id,
        workspace_id: ctx.workspaceId,
        source: data.source ?? null,
        next_step_text: data.nextStepText ?? null,
        next_step_due: data.nextStepDue ?? null,
        stage_entered_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    const dealId = deal.id as string;

    let contactId = data.contactId ?? null;
    if (!contactId && data.contactName && companyId) {
      const [firstName, ...rest] = data.contactName.trim().split(/\s+/);
      const { data: createdContact, error: cErr } = await ctx.supabase
        .from("contacts")
        .insert({
          first_name: firstName ?? data.contactName,
          last_name: rest.join(" "),
          title: data.contactTitle ?? null,
          company_id: companyId,
          owner_id: ctx.user.id,
          created_by: ctx.user.id,
          workspace_id: ctx.workspaceId,
        })
        .select("id")
        .single();
      if (!cErr && createdContact) contactId = createdContact.id as string;
    }
    if (contactId) {
      await ctx.supabase.from("deal_contacts").insert({
        deal_id: dealId,
        contact_id: contactId,
        role: data.contactTitle ?? null,
        workspace_id: ctx.workspaceId,
      });
    }

    await insertAudit(ctx, "Create", "deal", dealId, { subject: data.name, toStage: data.stageSlug });
    revalidateDeals();
    return { ok: true, data: { id: dealId } };
  } catch (e) {
    return fail(e);
  }
}

const updateDealSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  value: z.number().finite().min(0).max(1_000_000_000).optional(),
  closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ownerId: z.string().uuid().optional(),
  companyId: z.string().uuid().nullable().optional(),
  source: z.string().trim().max(200).nullable().optional(),
  composition: z.array(z.object({ label: z.string().max(100), value: z.number().min(0) })).optional(),
});

export async function updateDealFields(
  dealId: string,
  fields: z.infer<typeof updateDealSchema>,
): Promise<ActionResult> {
  try {
    const data = updateDealSchema.parse(fields);
    const ctx = await getContext();
    await dealRow(ctx, dealId);
    const patch: Row = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.value !== undefined) patch.value = data.value;
    if (data.closeDate !== undefined) patch.close_date = data.closeDate;
    if (data.ownerId !== undefined) patch.owner_id = data.ownerId;
    if (data.companyId !== undefined) patch.company_id = data.companyId;
    if (data.source !== undefined) patch.source = data.source;
    if (data.composition !== undefined) patch.composition = data.composition;
    const { error } = await ctx.supabase
      .from("deals")
      .update(patch)
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", dealId);
    if (error) throw error;
    await insertAudit(ctx, "Update", "deal", dealId, { subject: data.name ?? "Deal", fields: Object.keys(patch) });
    revalidateDeals();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const moveDealSchema = z.object({
  lostReason: z.string().trim().max(200).optional(),
  lostCompetitor: z.string().trim().max(200).optional(),
  nextStepText: z.string().trim().max(500).optional(),
  nextStepDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type MoveDealOptions = z.infer<typeof moveDealSchema>;

export async function moveDeal(
  dealId: string,
  toStageSlug: string,
  options: MoveDealOptions = {},
): Promise<ActionResult> {
  try {
    const opts = moveDealSchema.parse(options);
    const ctx = await getContext();
    const deal = await dealRow(ctx, dealId);
    const target = await stageRow(ctx, toStageSlug);
    const { data: fromStage } = await ctx.supabase
      .from("pipeline_stages")
      .select("slug, name, is_closed_won, is_closed_lost")
      .eq("id", deal.stage_id)
      .single();
    const fromSlug = (fromStage?.slug as string) ?? "";
    const fromClosed = Boolean(fromStage?.is_closed_won || fromStage?.is_closed_lost);

    if (deal.stage_id === target.id) return { ok: true };

    const patch: Row = { stage_id: target.id, board_position: 0 };
    // Reopen shape required by the stage-change trigger (00010): leaving a
    // closed stage clears closed_at in the SAME update (manager/admin at
    // the DB layer). The trigger manages closed_at/stage_entered_at too.
    if (fromClosed) patch.closed_at = null;
    if (opts.nextStepText !== undefined) patch.next_step_text = opts.nextStepText;
    if (opts.nextStepDue !== undefined) patch.next_step_due = opts.nextStepDue;

    const { error } = await ctx.supabase
      .from("deals")
      .update(patch)
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", dealId);
    if (error) throw error;

    const { error: hErr } = await ctx.supabase.from("stage_history").insert({
      deal_id: dealId,
      from_stage_id: deal.stage_id,
      to_stage_id: target.id,
      changed_by: ctx.user.id,
      workspace_id: ctx.workspaceId,
    });
    if (hErr) throw hErr;

    await insertAudit(ctx, "Move", "deal", dealId, {
      subject: deal.name,
      fromStage: fromSlug,
      toStage: toStageSlug,
      reason: opts.lostReason,
      competitor: opts.lostCompetitor,
    });
    if (toStageSlug === "lost" && opts.lostReason) {
      await ctx.supabase.from("activities").insert({
        type: "note",
        type_label: "Lost",
        subject: deal.name,
        body: `Marked lost: ${opts.lostReason}${opts.lostCompetitor ? ` · went with ${opts.lostCompetitor}` : ""}`,
        deal_id: dealId,
        owner_id: ctx.user.id,
        workspace_id: ctx.workspaceId,
      });
    }
    revalidateDeals();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDeal(dealId: string): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    const deal = await dealRow(ctx, dealId);
    const { error } = await ctx.supabase
      .from("deals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", dealId);
    if (error) throw error;
    await insertAudit(ctx, "Delete", "deal", dealId, { subject: deal.name });
    revalidateDeals();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const nextStepSchema = z.object({
  text: z.string().trim().max(500).nullable(),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export async function updateDealNextStep(
  dealId: string,
  step: z.infer<typeof nextStepSchema>,
): Promise<ActionResult> {
  try {
    const data = nextStepSchema.parse(step);
    const ctx = await getContext();
    await dealRow(ctx, dealId);
    const { error } = await ctx.supabase
      .from("deals")
      .update({ next_step_text: data.text, next_step_due: data.due })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", dealId);
    if (error) throw error;
    revalidateDeals();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- contacts & companies ---------------- */

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).default(""),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  title: z.string().trim().max(200).optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  prefers: z.string().trim().max(120).optional().nullable(),
  metThrough: z.string().trim().max(200).optional().nullable(),
});

export async function createContact(input: z.infer<typeof contactSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const data = contactSchema.parse(input);
    const ctx = await getContext();
    const { data: created, error } = await ctx.supabase
      .from("contacts")
      .insert({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email ?? null,
        phone: data.phone ?? null,
        title: data.title ?? null,
        company_id: data.companyId ?? null,
        prefers: data.prefers ?? null,
        met_through: data.metThrough ?? null,
        owner_id: ctx.user.id,
        created_by: ctx.user.id,
        workspace_id: ctx.workspaceId,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateDeals();
    return { ok: true, data: { id: created.id as string } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateContact(
  contactId: string,
  fields: Partial<z.infer<typeof contactSchema>>,
): Promise<ActionResult> {
  try {
    const data = contactSchema.partial().parse(fields);
    const ctx = await getContext();
    const patch: Row = {};
    if (data.firstName !== undefined) patch.first_name = data.firstName;
    if (data.lastName !== undefined) patch.last_name = data.lastName;
    if (data.email !== undefined) patch.email = data.email;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.title !== undefined) patch.title = data.title;
    if (data.companyId !== undefined) patch.company_id = data.companyId;
    if (data.prefers !== undefined) patch.prefers = data.prefers;
    if (data.metThrough !== undefined) patch.met_through = data.metThrough;
    const { error } = await ctx.supabase
      .from("contacts")
      .update(patch)
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", contactId);
    if (error) throw error;
    revalidateDeals();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const companySchema = z.object({
  name: z.string().trim().min(1).max(200),
  industry: z.string().trim().max(200).optional().nullable(),
  website: z.string().trim().max(300).optional().nullable(),
  sizeLabel: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
});

export async function createCompany(input: z.infer<typeof companySchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const data = companySchema.parse(input);
    const ctx = await getContext();
    const { data: created, error } = await ctx.supabase
      .from("companies")
      .insert({
        name: data.name,
        industry: data.industry ?? null,
        website: data.website ?? null,
        size_label: data.sizeLabel ?? null,
        city: data.city ?? null,
        owner_id: ctx.user.id,
        created_by: ctx.user.id,
        workspace_id: ctx.workspaceId,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidateDeals();
    return { ok: true, data: { id: created.id as string } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateCompany(
  companyId: string,
  fields: Partial<z.infer<typeof companySchema>>,
): Promise<ActionResult> {
  try {
    const data = companySchema.partial().parse(fields);
    const ctx = await getContext();
    const patch: Row = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.industry !== undefined) patch.industry = data.industry;
    if (data.website !== undefined) patch.website = data.website;
    if (data.sizeLabel !== undefined) patch.size_label = data.sizeLabel;
    if (data.city !== undefined) patch.city = data.city;
    const { error } = await ctx.supabase
      .from("companies")
      .update(patch)
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", companyId);
    if (error) throw error;
    revalidateDeals();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Link/unlink a contact to a deal with a role (deal page people). */
export async function setDealContact(
  dealId: string,
  contactId: string,
  role: string | null,
): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    await dealRow(ctx, dealId);
    const { error } = await ctx.supabase.from("deal_contacts").upsert(
      { deal_id: dealId, contact_id: contactId, role, workspace_id: ctx.workspaceId },
      { onConflict: "deal_id,contact_id" },
    );
    if (error) throw error;
    revalidateDeals();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- activities ---------------- */

const logActivitySchema = z.object({
  dealId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  /** UI label: Call | Email | Meeting | Note | Task. */
  type: z.enum(["Call", "Email", "Meeting", "Note", "Task"]),
  body: z.string().trim().max(4000).optional(),
  subject: z.string().trim().max(300).optional(),
  followUpDue: z.string().datetime().optional().nullable(),
  nextStepText: z.string().trim().max(500).optional(),
  nextStepDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export type LogActivityInput = z.infer<typeof logActivitySchema>;

const TYPE_ENUM: Record<string, string> = {
  Call: "call",
  Email: "email",
  Meeting: "meeting",
  Note: "note",
  Task: "note",
};

export async function logActivity(input: LogActivityInput): Promise<ActionResult<{ id: string }>> {
  try {
    const data = logActivitySchema.parse(input);
    const ctx = await getContext();
    const isFollowUp = data.type === "Task" || Boolean(data.followUpDue);
    const { data: created, error } = await ctx.supabase
      .from("activities")
      .insert({
        type: TYPE_ENUM[data.type],
        type_label: data.type,
        subject: data.subject ?? null,
        body: data.body ?? null,
        deal_id: data.dealId ?? null,
        contact_id: data.contactId ?? null,
        owner_id: ctx.user.id,
        is_follow_up: isFollowUp,
        due_at: data.followUpDue ?? null,
        workspace_id: ctx.workspaceId,
      })
      .select("id")
      .single();
    if (error) throw error;

    if (data.dealId && data.nextStepText) {
      await ctx.supabase
        .from("deals")
        .update({ next_step_text: data.nextStepText, next_step_due: data.nextStepDue ?? null })
        .eq("workspace_id", ctx.workspaceId)
        .eq("id", data.dealId);
    }
    revalidateDeals();
    return { ok: true, data: { id: created.id as string } };
  } catch (e) {
    return fail(e);
  }
}

export async function completeFollowUp(activityId: string): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    const { error } = await ctx.supabase
      .from("activities")
      .update({ completed_at: new Date().toISOString() })
      .eq("workspace_id", ctx.workspaceId)
      .eq("id", activityId);
    if (error) throw error;
    revalidateDeals();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- stages & settings ---------------- */

const stageUpdateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  winChance: z.number().int().min(0).max(100),
  requires: z.array(z.string().max(200)).max(8),
  staleLimitDays: z.number().int().min(1).max(365),
  position: z.number().int().min(0).max(50),
});

export async function updateStages(stages: z.infer<typeof stageUpdateSchema>[]): Promise<ActionResult> {
  try {
    const list = z.array(stageUpdateSchema).min(1).max(20).parse(stages);
    const ctx = await getContext();
    for (const s of list) {
      const { error } = await ctx.supabase
        .from("pipeline_stages")
        .update({
          name: s.name,
          default_probability: s.winChance,
          requires: s.requires,
          stale_limit_days: s.staleLimitDays,
          position: s.position,
        })
        .eq("workspace_id", ctx.workspaceId)
        .eq("slug", s.slug);
      if (error) throw error;
    }
    await insertAudit(ctx, "Update stages", "pipeline_stages", ctx.workspaceId, {
      subject: "Pipeline stages",
      stages: list.map((s) => s.slug),
    });
    revalidatePath("/app/settings/stages");
    revalidatePath("/app/pipeline");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const workspaceSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  scope: z.string().trim().max(80).optional(),
  staleLimitDays: z.number().int().min(1).max(365).optional(),
  staleLimitPendingDays: z.number().int().min(1).max(365).optional(),
});

export async function updateWorkspaceSettings(
  fields: z.infer<typeof workspaceSettingsSchema>,
): Promise<ActionResult> {
  try {
    const data = workspaceSettingsSchema.parse(fields);
    const ctx = await getContext();
    const patch: Row = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.scope !== undefined) patch.scope = data.scope;
    if (data.staleLimitDays !== undefined) patch.stale_limit_days = data.staleLimitDays;
    if (data.staleLimitPendingDays !== undefined) patch.stale_limit_pending_days = data.staleLimitPendingDays;
    const { error } = await ctx.supabase.from("workspaces").update(patch).eq("id", ctx.workspaceId);
    if (error) throw error;
    await insertAudit(ctx, "Update settings", "workspace", ctx.workspaceId, {
      subject: "Workspace settings",
      fields: Object.keys(patch),
    });
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- team ---------------- */

const inviteSchema = z.object({
  email: z.string().trim().email().max(200),
  role: z.enum(["Rep", "Manager", "Admin"]).default("Rep"),
});

export async function createInvite(input: z.infer<typeof inviteSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const data = inviteSchema.parse(input);
    const ctx = await getContext();
    const { data: created, error } = await ctx.supabase
      .from("invites")
      .insert({
        email: data.email,
        role: data.role.toLowerCase(),
        invited_by: ctx.user.id,
        workspace_id: ctx.workspaceId,
      })
      .select("id")
      .single();
    if (error) throw error;
    await insertAudit(ctx, "Invite", "invite", created.id as string, {
      subject: `Invited ${data.email} as a ${data.role}`,
    });
    revalidatePath("/app/settings/team");
    revalidatePath("/app/settings");
    return { ok: true, data: { id: created.id as string } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMemberRole(userId: string, roleLabel: string): Promise<ActionResult> {
  try {
    const role = z.enum(["Rep", "Manager", "Admin"]).parse(roleLabel).toLowerCase();
    const ctx = await getContext();
    const { error } = await ctx.supabase
      .from("workspace_members")
      .update({ role })
      .eq("workspace_id", ctx.workspaceId)
      .eq("user_id", userId);
    if (error) throw error;
    await insertAudit(ctx, "Role change", "workspace_member", userId, { subject: userId, role });
    revalidatePath("/app/settings/team");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- import ---------------- */

const importSchema = z.object({
  companies: z
    .array(z.object({ name: z.string().trim().min(1).max(200), industry: z.string().max(200).optional() }))
    .max(1000)
    .default([]),
  contacts: z
    .array(
      z.object({
        firstName: z.string().trim().min(1).max(120),
        lastName: z.string().trim().max(120).default(""),
        email: z.string().trim().max(200).optional(),
        phone: z.string().trim().max(60).optional(),
        title: z.string().trim().max(200).optional(),
        companyName: z.string().trim().max(200).optional(),
      }),
    )
    .max(1000)
    .default([]),
  deals: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        companyName: z.string().trim().max(200).optional(),
        value: z.number().min(0).default(0),
        stageSlug: z.string().default("new-lead"),
      }),
    )
    .max(1000)
    .default([]),
});

export type ImportInput = z.infer<typeof importSchema>;

export async function importRows(
  input: ImportInput,
): Promise<ActionResult<{ companies: number; contacts: number; deals: number; errors: string[] }>> {
  try {
    const data = importSchema.parse(input);
    const ctx = await getContext();
    const errors: string[] = [];
    const companyIdByName = new Map<string, string>();

    const { data: existingCompanies } = await ctx.supabase
      .from("companies")
      .select("id, name")
      .eq("workspace_id", ctx.workspaceId)
      .is("deleted_at", null);
    for (const c of existingCompanies ?? []) {
      companyIdByName.set(((c as Row).name as string).toLowerCase(), (c as Row).id as string);
    }

    let companiesAdded = 0;
    const ensureCompany = async (name: string, industry?: string): Promise<string | null> => {
      const key = name.toLowerCase();
      const found = companyIdByName.get(key);
      if (found) return found;
      const { data: created, error } = await ctx.supabase
        .from("companies")
        .insert({
          name,
          industry: industry ?? null,
          owner_id: ctx.user.id,
          created_by: ctx.user.id,
          workspace_id: ctx.workspaceId,
        })
        .select("id")
        .single();
      if (error || !created) {
        errors.push(`Company "${name}": ${error?.message ?? "insert failed"}`);
        return null;
      }
      companyIdByName.set(key, created.id as string);
      companiesAdded++;
      return created.id as string;
    };

    for (const c of data.companies) {
      await ensureCompany(c.name, c.industry);
    }

    let contactsAdded = 0;
    for (const [i, c] of data.contacts.entries()) {
      const companyId = c.companyName ? await ensureCompany(c.companyName) : null;
      const { error } = await ctx.supabase.from("contacts").insert({
        first_name: c.firstName,
        last_name: c.lastName,
        email: c.email ?? null,
        phone: c.phone ?? null,
        title: c.title ?? null,
        company_id: companyId,
        owner_id: ctx.user.id,
        created_by: ctx.user.id,
        workspace_id: ctx.workspaceId,
      });
      if (error) errors.push(`Contact row ${i + 1} (${c.firstName} ${c.lastName}): ${error.message}`);
      else contactsAdded++;
    }

    let dealsAdded = 0;
    for (const [i, d] of data.deals.entries()) {
      try {
        const stage = await stageRow(ctx, d.stageSlug);
        const companyId = d.companyName ? await ensureCompany(d.companyName) : null;
        const { error } = await ctx.supabase.from("deals").insert({
          name: d.name,
          company_id: companyId,
          stage_id: stage.id,
          value: d.value,
          owner_id: ctx.user.id,
          created_by: ctx.user.id,
          workspace_id: ctx.workspaceId,
          stage_entered_at: new Date().toISOString(),
        });
        if (error) errors.push(`Deal row ${i + 1} (${d.name}): ${error.message}`);
        else dealsAdded++;
      } catch (e) {
        errors.push(`Deal row ${i + 1} (${d.name}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await insertAudit(ctx, "Import", "import", ctx.workspaceId, {
      subject: "CSV import",
      companies: companiesAdded,
      contacts: contactsAdded,
      deals: dealsAdded,
      errors: errors.length,
    });
    revalidateDeals();
    return { ok: true, data: { companies: companiesAdded, contacts: contactsAdded, deals: dealsAdded, errors } };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------- attachments (metadata only; storage may not exist) ---------------- */

export async function recordAttachment(
  dealId: string,
  file: { fileName: string; mimeType: string; sizeBytes: number },
): Promise<ActionResult> {
  try {
    const ctx = await getContext();
    await dealRow(ctx, dealId);
    // No storage bucket is provisioned for this workspace's project from
    // the app side: check before recording any metadata row.
    const { data: buckets } = await ctx.supabase.storage.listBuckets();
    const bucket = (buckets ?? []).find((b) => b.id === "deal-attachments" || b.name === "deal-attachments");
    if (!bucket) {
      return { ok: false, error: "Storage is not configured for attachments yet — the file was not uploaded." };
    }
    const { error } = await ctx.supabase.from("deal_attachments").insert({
      deal_id: dealId,
      file_name: file.fileName,
      storage_path: `${ctx.workspaceId}/${dealId}/${file.fileName}`,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      uploaded_by: ctx.user.id,
      workspace_id: ctx.workspaceId,
    });
    if (error) throw error;
    revalidatePath(`/app/deals/${dealId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
