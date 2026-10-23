/**
 * /auth/callback — Supabase PKCE callback for email confirmation, magic
 * links and password recovery. Exchanges the code for a session, then
 * redirects to ?next= (validated to a same-origin path) or /app.
 * Recovery flows land on /reset-password; failures land on /login with an
 * ?error= code the login page turns into a human message.
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/supabase/redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const providerError = url.searchParams.get("error");
  const providerErrorCode = url.searchParams.get("error_code");

  if (providerError || !code) {
    const expired =
      providerErrorCode === "otp_expired" || providerError === "access_denied";
    return NextResponse.redirect(
      new URL(`/login?error=${expired ? "expired" : "auth"}`, url.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=expired", url.origin));
  }

  // Password recovery always lands on the reset form, whatever next says.
  const next =
    type === "recovery"
      ? "/reset-password"
      : safeNextPath(url.searchParams.get("next"), "/app");

  return NextResponse.redirect(new URL(next, url.origin));
}
