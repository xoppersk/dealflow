/**
 * Open-redirect guard for auth `next` parameters: only same-origin
 * absolute paths are honoured; anything else falls back.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/app"): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")) {
    return raw;
  }
  return fallback;
}

/** Absolute app origin for building Supabase redirectTo URLs. */
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3104";
}
