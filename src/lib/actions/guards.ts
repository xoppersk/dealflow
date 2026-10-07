/**
 * Role guards for Server Actions.
 *
 * Route-level gates live in `requireRole` (@/lib/auth); Server Actions can't
 * redirect, so these return `ActionResult`-shaped errors instead. Call one at
 * the top of every mutating action.
 */

import { getCurrentUser, isManagerOrAdmin, type SessionUser } from "@/lib/auth";

type GuardOk = { ok: true; me: SessionUser };
type GuardFail = { ok: false; error: "UNAUTHENTICATED" | "FORBIDDEN" };

/** Manager or admin required (reports, pipeline stages). */
export async function asManagerOrAdmin(): Promise<GuardOk | GuardFail> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "UNAUTHENTICATED" };
  if (!isManagerOrAdmin(me.profile.role)) return { ok: false, error: "FORBIDDEN" };
  return { ok: true, me };
}

/** Admin required (team, import, audit, workspace settings writes). */
export async function asAdmin(): Promise<GuardOk | GuardFail> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "UNAUTHENTICATED" };
  if (me.profile.role !== "admin") return { ok: false, error: "FORBIDDEN" };
  return { ok: true, me };
}
