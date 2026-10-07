/**
 * Workspace settings model (shared, no "use server").
 *
 * Persisted in public.app_settings as key/value rows (migration 00011).
 * Imported by the settings Server Actions and by client components alike.
 */

export interface WorkspaceSettings {
  workspaceName: string;
  defaultCurrency: string;
  staleThresholdDays: number;
  digestEnabled: boolean;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  workspaceName: "My workspace",
  defaultCurrency: "USD",
  staleThresholdDays: 14,
  digestEnabled: true,
};

export const KEY_TO_FIELD: Record<string, keyof WorkspaceSettings> = {
  workspace_name: "workspaceName",
  default_currency: "defaultCurrency",
  stale_threshold_days: "staleThresholdDays",
  digest_enabled: "digestEnabled",
};

export const FIELD_TO_KEY: Record<keyof WorkspaceSettings, string> = {
  workspaceName: "workspace_name",
  defaultCurrency: "default_currency",
  staleThresholdDays: "stale_threshold_days",
  digestEnabled: "digest_enabled",
};

export function coerceSettingValue(
  field: keyof WorkspaceSettings,
  raw: unknown,
): WorkspaceSettings[keyof WorkspaceSettings] {
  switch (field) {
    case "workspaceName":
      return typeof raw === "string" && raw.trim() ? raw : DEFAULT_SETTINGS.workspaceName;
    case "defaultCurrency":
      return typeof raw === "string" && /^[A-Za-z]{3}$/.test(raw)
        ? raw.toUpperCase()
        : DEFAULT_SETTINGS.defaultCurrency;
    case "staleThresholdDays": {
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isInteger(n) && n >= 1 && n <= 90 ? n : DEFAULT_SETTINGS.staleThresholdDays;
    }
    case "digestEnabled":
      return typeof raw === "boolean" ? raw : DEFAULT_SETTINGS.digestEnabled;
  }
}
