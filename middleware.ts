import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { safeNextPath } from "@/lib/supabase/redirect";

/**
 * Root middleware: refreshes the Supabase session on every request and
 * enforces the auth boundary —
 *   signed out + /app/*  → /login?next=<original path>
 *   signed in  + /login  → next (or /app)
 * The /app layout re-checks server-side; this is the fast edge guard.
 */
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname + request.nextUrl.search);
    return redirectPreservingCookies(url, response);
  }

  if (user && pathname === "/login") {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/app");
    const target = new URL(next === "/login" ? "/app" : next, request.url);
    const url = request.nextUrl.clone();
    url.pathname = target.pathname;
    url.search = target.search;
    return redirectPreservingCookies(url, response);
  }

  return response;
}

/** Redirects must carry the refreshed session cookies from updateSession. */
function redirectPreservingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    /*
     * Run on every route except Next.js internals and static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
