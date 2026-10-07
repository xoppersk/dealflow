"use server";

/**
 * Deal server actions — single-record reads, updates, deletes, reassignment
 * and linked contacts. RLS is the authorization layer; UI also gates by role.
 * Every mutation returns `ActionResult<T>`.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, isManagerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  ActivityRow,
  CompanyRow,
  ContactRow,
  DealAttachmentRow,
  DealContactRow,
  DealRow,
  PipelineStageRow,
  UserRow,
} from "@/lib/supabase/types";
import type { ActionResult } from "@/lib/types";

const DEAL_TYPES = ["new_business", "renewal", "expansion", "other"] as const;

export interface DealContactLink {
  contact: ContactRow;
  role: string | null;
}

export interface StageHistoryDisplay {
  id: string;
  fromStageName: string | null;
  toStageName: string;
  changedByName: string;
  changedAt: string;
}

export interface DealActivityDisplay extends ActivityRow {
  ownerName: string;
}

export interface DealDetailData {
  deal: DealRow;
  company: CompanyRow | null;
  owner: UserRow | null;
  stage: PipelineStageRow | null;
  contacts: DealContactLink[];
  attachments: DealAttachmentRow[];
  stageHistory: StageHistoryDisplay[];
  activities: DealActivityDisplay[];
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function signedIn() {
  const session = await getCurrentUser();
  if (!session) return { ok: false as const, error: "Not signed in." };
  return { ok: true as const, session };
}

/** Full deal detail: deal + company + owner + contacts + attachments + history. */
export async function getDeal(id: string): Promise<ActionResult<DealDetailData>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  if (!id) return { ok: false, error: "Deal id is required." };

  const supabase = await createClient();
  const { data: deal, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !deal) return { ok: false, error: "Deal not found." };
  const dealRow = deal as DealRow;

  const [companyRes, ownerRes, stageRes, contactsRes, attachmentsRes, historyRes, activitiesRes] =
    await Promise.all([
      dealRow.company_id
        ? supabase.from("companies").select("*").eq("id", dealRow.company_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("users").select("*").eq("id", dealRow.owner_id).single(),
      supabase.from("pipeline_stages").select("*").eq("id", dealRow.stage_id).single(),
      supabase
        .from("deal_contacts")
        .select("role, contact:contact_id (*)")
        .eq("deal_id", id),
      supabase
        .from("deal_attachments")
        .select("*")
        .eq("deal_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("stage_history")
        .select("*")
        .eq("deal_id", id)
        .order("changed_at", { ascending: false }),
      supabase
        .from("activities")
        .select("*, owner:owner_id (full_name)")
        .eq("deal_id", id)
        .order("occurred_at", { ascending: false })
        .limit(100),
    ]);

  const contacts: DealContactLink[] = ((contactsRes.data ?? []) as {
    role: string | null;
    contact: ContactRow | null;
  }[]).flatMap((l) => (l.contact ? [{ contact: l.contact, role: l.role }] : []));

  const stages = await supabase.from("pipeline_stages").select("id, name");
  const stageName = new Map(
    ((stages.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
  );
  const changerIds = [
    ...new Set(((historyRes.data ?? []) as { changed_by: string }[]).map((h) => h.changed_by)),
  ];
  const changers =
    changerIds.length > 0
      ? await supabase.from("users").select("id, full_name").in("id", changerIds)
      : { data: [] as { id: string; full_name: string }[] };
  const changerName = new Map(
    ((changers.data ?? []) as { id: string; full_name: string }[]).map((u) => [u.id, u.full_name]),
  );

  const stageHistory: StageHistoryDisplay[] = ((historyRes.data ?? []) as {
    id: string;
    from_stage_id: string | null;
    to_stage_id: string;
    changed_by: string;
    changed_at: string;
  }[]).map((h) => ({
    id: h.id,
    fromStageName: h.from_stage_id ? (stageName.get(h.from_stage_id) ?? "Unknown stage") : null,
    toStageName: stageName.get(h.to_stage_id) ?? "Unknown stage",
    changedByName: changerName.get(h.changed_by) ?? "Someone",
    changedAt: h.changed_at,
  }));

  const activities: DealActivityDisplay[] = ((activitiesRes.data ?? []) as (ActivityRow & {
    owner: { full_name: string } | null;
  })[]).map(({ owner, ...rest }) => ({
    ...rest,
    ownerName: owner?.full_name ?? "Someone",
  }));

  return {
    ok: true,
    data: {
      deal: dealRow,
      company: (companyRes.data ?? null) as CompanyRow | null,
      owner: (ownerRes.data ?? null) as UserRow | null,
      stage: (stageRes.data ?? null) as PipelineStageRow | null,
      contacts,
      attachments: ((attachmentsRes.data ?? []) as DealAttachmentRow[]),
      stageHistory,
      activities,
    },
  };
}

/** Stages ordered by position — feeds MoveStageMenu and the new-deal form. */
export async function listStages(): Promise<ActionResult<PipelineStageRow[]>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .order("position", { ascending: true });
  if (error) return { ok: false, error: "Could not load pipeline stages." };
  return { ok: true, data: (data ?? []) as PipelineStageRow[] };
}

const createDealSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  companyId: z.string().uuid().nullable().optional(),
  stageId: z.string().uuid(),
  value: z.number().min(0, "Value must be 0 or more."),
  currency: z.string().trim().min(1).max(3).default("USD"),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable().optional(),
  ownerId: z.string().uuid().optional(),
  dealType: z.enum(DEAL_TYPES).default("new_business"),
  source: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  contactIds: z.array(z.string().uuid()).max(50).optional(),
});

