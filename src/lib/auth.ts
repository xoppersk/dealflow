import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { UserRole, UserRow } from "@/lib/supabase/types";

export interface SessionUser {
  id: string;
  email: string;
  profile: UserRow;
}

/**
 * Returns the signed-in user + their `public.users` profile row, or null.
 * Role is read from PostgreSQL on every call (single source of truth —
 * no stale JWT claims after a role change).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .eq("is_active", true)
    .single();

  if (!profile) return null;
  return { id: user.id, email: user.email, profile: profile as UserRow };
}

/** Redirects to /login when there is no active session. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  return session;
}

/**
 * Redirects to /login when signed out, or renders the 403 page when the
 * caller's role is not in the allowed list. RLS still enforces data access;
 * this is the route-level gate.
 */
export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const session = await requireUser();
  if (!roles.includes(session.profile.role)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return session;
}

export function isManagerOrAdmin(role: UserRole): boolean {
  return role === "manager" || role === "admin";
}
