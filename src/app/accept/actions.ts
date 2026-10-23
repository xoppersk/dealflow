"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Invite acceptance — the only place the service-role client touches the
 * invites table. An unauthenticated invitee cannot read invites (RLS is
 * workspace-scoped), so lookup/accept run server-side here; authorization
 * is re-checked by hand: only the signed-in user whose email matches the
 * invite can accept it, and acceptance grants membership of exactly the
 * workspace the invite names.
 */

export type InviteLookup =
  | {
      ok: true;
      email: string;
      role: string | null;
      workspaceName: string | null;
      alreadyAccepted: boolean;
      expired: boolean;
    }
  | { ok: false; error: string };

type InviteRow = {
  id: string;
  email: string;
  role: string | null;
  workspace_id: string | null;
  accepted_at: string | null;
  expires_at: string | null;
};

async function findInvite(token: string): Promise<InviteRow | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    role: typeof row.role === "string" ? row.role : null,
    workspace_id: typeof row.workspace_id === "string" ? row.workspace_id : null,
    accepted_at: typeof row.accepted_at === "string" ? row.accepted_at : null,
    expires_at: typeof row.expires_at === "string" ? row.expires_at : null,
  };
}

export async function lookupInvite(token: string): Promise<InviteLookup> {
  if (!token) return { ok: false, error: "This invite link is invalid." };
  const invite = await findInvite(token);
  if (!invite || !invite.email) {
    return { ok: false, error: "This invite link is invalid or has expired." };
  }

  let workspaceName: string | null = null;
  if (invite.workspace_id) {
    try {
      const admin = createServiceRoleClient();
      const { data } = await admin
        .from("workspaces")
        .select("name")
        .eq("id", invite.workspace_id)
        .maybeSingle();
      const name = (data as Record<string, unknown> | null)?.name;
      workspaceName = typeof name === "string" ? name : null;
    } catch {
      workspaceName = null;
    }
  }

  return {
    ok: true,
    email: invite.email,
    role: invite.role,
    workspaceName,
    alreadyAccepted: Boolean(invite.accepted_at),
    expired: invite.expires_at ? new Date(invite.expires_at).getTime() < Date.now() : false,
  };
}

export async function acceptInvite(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in or create your account first, then accept." };
  }

  const invite = await findInvite(token);
  if (!invite) {
    return { ok: false, error: "This invite link is invalid or has expired." };
  }
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, error: "This invite has expired. Ask for a fresh one." };
  }
  if (user.email?.trim().toLowerCase() !== invite.email.trim().toLowerCase()) {
    return {
      ok: false,
      error: `This invite was sent to ${invite.email}. Sign in with that email to accept it.`,
    };
  }
  if (!invite.workspace_id) {
    return {
      ok: false,
      error: "This invite isn't attached to a workspace yet — ask the sender to re-send it.",
    };
  }

  const admin = createServiceRoleClient();

  if (!invite.accepted_at) {
    const { error: memberError } = await admin.from("workspace_members").insert({
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: invite.role ?? "rep",
    });
    // 23505 = already a member — acceptance is idempotent.
    if (memberError && memberError.code !== "23505") {
      return { ok: false, error: "Couldn't add you to the workspace. Try again." };
    }
    await admin
      .from("invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  return { ok: true };
}
