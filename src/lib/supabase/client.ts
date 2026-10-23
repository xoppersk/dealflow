"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side Supabase client (singleton per page load). Used by auth forms,
 * invite acceptance, and realtime subscriptions. Requires the public anon key.
 */
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, anon);
  }
  return browserClient;
}
