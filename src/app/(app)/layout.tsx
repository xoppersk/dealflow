/**
 * Authenticated route group layout. Requires an active session; a signed-in
 * user whose profile is missing or deactivated is signed out and sent back
 * to /login with the deactivation notice.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { UserRow } from "@/lib/supabase/types";
import { Shell } from "@/components/shell/shell";

/**
 * Authenticated routes are per-user and per-request: navigations into (app)
 * are allowed to block on the session/profile read instead of prerendering.
 * (Next 16 validates instant navigations by default; instant = false opts the
 * whole (app) segment out of that validation.)
 */
export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const { data: profileRow } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .eq("is_active", true)
    .single();
  const profile = profileRow as UserRow | null;

  if (!profile) {
    // Signed in but no active profile (deactivated or never onboarded).
    await supabase.auth.signOut();
    redirect("/login?deactivated=1");
  }

  // Overdue follow-up count for the bell + Activities nav badge.
  const { count: overdueCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("is_follow_up", true)
    .is("completed_at", null)
    .lt("due_at", new Date().toISOString());

  return (
    <Shell
      user={{
        id: user.id,
        name: profile.full_name,
        email: profile.email,
        avatarUrl: profile.avatar_url,
        role: profile.role,
      }}
      overdueCount={overdueCount ?? 0}
    >
      {children}
    </Shell>
  );
}
