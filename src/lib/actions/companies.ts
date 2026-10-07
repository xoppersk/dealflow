"use server";

/**
 * Company server actions — list with aggregated open-deal value + contact
 * count, detail reads, create/update, and soft delete that NULLs linked
 * foreign keys (per schema) while reporting the affected counts for the
 * confirmation UI.
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

export interface CompanyListItem extends CompanyRow {
  openDealValue: number;
  contactCount: number;
}

export interface CompanyListData {
  items: CompanyListItem[];
  nextCursor: string | null;
}

const listCompaniesSchema = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.string().optional(),
});

/**
 * Keyset pagination (25/page) with aggregated open deal value and contact
 * count per company. Open = not deleted, not closed.
 */
export async function listCompanies(
  input: z.input<typeof listCompaniesSchema>,
): Promise<ActionResult<CompanyListData>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  const parsed = listCompaniesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const { q, cursor } = parsed.data;

  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select("*, owner:owner_id (full_name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (q) {
    const term = q.replace(/[%_,]/g, "").trim();
    if (term) query = query.or(`name.ilike.%${term}%,industry.ilike.%${term}%`);
  }
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (!decoded) return { ok: false, error: "Invalid cursor." };
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: "Could not load companies." };

  const rows = (data ?? []) as (CompanyRow & { owner: { full_name: string } | null })[];
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const ids = page.map((c) => c.id);

  const dealValueByCompany = new Map<string, number>();
  const contactCountByCompany = new Map<string, number>();
  if (ids.length > 0) {
    const [dealsRes, contactsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("company_id, value")
        .in("company_id", ids)
        .is("deleted_at", null)
        .is("closed_at", null),
      supabase.from("contacts").select("company_id").in("company_id", ids).is("deleted_at", null),
    ]);
    for (const d of ((dealsRes.data ?? []) as { company_id: string | null; value: number }[])) {
      if (!d.company_id) continue;
      dealValueByCompany.set(d.company_id, (dealValueByCompany.get(d.company_id) ?? 0) + d.value);
    }
    for (const c of ((contactsRes.data ?? []) as { company_id: string | null }[])) {
      if (!c.company_id) continue;
      contactCountByCompany.set(c.company_id, (contactCountByCompany.get(c.company_id) ?? 0) + 1);
    }
  }

  const last = page[page.length - 1];
  return {
    ok: true,
    data: {
      items: page.map(({ owner: _owner, ...rest }) => ({
        ...rest,
        openDealValue: dealValueByCompany.get(rest.id) ?? 0,
        contactCount: contactCountByCompany.get(rest.id) ?? 0,
      })),
      nextCursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
    },
  };
}

export interface CompanyDealDisplay extends DealRow {
  stageName: string | null;
  stageColor: string | null;
  ownerName: string | null;
}

export interface CompanyDetailData {
  company: CompanyRow;
  owner: UserRow | null;
  deals: CompanyDealDisplay[];
  contacts: ContactRow[];
  activities: (ActivityRow & { ownerName: string; dealName: string | null })[];
}

/** Full company detail: account view of deals, contacts, activities. */
export async function getCompany(id: string): Promise<ActionResult<CompanyDetailData>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  if (!id) return { ok: false, error: "Company id is required." };

  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (error || !company) return { ok: false, error: "Company not found." };
  const companyRow = company as CompanyRow;

  const [ownerRes, dealsRes, contactsRes] = await Promise.all([
    companyRow.owner_id
      ? supabase.from("users").select("*").eq("id", companyRow.owner_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("deals")
      .select("*, stage:stage_id (name, color), dealOwner:owner_id (full_name)")
      .eq("company_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("*")
      .eq("company_id", id)
      .is("deleted_at", null)
      .order("last_name", { ascending: true }),
  ]);

  const deals = ((dealsRes.data ?? []) as (DealRow & {
    stage: { name: string; color: string } | null;
    dealOwner: { full_name: string } | null;
  })[]).map(({ stage, dealOwner, ...rest }) => ({
    ...rest,
    stageName: stage?.name ?? null,
    stageColor: stage?.color ?? null,
    ownerName: dealOwner?.full_name ?? null,
  }));

  const dealIds = deals.map((d) => d.id);
  const activitiesRes =
    dealIds.length > 0
      ? await supabase
          .from("activities")
          .select("*, owner:owner_id (full_name), deal:deal_id (name)")
          .in("deal_id", dealIds)
          .order("occurred_at", { ascending: false })
          .limit(100)
      : { data: [] as never[] };

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
      company: companyRow,
      owner: (ownerRes.data ?? null) as UserRow | null,
      deals,
      contacts: ((contactsRes.data ?? []) as ContactRow[]),
      activities,
    },
  };
}

