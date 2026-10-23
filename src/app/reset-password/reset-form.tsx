"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Reset-password form. A recovery session is required: the callback route
 * exchanges the emailed code for one before redirecting here. Without a
 * session the link was invalid/expired and we say so, with a path back to
 * the forgot-password flow.
 */
export function ResetPasswordForm() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      setHasSession(Boolean(user));
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      // Coordinator fix (2026-10-22): hard navigation after the password
      // update — same push+refresh RSC race as the login form.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- deliberate hard navigation, see above
      window.location.assign("/app");
    }
  }

  if (checking) {
    return (
      <form className="sys-login-form" onSubmit={(e) => e.preventDefault()}>
        <h1>Choose a new password</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Checking your link…</p>
      </form>
    );
  }

  if (!hasSession) {
    return (
      <form className="sys-login-form" onSubmit={(e) => e.preventDefault()}>
        <h1>This link has expired</h1>
        <p className="sys-login-sent" role="alert">
          Password-reset links work once and don’t last long. Request a fresh one and open it
          straight away.
        </p>
        <Link href="/login?mode=forgot" className="btn pri sys-wide">
          Request a new reset link
        </Link>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Or{" "}
          <Link href="/login" style={{ fontWeight: 600 }}>
            back to sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form className="sys-login-form" onSubmit={onSubmit}>
      <h1>Choose a new password</h1>
      {error && (
        <p className="sys-field-error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <div className="f">
        <label htmlFor="pw">New password</label>
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
      <div className="f">
        <label htmlFor="pw2">Confirm new password</label>
        <input
          id="pw2"
          className="in sys-wide"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <button type="submit" className="btn pri sys-wide" disabled={busy}>
        {busy ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
