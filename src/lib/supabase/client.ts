"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (safe to call in Client Components).
 * Uses the public anon key — PostgreSQL Row Level Security applies to
 * every query, so the client can never see rows its policies forbid.
 *
 * Untyped on purpose: v1's generated `Database` type describes the old
 * single-tenant schema. The data team owns data typing for v2.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