/** Create a deal; links contacts when provided (contact/company pages). */
export async function createDeal(
  input: z.input<typeof createDealSchema>,
): Promise<ActionResult<{ id: string }>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;

  const parsed = createDealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  if (v.closeDate && v.closeDate < todayLocal()) {
    return { ok: false, error: "Close date can't be in the past for an open deal." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({
      name: v.name,
      company_id: v.companyId ?? null,
      stage_id: v.stageId,
      value: v.value,
      currency: v.currency,
      probability: v.probability ?? null,
      close_date: v.closeDate ?? null,
      owner_id: v.ownerId ?? auth.session.id,
      deal_type: v.dealType,
      source: v.source ?? null,
      description: v.description ?? null,
      created_by: auth.session.id,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "Could not create the deal." };
  const dealId = (data as { id: string }).id;

  if (v.contactIds && v.contactIds.length > 0) {
    await supabase.from("deal_contacts").upsert(
      v.contactIds.map((contact_id) => ({ deal_id: dealId, contact_id })),
      { onConflict: "deal_id,contact_id", ignoreDuplicates: true },
    );
  }

  revalidatePath("/pipeline");
  return { ok: true, data: { id: dealId } };
}

const updateDealSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1, "Name is required.").max(200).optional(),
    value: z.number().min(0, "Value must be 0 or more.").optional(),
    probability: z.number().int().min(0).max(100).nullable().optional(),
    closeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable().optional(),
    dealType: z.enum(DEAL_TYPES).optional(),
    source: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    companyId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).some((k) => k !== "id"), {
    message: "Nothing to update.",
  });

export async function updateDeal(
  input: z.input<typeof updateDealSchema>,
): Promise<ActionResult<DealRow>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;

  const parsed = updateDealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, ...fields } = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("deals")
    .select("id, closed_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!current) return { ok: false, error: "Deal not found." };

  if (
    fields.closeDate !== undefined &&
    fields.closeDate !== null &&
    !(current as DealRow).closed_at &&
    fields.closeDate < todayLocal()
  ) {
    return { ok: false, error: "Close date can't be in the past for an open deal." };
  }

  const patch: Partial<DealRow> = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.value !== undefined) patch.value = fields.value;
  if (fields.probability !== undefined) patch.probability = fields.probability;
  if (fields.closeDate !== undefined) patch.close_date = fields.closeDate;
  if (fields.dealType !== undefined) patch.deal_type = fields.dealType;
  if (fields.source !== undefined) patch.source = fields.source;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.companyId !== undefined) patch.company_id = fields.companyId;

  const { data, error } = await supabase
    .from("deals")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "Could not save the deal." };
  revalidatePath(`/deals/${id}`);
  revalidatePath("/pipeline");
  return { ok: true, data: data as DealRow };
}

const deleteDealSchema = z.object({
  id: z.string().uuid(),
  /** Admins may hard-delete; everyone else soft-deletes. */
  hard: z.boolean().optional(),
});

/**
 * Soft-delete (sets deleted_at) for everyone; admins may hard-delete, which
 * writes an audit_log entry FIRST via the service-role client.
 */
