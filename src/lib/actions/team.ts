"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { UserRole } from "@/lib/supabase/types";
import type { ActionResult } from "@/lib/types";

import { asAdmin } from "./guards";

/**
 * User management (APP-FLOW.md /settings/team, UI-DESIGN.md 2.14).
 *
 * Admin only, end to end. Invites are created through the service-role key
 * (the invites table has no INSERT grant for app roles). Actually sending the
 * Resend email is stubbed — the action logs the invite link and returns it so
 * the UI can show "copy invite link" until the mailer is wired.
 */

export type InviteStatus = "active" | "invited" | "deactivated";

export interface TeamUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  inviteStatus: InviteStatus;
  openDealCount: number;
}

export interface PendingInvite {
  id: string;
  email: string;
  role: UserRole;
  expiresAt: string;
  invitedByName: string;
}

export interface TeamList {
  users: TeamUser[];
  /** Invites for emails that have no users row yet (haven't signed up). */
  pendingInvites: PendingInvite[];
}

export async function listUsers(): Promise<ActionResult<TeamList>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const supabase = await createClient();
  const [{ data: users }, { data: invites }, { data: deals }] = await Promise.all([
    supabase.from("users").select("*").order("full_name"),
    supabase
      .from("invites")
      .select("id, email, role, expires_at, accepted_at, invited_by")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabase.from("deals").select("owner_id"),
  ]);
  if (!users || !invites || !deals) return { ok: false, error: "LOAD_FAILED" };

  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const pendingByEmail = new Map(invites.map((i) => [i.email.toLowerCase(), i]));
  const openDealsByOwner = new Map<string, number>();
  for (const d of deals) {
    openDealsByOwner.set(d.owner_id, (openDealsByOwner.get(d.owner_id) ?? 0) + 1);
  }

  const teamUsers: TeamUser[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    isActive: u.is_active,
    avatarUrl: u.avatar_url,
    lastSignInAt: u.last_sign_in_at,
    createdAt: u.created_at,
    inviteStatus: !u.is_active
      ? "deactivated"
      : pendingByEmail.has(u.email.toLowerCase())
        ? "invited"
        : "active",
    openDealCount: openDealsByOwner.get(u.id) ?? 0,
  }));

  const pendingInvites: PendingInvite[] = invites
    .filter((i) => !userByEmail.has(i.email.toLowerCase()))
    .map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expires_at,
      invitedByName: userById.get(i.invited_by)?.full_name ?? "Unknown",
    }));

  return { ok: true, data: { users: teamUsers, pendingInvites } };
}

const InviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: z.enum(["rep", "manager", "admin"]),
});

export interface InviteResult {
  inviteId: string;
  email: string;
  inviteLink: string;
}

