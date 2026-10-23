"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { appUrl } from "@/lib/supabase/redirect";
import { acceptInvite, lookupInvite, type InviteLookup } from "./actions";

/**
 * Invite form states:
 *  - loading lookup → invalid / expired / already-accepted notices
 *  - signed out → the v2 set-password form (name + password), creating a
 *    real Supabase account for the invited email; with email
 *    confirmation on, the flow resumes here after the confirm link.
 *  - signed in with the invited email → one-click accept.
 *  - signed in with a different email → told exactly whose invite it is.
 */
export function AcceptForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [lookup, setLookup] = useState<InviteLookup | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLookup({ ok: false, error: "This invite link is invalid." });
        return;
      }
      const result = await lookupInvite(token);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      setLookup(result);
      setCurrentEmail(user?.email ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const note = (text: string) => (
    <p className="sys-login-sent" role="status">
      {text}
    </p>
  );

  if (lookup === null) {
    return (
      <form className="sys-login-form" onSubmit={(e) => e.preventDefault()}>
        <h1>Set your password</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Checking your invite…</p>
      </form>
    );
  }

  if (!lookup.ok) {
    return (
      <form className="sys-login-form" onSubmit={(e) => e.preventDefault()}>
        <h1>This invite link is invalid</h1>
        {note(lookup.error)}
        <Link href="/login" className="btn pri sys-wide">
          Go to sign in
        </Link>
      </form>
    );
  }

  if (lookup.expired && !lookup.alreadyAccepted) {
    return (
      <form className="sys-login-form" onSubmit={(e) => e.preventDefault()}>
        <h1>This invite has expired</h1>
        {note(
          `The invite for ${lookup.email} has expired. Ask the person who invited you to send a fresh one.`,
        )}
        <Link href="/login" className="btn pri sys-wide">
          Go to sign in
        </Link>
      </form>
    );
  }

  const invitedEmail = lookup.email;
  const inviteSummary = `You've been invited to join ${
    lookup.workspaceName ?? "a workspace"
  } as ${lookup.email}${lookup.role ? ` (${lookup.role})` : ""}.`;

  if (lookup.alreadyAccepted) {
    return (
      <form className="sys-login-form" onSubmit={(e) => e.preventDefault()}>
        <h1>You’re already in</h1>
        {note(`This invite for ${lookup.email} has already been accepted.`)}
        <Link href={currentEmail ? "/app" : "/login"} className="btn pri sys-wide">
          {currentEmail ? "Open Dealflow" : "Sign in"}
        </Link>
      </form>
    );
  }

  if (sent) {
    return (
      <form className="sys-login-form" onSubmit={(e) => e.preventDefault()}>
        <h1>Check your email</h1>
        {note(
          `We sent a confirmation link to ${lookup.email}. Confirm your account, then open this invite link again to finish joining.`,
        )}
        <Link href="/login" className="btn sys-wide">
          Go to sign in
        </Link>
      </form>
    );
  }

  if (currentEmail) {
    const matches =
      currentEmail.trim().toLowerCase() === lookup.email.trim().toLowerCase();

    async function onAccept(e: FormEvent) {
      e.preventDefault();
      if (!token || busy) return;
      setBusy(true);
      setError(null);
      const result = await acceptInvite(token);
      if (result.ok) {
        // Coordinator fix (2026-10-22): hard navigation post-accept —
        // same push+refresh RSC race as the login form.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate hard navigation, see above
        window.location.assign("/app");
      } else {
        setBusy(false);
        setError(result.error);
      }
    }

    return (
      <form className="sys-login-form" onSubmit={onAccept}>
        <h1>Join your team</h1>
        {note(inviteSummary)}
        {error && (
          <p className="sys-field-error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
        {matches ? (
          <button type="submit" className="btn pri sys-wide" disabled={busy}>
            {busy ? "Joining…" : "Accept invitation and open Dealflow"}
          </button>
        ) : (
          <>
            <p className="sys-field-error" role="alert" style={{ margin: 0 }}>
              You’re signed in as {currentEmail}, but this invite is for {lookup.email}.
            </p>
            <button
              type="button"
              className="btn pri sys-wide"
              onClick={() => {
                void signOut();
              }}
            >
              Sign out and continue
            </button>
          </>
        )}
      </form>
    );
  }

  async function onCreateAccount(e: FormEvent) {
    e.preventDefault();
    if (!token || busy) return;
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email: invitedEmail,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(
          `/accept?token=${token}`,
        )}`,
      },
    });
    if (err) {
      setBusy(false);
      setError(
        err.message.toLowerCase().includes("already")
          ? "An account with this email already exists — sign in, then open this invite link again."
          : err.message,
      );
      return;
    }
    if (data.session) {
      const result = await acceptInvite(token);
      if (result.ok) {
        // Coordinator fix (2026-10-22): hard navigation post-accept —
        // same push+refresh RSC race as the login form.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate hard navigation, see above
        window.location.assign("/app");
      } else {
        setBusy(false);
        setError(result.error);
      }
    } else {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <form className="sys-login-form" onSubmit={onCreateAccount}>
      <h1>Set your password</h1>
      {note(inviteSummary)}
      {error && (
        <p className="sys-field-error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <div className="f">
        <label htmlFor="em">Email</label>
        <input id="em" className="in sys-wide" type="email" value={lookup.email} readOnly />
      </div>
      <div className="f">
        <label htmlFor="nm">Your name</label>
        <input
          id="nm"
          className="in sys-wide"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="f">
        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          className="in sys-wide"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>At least 8 characters.</span>
      </div>
      <button type="submit" className="btn pri sys-wide" disabled={busy}>
        {busy ? "Creating account…" : "Set password and open Dealflow"}
      </button>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
        Already set up?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(`/accept?token=${token ?? ""}`)}`}
          style={{ fontWeight: 600 }}
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
