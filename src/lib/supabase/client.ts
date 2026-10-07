"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

/**
 * Browser-side Supabase client (safe to call in Client Components).
 * Uses the public anon key — PostgreSQL Row Level Security applies to
 * every query, so the client can never see rows its policies forbid.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
