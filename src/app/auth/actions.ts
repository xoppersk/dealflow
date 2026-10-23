"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Sign-out server action — the single sign-out mechanism for the app.
 *
 * FOR THE APP SHELL (src/components/df/app-shell.tsx — W3 territory):
 * the shell currently draws no sign-out affordance. Add one in the user
 * menu wired to this action, either as a form:
 *
 *   import { signOut } from "@/app/auth/actions";
 *   <form action={signOut}><button type="submit">Sign out</button></form>
 *
 * or imperatively from a client handler: `onClick={() => signOut()}`.
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
