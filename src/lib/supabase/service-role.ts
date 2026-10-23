import { createClient } from "@supabase/supabase-js";

/**
 * SERVER ONLY — never import from a Client Component or any module that
 * ships to the browser. (The `server-only` guard package is not installed
 * in this project; this warning is the guard. The key below is full
 * database access and must never leak.)
 *
 * Service-role Supabase client — bypasses Row Level Security. Use ONLY
 * for operations that cannot run as the signed-in user: the invite flow
 * (an unauthenticated invitee cannot read the workspace-scoped invites
 * table) and admin operations. Authorization is re-checked by hand in
 * every caller (see src/app/accept/actions.ts).
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local (see .env.example).",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
