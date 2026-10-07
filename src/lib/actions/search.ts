"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, SearchKind, SearchResultItem } from "@/lib/types";
import type { Database } from "@/lib/supabase/types";

/**
 * Global search (powers the ⌘K command palette). Delegates to the
 * `search_all(p_query text)` Postgres function — full-text search across
 * deals, contacts, and companies, ranked and limited to 15 rows.
 * The RPC is SECURITY INVOKER, so RLS applies to the underlying tables.
 *
 * NOTE on `db()`: the checked-in Database type is incompatible with
 * supabase-js 2.117's GenericTable for two reasons — its tables lack
 * `Relationships`, and its row types are `interface`s (interfaces lack the
 * implicit index signature `Row: Record<string, unknown>` requires). Table
 * queries therefore infer `never`. This local shim restores the intended
 * shape. The durable fix is regenerating src/lib/supabase/types.ts (or
 * switching row types to `type` aliases and adding `Relationships: []`
 * per table) — that un-breaks every agent's action files at once.
 */
type Tables = Database["public"]["Tables"];
type FixedDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: {
      [K in keyof Tables]: {
        // Mapped (not interface): interfaces lack implicit index signatures,
        // which GenericTable's `Row: Record<string, unknown>` requires.
        Row: { [P in keyof Tables[K]["Row"]]: Tables[K]["Row"][P] };
        Insert: Tables[K]["Insert"];
        Update: Tables[K]["Update"];
        Relationships: [];
      };
    };
  };
};

async function db(): Promise<SupabaseClient<FixedDatabase>> {
  return (await createClient()) as unknown as SupabaseClient<FixedDatabase>;
}

const SEARCH_KINDS: readonly SearchKind[] = ["deal", "contact", "company"];

export async function searchGlobal(query: string): Promise<ActionResult<SearchResultItem[]>> {
  const q = query.trim();
  if (q.length < 3) return { ok: true, data: [] };

  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await db();

  // The checked-in DB types still carry the placeholder arg name (`query`);
  // the migration defines search_all(p_query text). The cast only satisfies
  // the stale type — the runtime sends p_query.
  const args = { p_query: q } as unknown as Database["public"]["Functions"]["search_all"]["Args"];
  const { data, error } = await supabase.rpc("search_all", args);

  if (error) return { ok: false, error: error.message };

  const items: SearchResultItem[] = (data ?? [])
    .filter((row) => SEARCH_KINDS.includes(row.kind as SearchKind))
    .map((row) => ({
      kind: row.kind as SearchKind,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle ?? null,
    }));

  return { ok: true, data: items };
}
