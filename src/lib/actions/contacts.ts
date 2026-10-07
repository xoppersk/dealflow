"use server";

/**
 * Contact server actions — keyset-paginated list, detail reads, create with
 * non-blocking duplicate-email warning, update, and soft delete that reports
 * the linked-deal count so the UI can confirm.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityRow,
  CompanyRow,
  ContactRow,
  DealRow,
  UserRow,
} from "@/lib/supabase/types";
import type { ActionResult } from "@/lib/types";

const PAGE_SIZE = 25;

async function signedIn() {
  const session = await getCurrentUser();
  if (!session) return { ok: false as const, error: "Not signed in." };
  return { ok: true as const, session };
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const sep = decoded.indexOf("|");
    if (sep < 0) return null;
    return { createdAt: decoded.slice(0, sep), id: decoded.slice(sep + 1) };
  } catch {
    return null;
  }
}

export interface ContactListItem extends ContactRow {
  companyName: string | null;
  ownerName: string | null;
}

export interface ContactListData {
  items: ContactListItem[];
  nextCursor: string | null;
}

const listContactsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  ownerId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  cursor: z.string().optional(),
});

/**
 * Keyset pagination (25/page) over (created_at desc, id desc), RLS-filtered.
 * Returns `nextCursor` for the following page; null when exhausted.
 */