function inviteLinkFor(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/login?invite=${token}`;
}

/**
 * Creates the invite row via the service-role key. Email sending is stubbed:
 * the link is logged server-side and returned for the UI to display/copy.
 */
export async function inviteUser(
  input: z.input<typeof InviteUserSchema>,
): Promise<ActionResult<InviteResult>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const parsed = InviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }
  const { email, role } = parsed.data;

  const supabase = await createClient();
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingUser) return { ok: false, error: "ALREADY_MEMBER" };

  const { data: existingInvite } = await supabase
    .from("invites")
    .select("id")
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existingInvite) return { ok: false, error: "ALREADY_INVITED" };

  const service = createServiceRoleClient();
  const { data: invite, error } = await service
    .from("invites")
    .insert({ email, role, invited_by: guard.me.id })
    .select("id, token")
    .single();
  if (error || !invite) return { ok: false, error: "INVITE_FAILED" };

  const link = inviteLinkFor(invite.token);
  // Email stub: Resend wiring comes later; log + surface the link meanwhile.
  console.log(`[dealflow] invite email stub → ${email} (${role}): ${link}`);

  await supabase.from("audit_log").insert({
    actor_id: guard.me.id,
    action: "user.invited",
    entity_type: "user_invite",
    entity_id: invite.id,
    diff: { email, role },
  });

  return { ok: true, data: { inviteId: invite.id, email, inviteLink: link } };
}

export async function resendInvite(input: {
  inviteId: string;
}): Promise<ActionResult<InviteResult>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const parsed = z.object({ inviteId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const service = createServiceRoleClient();
  const { data: invite, error } = await service
    .from("invites")
    .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("id", parsed.data.inviteId)
    .is("accepted_at", null)
    .select("id, email, token")
    .single();
  if (error || !invite) return { ok: false, error: "NOT_FOUND" };

  const link = inviteLinkFor(invite.token);
  console.log(`[dealflow] invite email stub (resend) → ${invite.email}: ${link}`);

  return { ok: true, data: { inviteId: invite.id, email: invite.email, inviteLink: link } };
}

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["rep", "manager", "admin"]),
});

/** Admin only. Self role changes and demoting the last admin are blocked. */
export async function updateUserRole(
  input: z.input<typeof UpdateRoleSchema>,
): Promise<ActionResult<{ userId: string; role: UserRole }>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const parsed = UpdateRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }
  const { userId, role } = parsed.data;

  if (userId === guard.me.id) return { ok: false, error: "CANNOT_CHANGE_OWN_ROLE" };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("users")
    .select("id, role, is_active")
    .eq("id", userId)
    .single();
  if (!target) return { ok: false, error: "NOT_FOUND" };
  if (target.role === role) return { ok: true, data: { userId, role } };

  if (target.role === "admin" && role !== "admin") {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) return { ok: false, error: "LAST_ADMIN" };
  }

  const { error } = await supabase.from("users").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: "UPDATE_FAILED" };

  await supabase.from("audit_log").insert({
    actor_id: guard.me.id,
    action: "user.role_changed",
    entity_type: "user",
    entity_id: userId,
    diff: { from: target.role, to: role },
  });

  return { ok: true, data: { userId, role } };
}

const DeactivateSchema = z.object({
  userId: z.string().uuid(),
  reassignToUserId: z.string().uuid().optional(),
});

/**
 * Deactivates a user (blocks sign-in, keeps attribution). Owned open deals
 * move to `reassignToUserId` when given. Self-deactivation and deactivating
 * the last active admin are blocked.
 */
export async function deactivateUser(
  input: z.input<typeof DeactivateSchema>,
): Promise<ActionResult<{ userId: string; reassignedDealCount: number }>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const parsed = DeactivateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }
  const { userId, reassignToUserId } = parsed.data;

  if (userId === guard.me.id) return { ok: false, error: "CANNOT_DEACTIVATE_SELF" };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("users")
    .select("id, role, is_active, full_name")
    .eq("id", userId)
    .single();
  if (!target) return { ok: false, error: "NOT_FOUND" };
  if (!target.is_active) return { ok: true, data: { userId, reassignedDealCount: 0 } };

  if (target.role === "admin") {
    const { count } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) return { ok: false, error: "LAST_ADMIN" };
  }

  let reassignedDealCount = 0;
  if (reassignToUserId && reassignToUserId !== userId) {
    const { data: replacement } = await supabase
      .from("users")
      .select("id")
      .eq("id", reassignToUserId)
      .eq("is_active", true)
      .single();
    if (!replacement) return { ok: false, error: "INVALID_REASSIGN_TARGET" };

    const { data: moved, error: moveError } = await supabase
      .from("deals")
      .update({ owner_id: reassignToUserId, last_touched_at: new Date().toISOString() })
      .eq("owner_id", userId)
      .select("id");
    if (moveError) return { ok: false, error: "REASSIGN_FAILED" };
    reassignedDealCount = moved?.length ?? 0;
  }

  const { error } = await supabase.from("users").update({ is_active: false }).eq("id", userId);
  if (error) return { ok: false, error: "DEACTIVATE_FAILED" };

  await supabase.from("audit_log").insert({
    actor_id: guard.me.id,
    action: "user.deactivated",
    entity_type: "user",
    entity_id: userId,
    diff: {
      name: target.full_name,
      reassignedDealCount,
      reassignedTo: reassignToUserId ?? null,
    },
  });

  return { ok: true, data: { userId, reassignedDealCount } };
}

export async function reactivateUser(input: {
  userId: string;
}): Promise<ActionResult<{ userId: string }>> {
  const guard = await asAdmin();
  if (!guard.ok) return guard;

  const parsed = z.object({ userId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("users")
    .select("id, is_active")
    .eq("id", parsed.data.userId)
    .single();
  if (!target) return { ok: false, error: "NOT_FOUND" };

  const { error } = await supabase
    .from("users")
    .update({ is_active: true })
    .eq("id", parsed.data.userId);
  if (error) return { ok: false, error: "REACTIVATE_FAILED" };

  await supabase.from("audit_log").insert({
    actor_id: guard.me.id,
    action: "user.reactivated",
    entity_type: "user",
    entity_id: parsed.data.userId,
    diff: {},
  });

  return { ok: true, data: { userId: parsed.data.userId } };
}