export async function deleteDeal(
  input: z.input<typeof deleteDealSchema>,
): Promise<ActionResult<{ hard: boolean }>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const parsed = deleteDealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { id, hard } = parsed.data;
  const isAdmin = auth.session.profile.role === "admin";

  if (hard && isAdmin) {
    const admin = createServiceRoleClient();
    const { data: deal } = await admin.from("deals").select("id, name").eq("id", id).single();
    if (!deal) return { ok: false, error: "Deal not found." };
    const { error: auditError } = await admin.from("audit_log").insert({
      actor_id: auth.session.id,
      action: "deal.hard_delete",
      entity_type: "deal",
      entity_id: id,
      diff: { name: (deal as { name: string }).name },
    });
    if (auditError) return { ok: false, error: "Could not write the audit entry — delete aborted." };
    const { error } = await admin.from("deals").delete().eq("id", id);
    if (error) return { ok: false, error: "Could not delete the deal." };
    revalidatePath("/pipeline");
    return { ok: true, data: { hard: true } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not delete the deal." };
  revalidatePath("/pipeline");
  return { ok: true, data: { hard: false } };
}

const reopenDealSchema = z.object({
  id: z.string().uuid(),
  stageId: z.string().uuid(),
  reason: z.string().trim().min(1, "A reason is required.").max(500),
});

/**
 * Reopen a closed deal (manager/admin only): clears closed_at, moves it to
 * the chosen open stage, records stage history and an audit entry.
 */
export async function reopenDeal(
  input: z.input<typeof reopenDealSchema>,
): Promise<ActionResult<DealRow>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  if (!isManagerOrAdmin(auth.session.profile.role)) {
    return { ok: false, error: "Only managers and admins can reopen deals." };
  }

  const parsed = reopenDealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, stageId, reason } = parsed.data;

  const supabase = await createClient();
  const { data: stage } = await supabase
    .from("pipeline_stages")
    .select("id, name, is_closed_won, is_closed_lost")
    .eq("id", stageId)
    .single();
  if (!stage) return { ok: false, error: "Stage not found." };
  if ((stage as PipelineStageRow).is_closed_won || (stage as PipelineStageRow).is_closed_lost) {
    return { ok: false, error: "Reopen to an open stage, not a closed one." };
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, stage_id, version")
    .eq("id", id)
    .is("deleted_at", null)
    .not("closed_at", "is", null)
    .single();
  if (!deal) return { ok: false, error: "Deal not found or not closed." };

  const { data, error } = await supabase
    .from("deals")
    .update({
      stage_id: stageId,
      closed_at: null,
      stage_entered_at: new Date().toISOString(),
      version: (deal as DealRow).version + 1,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: "Could not reopen the deal." };

  await supabase.from("stage_history").insert({
    deal_id: id,
    from_stage_id: (deal as DealRow).stage_id,
    to_stage_id: stageId,
    changed_by: auth.session.id,
  });
  await supabase.from("audit_log").insert({
    actor_id: auth.session.id,
    action: "deal.reopen",
    entity_type: "deal",
    entity_id: id,
    diff: { reason, to_stage: (stage as PipelineStageRow).name },
  });

  revalidatePath(`/deals/${id}`);
  revalidatePath("/pipeline");
  return { ok: true, data: data as DealRow };
}

const reassignDealSchema = z.object({
  id: z.string().uuid(),
  newOwnerId: z.string().uuid(),
});

/** Manager/admin only. Records the reassignment in the audit trail. */
export async function reassignDeal(
  input: z.input<typeof reassignDealSchema>,
): Promise<ActionResult<{ ownerId: string }>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  if (!isManagerOrAdmin(auth.session.profile.role)) {
    return { ok: false, error: "Only managers and admins can reassign deals." };
  }

  const parsed = reassignDealSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { id, newOwnerId } = parsed.data;

  const supabase = await createClient();
  const { data: deal } = await supabase
    .from("deals")
    .select("id, owner_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!deal) return { ok: false, error: "Deal not found." };

  const { error } = await supabase.from("deals").update({ owner_id: newOwnerId }).eq("id", id);
  if (error) return { ok: false, error: "Could not reassign the deal." };

  await supabase.from("audit_log").insert({
    actor_id: auth.session.id,
    action: "deal.reassign",
    entity_type: "deal",
    entity_id: id,
    diff: { from: (deal as DealRow).owner_id, to: newOwnerId },
  });

  revalidatePath(`/deals/${id}`);
  revalidatePath("/pipeline");
  return { ok: true, data: { ownerId: newOwnerId } };
}

const dealContactSchema = z.object({
  dealId: z.string().uuid(),
  contactId: z.string().uuid(),
  role: z.string().trim().max(80).nullable().optional(),
});

/** Link a contact to a deal (idempotent). */
export async function addDealContact(
  input: z.input<typeof dealContactSchema>,
): Promise<ActionResult<DealContactRow>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const parsed = dealContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { dealId, contactId, role } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("deal_contacts").upsert(
    { deal_id: dealId, contact_id: contactId, role: role ?? null },
    { onConflict: "deal_id,contact_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false, error: "Could not link the contact." };
  revalidatePath(`/deals/${dealId}`);
  return { ok: true, data: { deal_id: dealId, contact_id: contactId, role: role ?? null, created_at: "" } };
}

/** Unlink a contact from a deal. */
export async function removeDealContact(input: {
  dealId: string;
  contactId: string;
}): Promise<ActionResult<null>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const parsed = z
    .object({ dealId: z.string().uuid(), contactId: z.string().uuid() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { dealId, contactId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("deal_contacts")
    .delete()
    .eq("deal_id", dealId)
    .eq("contact_id", contactId);
  if (error) return { ok: false, error: "Could not unlink the contact." };
  revalidatePath(`/deals/${dealId}`);
  return { ok: true, data: null };
}
