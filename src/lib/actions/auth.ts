/**
 * Server Actions for authentication.
 *
 * Every action returns `ActionResult` — `{ ok: true, data }` on success,
 * `{ ok: false, error }` on failure — so clients handle errors uniformly.
 *
 * Sessions are cookie-based (Supabase SSR). Sign-in and sign-out actions
 * set/clear the session cookies on the server client.
 */

"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/types";
import { createClient as createServerClient } from "@/lib/supabase/server";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address");

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

const magicLinkSchema = z.object({
  email: emailSchema,
});

const acceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is missing"),
  name: z.string().trim().min(1, "Enter your name"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
});

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again";
}

/** Lazy admin client — bypasses RLS for invite bookkeeping only. Server-only. */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase is not configured");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Email + password sign in. Client navigates to ?next= (or /) on success. */
export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<ActionResult<null>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    // Generic message per the login spec — do not leak which field failed.
    return { ok: false, error: "Wrong email or password" };
  }

  // Deactivated accounts get signed back out with a clear notice.
  const { data: profileRow } = await supabase
    .from("users")
    .select("is_active")
    .eq("id", data.user.id)
    .single();
  const profile = profileRow as { is_active: boolean } | null;
  if (!profile || profile.is_active !== true) {
    await supabase.auth.signOut();
    return { ok: false, error: "Your account was deactivated" };
  }

  return { ok: true, data: null };
}

/** Sends a passwordless magic link. Client swaps the form for the sent state. */
export async function signInWithMagicLink(input: {
  email: string;
  next?: string;
}): Promise<ActionResult<{ sent: true }>> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const rawNext = input.next ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const emailRedirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo },
  });
  if (error) {
    return { ok: false, error: "Could not send the magic link. Try again." };
  }
  return { ok: true, data: { sent: true } };
}

/** Signs the user out and sends them back to /login. */
export async function signOut(): Promise<void> {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Accepts a team invite: validates the token, creates the auth user,
 * inserts the public.users profile with the invited role, and marks the
 * invite accepted. Establishes the session so the client lands on / signed in.
 */
export async function acceptInvite(input: {
  token: string;
  name: string;
  password: string;
}): Promise<ActionResult<null>> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  let admin;
  try {
    admin = adminClient();
  } catch {
    return { ok: false, error: "Something went wrong. Try again later." };
  }

  // 1. Look up the invite by its secret token.
  const { data: invite, error: inviteError } = await admin
    .from("invites")
    .select("*")
    .eq("token", parsed.data.token)
    .single();
  if (inviteError || !invite) {
    return { ok: false, error: "This invite link is invalid or has expired" };
  }
  if (invite.accepted_at) {
    return { ok: false, error: "This invite was already used. Sign in instead." };
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "This invite link has expired" };
  }

  // 2. Create the auth user with email pre-confirmed.
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: invite.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.name },
    });
  if (createError || !created.user) {
    const message = createError?.message ?? "";
    if (/already.*(registered|exists)|duplicate/i.test(message)) {
      return { ok: false, error: "This email already has an account. Sign in instead." };
    }
    return { ok: false, error: "Could not create your account. Try again." };
  }
  const authUser = created.user;

  // 3. Insert the public profile with the invited role.
  const { error: profileError } = await admin.from("users").insert({
    id: authUser.id,
    email: invite.email,
    full_name: parsed.data.name,
    role: invite.role,
    is_active: true,
  });
  if (profileError) {
    // Roll back the orphaned auth user so the invite can be retried cleanly.
    await admin.auth.admin.deleteUser(authUser.id);
    return { ok: false, error: "Could not create your account. Try again." };
  }

  // 4. Mark the invite accepted (non-fatal if this fails).
  await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  // 5. Establish the session on this request's cookies.
  const supabase = await createServerClient();
  const { error: sessionError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password: parsed.data.password,
  });
  if (sessionError) {
    return { ok: false, error: "Account created. Sign in to continue." };
  }

  return { ok: true, data: null };
}
