"use server";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

import { asAdmin } from "./guards";
import {
  DEFAULT_SETTINGS,
  FIELD_TO_KEY,
  KEY_TO_FIELD,
  coerceSettingValue,
  type WorkspaceSettings,
} from "./settings-model";

export type { WorkspaceSettings };

/**
 * Workspace settings (migration 00011: public.app_settings key/value store).
 * Readable by every signed-in user; writable by admins only.
 */

/** Every signed-in user may read workspace settings. */
export async function getWorkspaceSettings(): Promise<ActionResult<WorkspaceSettings>> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "UNAUTHENTICATED" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) return { ok: false, error: "LOAD_FAILED" };

  const settings: WorkspaceSettings = { ...DEFAULT_SETTINGS };
  for (const row of data ?? []) {
    const field = KEY_TO_FIELD[row.key];
    if (!field) continue;
    const coerced = coerceSettingValue(field, row.value);
    if (field === "workspaceName") settings.workspaceName = coerced as string;
    else if (field === "defaultCurrency") settings.defaultCurrency = coerced as string;
    else if (field === "staleThresholdDays") settings.staleThresholdDays = coerced as number;
    else settings.digestEnabled = coerced as boolean;
  }
  return { ok: true, data: settings };
}

const UpdateSettingsSchema = z.object({
  workspaceName: z.string().trim().min(1, "Workspace name is required").max(80),
  defaultCurrency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, "Use a 3-letter currency code")
    .transform((s) => s.toUpperCase()),
  staleThresholdDays: z.coerce.number().int().min(1).max(90),
  digestEnabled: z.boolean(),
});

export type UpdateSettingsInput = z.input<typeof UpdateSettingsSchema>;

/** Admin only. Persists each field as a key/value row (upsert). */
export async function updateWorkspaceSettings(
  input: UpdateSettingsInput,
): Promise<ActionResult<WorkspaceSettings>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const parsed = UpdateSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }
  const values = parsed.data;

  const supabase = await createClient();
  for (const field of Object.keys(FIELD_TO_KEY) as (keyof WorkspaceSettings)[]) {
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: FIELD_TO_KEY[field], value: values[field] }, { onConflict: "key" });
    if (error) return { ok: false, error: "SAVE_FAILED" };
  }

  await supabase.from("audit_log").insert({
    actor_id: guard.me.id,
    action: "settings.updated",
    entity_type: "workspace_settings",
    entity_id: "00000000-0000-0000-0000-000000000000",
    diff: {
      staleThresholdDays: values.staleThresholdDays,
      digestEnabled: values.digestEnabled,
    },
  });

  return { ok: true, data: values };
}