export async function listContacts(
  input: z.input<typeof listContactsSchema>,
): Promise<ActionResult<ContactListData>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const parsed = listContactsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { q, ownerId, companyId, cursor } = parsed.data;

  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("*, company:company_id (id, name), owner:owner_id (full_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (q) {
    const term = q.replace(/[%_,]/g, "").trim();
    if (term) {
      query = query.or(
        `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
  }
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (companyId) query = query.eq("company_id", companyId);
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return { ok: false, error: "Invalid cursor." };
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: "Could not load contacts." };

  const rows = (data ?? []) as (ContactRow & {
    company: { id: string; name: string } | null;
    owner: { full_name: string } | null;
  })[];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = page[page.length - 1];

  return {
    ok: true,
    data: {
      items: page.map(({ company, owner, ...rest }) => ({
        ...rest,
        companyName: company?.name ?? null,
        ownerName: owner?.full_name ?? null,
      })),
      nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
    },
  };
}

export interface ContactDealLink {
  deal: DealRow & { stageName: string | null; stageColor: string | null };
  role: string | null;
}

export interface ContactDetailData {
  contact: ContactRow;
  company: CompanyRow | null;
  owner: UserRow | null;
  deals: ContactDealLink[];
  activities: (ActivityRow & { ownerName: string; dealName: string | null })[];
}

/** Full contact detail: profile + company + linked deals + activities. */
export async function getContact(id: string): Promise<ActionResult<ContactDetailData>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  if (!id) return { ok: false, error: "Contact id is required." };

  const supabase = await createClient();
  const { data: contact, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error || !contact) return { ok: false, error: "Contact not found." };
  const contactRow = contact as ContactRow;

  const [companyRes, ownerRes, dealsRes, activitiesRes] = await Promise.all([
    contactRow.company_id
      ? supabase.from("companies").select("*").eq("id", contactRow.company_id).single()
      : Promise.resolve({ data: null }),
    contactRow.owner_id
      ? supabase.from("users").select("*").eq("id", contactRow.owner_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("deal_contacts")
      .select("role, deal:deal_id (id, name, value, currency, stage_id, owner_id, closed_at, deleted_at, stage:stage_id (name, color))")
      .eq("contact_id", id),
    supabase
      .from("activities")
      .select("*, owner:owner_id (full_name), deal:deal_id (name)")
      .eq("contact_id", id)
      .order("occurred_at", { ascending: false })
      .limit(100),
  ]);

  const deals: ContactDealLink[] = ((dealsRes.data ?? []) as {
    role: string | null;
    deal: (DealRow & { stage: { name: string; color: string } | null }) | null;
  }[]).flatMap((l) => {
    if (!l.deal || l.deal.deleted_at) return [];
    const { stage, ...dealRest } = l.deal;
    return [{ deal: { ...dealRest, stageName: stage?.name ?? null, stageColor: stage?.color ?? null }, role: l.role }];
  });

  const activities = ((activitiesRes.data ?? []) as (ActivityRow & {
    owner: { full_name: string } | null;
    deal: { name: string } | null;
  })[]).map(({ owner, deal, ...rest }) => ({
    ...rest,
    ownerName: owner?.full_name ?? "Someone",
    dealName: deal?.name ?? null,
  }));

  return {
    ok: true,
    data: {
      contact: contactRow,
      company: (companyRes.data ?? null) as CompanyRow | null,
      owner: (ownerRes.data ?? null) as UserRow | null,
      deals,
      activities,
    },
  };
}

export interface DuplicateWarning {
  id: string;
  name: string;
  email: string | null;
}

/** Non-mutating duplicate-email lookup for the pre-submit warning. */
export async function checkContactEmail(email: string): Promise<ActionResult<DuplicateWarning | null>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  if (!z.string().email().safeParse(email).success) return { ok: true, data: null };
  const duplicate = await findDuplicateEmail(email);
  return { ok: true, data: duplicate };
}

export type CreateContactResult = ActionResult<ContactRow> & {
  duplicateWarning?: DuplicateWarning;
};

const contactFieldsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z.string().trim().email("Enter a valid email.").max(255).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  companyId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().optional(),
});

async function findDuplicateEmail(
  email: string,
  excludeId?: string,
): Promise<DuplicateWarning | null> {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email")
    .ilike("email", email)
    .is("deleted_at", null)
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  const hit = (data ?? [])[0] as
    | { id: string; first_name: string; last_name: string; email: string | null }
    | undefined;
  if (!hit) return null;
  return {
    id: hit.id,
    name: `${hit.first_name} ${hit.last_name}`.trim(),
    email: hit.email,
  };
}

/**
 * Create a contact. A duplicate email is a NON-BLOCKING warning — the
 * contact is still created and `duplicateWarning` names the existing record
 * so the UI can offer "View existing".
 */
export async function createContact(
  input: z.input<typeof contactFieldsSchema>,
): Promise<CreateContactResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;

  const parsed = contactFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      first_name: v.firstName,
      last_name: v.lastName,
      email: v.email ?? null,
      phone: v.phone ?? null,
      title: v.title ?? null,
      company_id: v.companyId ?? null,
      owner_id: v.ownerId ?? auth.session.id,
      created_by: auth.session.id,
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "Could not create the contact." };

  const result: CreateContactResult = { ok: true, data: data as ContactRow };
  if (v.email) {
    const duplicate = await findDuplicateEmail(v.email, (data as ContactRow).id);
    if (duplicate) result.duplicateWarning = duplicate;
  }

  revalidatePath("/contacts");
  return result;
}

const updateContactSchema = contactFieldsSchema
  .partial()
  .extend({ id: z.string().uuid() })
  .refine((v) => Object.keys(v).some((k) => k !== "id"), {
    message: "Nothing to update.",
  });

export async function updateContact(
  input: z.input<typeof updateContactSchema>,
): Promise<CreateContactResult> {
  const auth = await signedIn();
  if (!auth.ok) return auth;

  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, ...fields } = parsed.data;

  const patch: Partial<ContactRow> = {};
  if (fields.firstName !== undefined) patch.first_name = fields.firstName;
  if (fields.lastName !== undefined) patch.last_name = fields.lastName;
  if (fields.email !== undefined) patch.email = fields.email;
  if (fields.phone !== undefined) patch.phone = fields.phone;
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.companyId !== undefined) patch.company_id = fields.companyId;
  if (fields.ownerId !== undefined) patch.owner_id = fields.ownerId;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "Could not save the contact." };

  const result: CreateContactResult = { ok: true, data: data as ContactRow };
  if (fields.email) {
    const duplicate = await findDuplicateEmail(fields.email, id);
    if (duplicate) result.duplicateWarning = duplicate;
  }

  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
  return result;
}

/**
 * Soft-delete a contact. Returns the linked (non-deleted) deal count so the
 * UI can confirm ("This contact is linked to N deals") before deleting.
 */
export async function deleteContact(
  id: string,
): Promise<ActionResult<{ linkedDealCount: number }>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  if (!id) return { ok: false, error: "Contact id is required." };

  const supabase = await createClient();
  const { data: links } = await supabase
    .from("deal_contacts")
    .select("deal:deal_id (deleted_at)")
    .eq("contact_id", id);
  const linkedDealCount = ((links ?? []) as { deal: { deleted_at: string | null } | null }[]).filter(
    (l) => l.deal && !l.deal.deleted_at,
  ).length;

  const { error } = await supabase
    .from("contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not delete the contact." };

  revalidatePath("/contacts");
  return { ok: true, data: { linkedDealCount } };
}

/** Active users for owner filters and selects (RLS-filtered). */
export async function listActiveUsers(): Promise<ActionResult<UserRow[]>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) return { ok: false, error: "Could not load users." };
  return { ok: true, data: (data ?? []) as UserRow[] };
}
