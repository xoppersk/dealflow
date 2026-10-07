"use server";

import Papa from "papaparse";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

import { asAdmin } from "./guards";

/**
 * CSV contact import (APP-FLOW.md Flow D, UI-DESIGN.md 2.15).
 *
 * Step 1 — parseCsvPreview: server-side Papa Parse, returns headers + the
 * first 5 rows + the total row count for the mapping UI.
 * Step 3 — importContacts: validates required first_name/last_name per row,
 * skips duplicate emails (against the DB and within the file) with warnings,
 * find-or-creates companies by name, and imports only the valid rows.
 * Row numbers in errors are 1-based data rows (header = row 0).
 */

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export interface CsvPreview {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export async function parseCsvPreview(input: {
  csvText: string;
}): Promise<ActionResult<CsvPreview>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const parsed = z
    .object({ csvText: z.string().min(1, "The file is empty").max(MAX_CSV_BYTES) })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }

  const result = Papa.parse<Record<string, string>>(parsed.data.csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    return { ok: false, error: "PARSE_ERROR" };
  }

  const headers = result.meta.fields ?? [];
  if (headers.length === 0) return { ok: false, error: "NO_COLUMNS" };

  return {
    ok: true,
    data: {
      headers,
      rows: result.data.slice(0, 5),
      totalRows: result.data.length,
    },
  };
}

const CONTACT_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "title",
  "company",
  "ignore",
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

const ImportContactsSchema = z.object({
  rows: z.array(z.record(z.string(), z.string())).min(1, "No rows to import").max(5000),
  mapping: z.record(z.string(), z.enum(CONTACT_FIELDS)),
});

export interface RowError {
  row: number;
  errors: string[];
}

export interface ImportSummary {
  imported: number;
  skipped: number;
  errors: RowError[];
  warnings: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function importContacts(
  input: z.input<typeof ImportContactsSchema>,
): Promise<ActionResult<ImportSummary>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const parsed = ImportContactsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }
  const { rows, mapping } = parsed.data;

  // Required fields must be mapped (and not to "ignore").
  const mappedFields = new Set(Object.values(mapping));
  const missing: string[] = [];
  if (!mappedFields.has("first_name")) missing.push("First name");
  if (!mappedFields.has("last_name")) missing.push("Last name");
  if (missing.length > 0) {
    return { ok: false, error: `MAPPING_INCOMPLETE: map ${missing.join(" and ")}` };
  }

  const supabase = await createClient();

  // Existing emails for duplicate detection (case-insensitive).
  const { data: existingContacts } = await supabase.from("contacts").select("email");
  const existingEmails = new Set(
    (existingContacts ?? [])
      .map((c) => c.email?.toLowerCase().trim())
      .filter((e): e is string => !!e),
  );

  interface ValidRow {
    row: number;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    companyName: string | null;
  }

  const errors: RowError[] = [];
  const warnings: string[] = [];
  const valid: ValidRow[] = [];
  const seenEmails = new Set<string>();

  rows.forEach((raw, index) => {
    const rowNumber = index + 1;
    const get = (field: ContactField): string => {
      const header = Object.keys(mapping).find((h) => mapping[h] === field);
      return header ? (raw[header] ?? "").trim() : "";
    };

    const firstName = get("first_name");
    const lastName = get("last_name");
    const email = get("email");
    const rowErrors: string[] = [];

    if (!firstName) rowErrors.push("Missing first name");
    if (!lastName) rowErrors.push("Missing last name");
    if (email && !EMAIL_RE.test(email)) rowErrors.push("Invalid email address");

    if (rowErrors.length > 0) {
      errors.push({ row: rowNumber, errors: rowErrors });
      return;
    }

    const normalizedEmail = email ? email.toLowerCase() : null;
    if (normalizedEmail) {
      if (existingEmails.has(normalizedEmail) || seenEmails.has(normalizedEmail)) {
        warnings.push(`Row ${rowNumber}: ${email} already exists — skipped`);
        return;
      }
      seenEmails.add(normalizedEmail);
    }

    valid.push({
      row: rowNumber,
      firstName,
      lastName,
      email: email || null,
      phone: get("phone") || null,
      title: get("title") || null,
      companyName: get("company") || null,
    });
  });

  // Find-or-create companies by name (case-insensitive).
  const companyNames = [...new Set(valid.map((v) => v.companyName).filter((n): n is string => !!n))];
  const companyIdByName = new Map<string, string>();
  if (companyNames.length > 0) {
    const { data: existingCompanies } = await supabase.from("companies").select("id, name");
    for (const c of existingCompanies ?? []) {
      companyIdByName.set(c.name.toLowerCase(), c.id);
    }
    for (const name of companyNames) {
      if (companyIdByName.has(name.toLowerCase())) continue;
      const { data: created, error } = await supabase
        .from("companies")
        .insert({ name, owner_id: guard.me.id, created_by: guard.me.id })
        .select("id")
        .single();
      if (error || !created) {
        warnings.push(`Company "${name}" could not be created — contacts import without it`);
        continue;
      }
      companyIdByName.set(name.toLowerCase(), created.id);
    }
  }

  let imported = 0;
  const BATCH = 100;
  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH);
    const { data: inserted, error } = await supabase
      .from("contacts")
      .insert(
        batch.map((v) => ({
          first_name: v.firstName,
          last_name: v.lastName,
          email: v.email,
          phone: v.phone,
          title: v.title,
          company_id: v.companyName
            ? (companyIdByName.get(v.companyName.toLowerCase()) ?? null)
            : null,
          owner_id: guard.me.id,
          created_by: guard.me.id,
        })),
      )
      .select("id");
    if (error) {
      // Batch failed — record per-row errors rather than silently dropping.
      for (const v of batch) {
        errors.push({ row: v.row, errors: ["Database insert failed"] });
      }
      continue;
    }
    imported += inserted?.length ?? 0;
  }

  await supabase.from("audit_log").insert({
    actor_id: guard.me.id,
    action: "contacts.imported",
    entity_type: "contact",
    entity_id: "00000000-0000-0000-0000-000000000000",
    diff: { imported, skipped: rows.length - imported },
  });

  return {
    ok: true,
    data: {
      imported,
      skipped: rows.length - imported,
      errors,
      warnings,
    },
  };
}