const companyFieldsSchema = z.object({
  name: z.string().trim().min(1, "Company name is required.").max(200),
  industry: z.string().trim().max(120).nullable().optional(),
  website: z
    .string()
    .trim()
    .max(255)
    .nullable()
    .optional()
    .refine((v) => !v || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(v), {
      message: "Enter a valid website.",
    }),
  size: z.string().trim().max(60).nullable().optional(),
  ownerId: z.string().uuid().optional(),
});

export async function createCompany(
  input: z.input<typeof companyFieldsSchema>,
): Promise<ActionResult<CompanyRow>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;

  const parsed = companyFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: v.name,
      industry: v.industry ?? null,
      website: v.website ?? null,
      size: v.size ?? null,
      owner_id: v.ownerId ?? auth.session.id,
      created_by: auth.session.id,
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "Could not create the company." };
  revalidatePath("/companies");
  return { ok: true, data: data as CompanyRow };
}

const updateCompanySchema = companyFieldsSchema
  .partial()
  .extend({ id: z.string().uuid() })
  .refine((v) => Object.keys(v).some((k) => k !== "id"), {
    message: "Nothing to update.",
  });

export async function updateCompany(
  input: z.input<typeof updateCompanySchema>,
): Promise<ActionResult<CompanyRow>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;

  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, ...fields } = parsed.data;

  const patch: Partial<CompanyRow> = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.industry !== undefined) patch.industry = fields.industry;
  if (fields.website !== undefined) patch.website = fields.website;
  if (fields.size !== undefined) patch.size = fields.size;
  if (fields.ownerId !== undefined) patch.owner_id = fields.ownerId;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("companies")
    .update(patch)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: "Could not save the company." };
  revalidatePath(`/companies/${id}`);
  revalidatePath("/companies");
  return { ok: true, data: data as CompanyRow };
}

/**
 * Soft-delete a company. Linked contacts and deals keep their records with
 * the company FK NULLed (per schema); returns the affected counts so the UI
 * can confirm before deleting.
 */
export async function deleteCompany(
  id: string,
): Promise<ActionResult<{ contactCount: number; dealCount: number }>> {
  const auth = await signedIn();
  if (!auth.ok) return auth;
  if (!id) return { ok: false, error: "Company id is required." };

  const supabase = await createClient();
  const [contactsRes, dealsRes] = await Promise.all([
    supabase.from("contacts").select("id").eq("company_id", id).is("deleted_at", null),
    supabase.from("deals").select("id").eq("company_id", id).is("deleted_at", null),
  ]);
  const contactCount = (contactsRes.data ?? []).length;
  const dealCount = (dealsRes.data ?? []).length;

  const { error: nullContactsError } = await supabase
    .from("contacts")
    .update({ company_id: null })
    .eq("company_id", id);
  if (nullContactsError) return { ok: false, error: "Could not unlink contacts." };

  const { error: nullDealsError } = await supabase
    .from("deals")
    .update({ company_id: null })
    .eq("company_id", id);
  if (nullDealsError) return { ok: false, error: "Could not unlink deals." };

  const { error } = await supabase
    .from("companies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not delete the company." };

  revalidatePath("/companies");
  return { ok: true, data: { contactCount, dealCount } };
}
