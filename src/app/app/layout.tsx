import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/df/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getDataset } from "@/lib/df/db";
import type { Dataset } from "@/lib/df/types";

/**
 * /app layout — server-side auth enforcement (the root middleware guards
 * too; this is the check that cannot be bypassed at the edge). Signed-in
 * users also get the belt-and-braces ensure_workspace() call so a
 * personal workspace exists even if the signup trigger was bypassed
 * (e.g. invite-created accounts) — the DB trigger normally provisions it.
 */
export default async function AppGroupLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  try {
    // Tolerant by design: the RPC may not exist yet (W1 migration in
    // flight) — PostgREST reports it as an error result, not a throw,
    // and either way the app must still render.
    await supabase.rpc("ensure_workspace");
  } catch {
    // Workspace provisioning falls back to the signup trigger.
  }

  // Coordinator integration (2026-10-22): hand the shell the real dataset
  // (React-cached — the pages read the same snapshot) so the brand
  // subtitle, tab counts, presence stack, user menu and ⌘K palette all
  // run on live data. Tolerant: if the dataset read fails, the shell
  // renders its no-dataset fallback and pages still load their own data.
  let dataset: Dataset | undefined;
  try {
    dataset = await getDataset();
  } catch {
    dataset = undefined;
  }

  return <AppShell dataset={dataset}>{children}</AppShell>;
}
