"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";
import { appUrl, safeNextPath } from "@/lib/supabase/redirect";

/**
 * X-01 sign-in form (Login.html visual language — shell, fields and
 * buttons unchanged in treatment), wired to real Supabase Auth:
 * password sign-in, public registration, magic link and password reset.
 * Modes: signin / register / forgot, plus a "sent" notice state drawn
 * with the design's .sys-login-sent box.
 *
 * Project settings (verified live 2026-10-22): public sign-up is open
 * and email confirmation is REQUIRED, so registration normally lands in
 * the "check your email" state; if confirmation is ever switched off,
 * signUp returns a session and we go straight in.
 */

type Mode = "signin" | "register" | "forgot" | "sent";

const CALLBACK_ERRORS: Record<string, string> = {
  expired: "That link has expired. Sign in below, or request a fresh one.",
  auth: "That link didn't work. Sign in below and try again.",
};

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "Email or password doesn't match our records.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email first — check your inbox for the confirmation link.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with this email already exists — sign in instead.";
  }
  if (m.includes("password should be at least")) {
    return "Use a password of at least 8 characters.";
  }
  if (m.includes("signups not allowed") || m.includes("otp")) {
    return "No account for that email yet — create one first.";
  }
  return message;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"), "/app");
  const callbackError = searchParams.get("error");

  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "forgot" ? "forgot" : "signin",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    callbackError ? (CALLBACK_ERRORS[callbackError] ?? CALLBACK_ERRORS.auth!) : null,
  );
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  function switchMode(newMode: Mode) {
    setMode(newMode);
    setError(null);
    setBusy(null);
  }

  function goIn() {
    // Coordinator fix (2026-10-22): hard navigation after auth. The session
    // cookie was just written by supabase-js; router.push + router.refresh
    // raced it and produced a one-off 404 on the /app RSC fetch during the
    // sign-in transition. A document load always carries the fresh cookie.
    window.location.assign(next);
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("password");
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(null);
    if (err) {
      setError(friendlyAuthError(err.message));
    } else {
      goIn();
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    setBusy("register");
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(null);
    if (err) {
      setError(friendlyAuthError(err.message));
    } else if (data.session) {
      goIn();
    } else {
      setSentMessage(
        `Check your email — we sent a confirmation link to ${email.trim()}. Confirm it to open your pipeline.`,
      );
      setMode("sent");
    }
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("forgot");
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${appUrl()}/auth/callback?next=/reset-password`,
    });
    setBusy(null);
    if (err) {
      setError(friendlyAuthError(err.message));
    } else {
      // Same message whether or not the account exists — no enumeration.
      setSentMessage(
        `If an account exists for ${email.trim()}, a password-reset link is on its way. Open it to choose a new password.`,
      );
      setMode("sent");
    }
  }

  async function onMagicLink() {
    if (busy) return;
    if (!email.trim()) {
      setError("Enter your work email first, then request a sign-in link.");
      return;
    }
    setBusy("magic");
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(null);
    if (err) {
      setError(friendlyAuthError(err.message));
    } else {
      setSentMessage(
        `Check your email — we sent a sign-in link to ${email.trim()}. It signs you in straight to your pipeline.`,
      );
      setMode("sent");
    }
  }

  async function onGoogle() {
    if (busy) return;
    setBusy("google");
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // Success navigates away to Google; only failures come back here.
    setBusy(null);
    if (err) {
      setError("Google sign-in isn't enabled for Dealflow yet — use your email and password.");
    }
  }

  const linkStyle = { fontWeight: 600 } as const;
  const textButtonStyle = {
    fontWeight: 600,
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
  } as const;

  if (mode === "sent") {
    return (
      <form className="sys-login-form" onSubmit={(e) => e.preventDefault()}>
        <h1>Check your email</h1>
        <p className="sys-login-sent" role="status">
          {sentMessage}
        </p>
        <button
          type="button"
          className="btn sys-wide"
          onClick={() => switchMode("signin")}
        >
          Back to sign in
        </button>
      </form>
    );
  }

  if (mode === "register") {
    return (
      <form className="sys-login-form" onSubmit={onRegister}>
        <h1>Create your account</h1>
        {error && (
          <p className="sys-field-error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
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
          <label htmlFor="em">Work email</label>
          <input
            id="em"
            className="in sys-wide"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            At least 8 characters.
          </span>
        </div>
        <button type="submit" className="btn pri sys-wide" disabled={busy !== null}>
          {busy === "register" ? "Creating account…" : "Create account"}
        </button>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Already have an account?{" "}
          <button type="button" style={textButtonStyle} onClick={() => switchMode("signin")}>
            Sign in
          </button>
        </p>
      </form>
    );
  }

  if (mode === "forgot") {
    return (
      <form className="sys-login-form" onSubmit={onForgot}>
        <h1>Reset your password</h1>
        {error && (
          <p className="sys-field-error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        )}
        <div className="f">
          <label htmlFor="em">Work email</label>
          <input
            id="em"
            className="in sys-wide"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="btn pri sys-wide" disabled={busy !== null}>
          {busy === "forgot" ? "Sending link…" : "Send reset link"}
        </button>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Remembered it?{" "}
          <button type="button" style={textButtonStyle} onClick={() => switchMode("signin")}>
            Back to sign in
          </button>
        </p>
      </form>
    );
  }

  return (
    <form className="sys-login-form" onSubmit={onSignIn}>
      <h1>Sign in to your pipeline</h1>
      <button type="button" className="btn sys-wide" onClick={onGoogle} disabled={busy !== null}>
        Continue with Google
      </button>
      <div className="sys-login-or" aria-hidden="true">
        <span />
        or
        <span />
      </div>
      {error && (
        <p className="sys-field-error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      )}
      <div className="f">
        <label htmlFor="em">Work email</label>
        <input
          id="em"
          className="in sys-wide"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="f">
        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          className="in sys-wide"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit" className="btn pri sys-wide" disabled={busy !== null}>
        {busy === "password" ? "Signing in…" : "Sign in"}
      </button>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: "var(--muted)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <button type="button" style={textButtonStyle} onClick={onMagicLink} disabled={busy !== null}>
          Email me a sign-in link
        </button>
        <button type="button" style={textButtonStyle} onClick={() => switchMode("forgot")}>
          Forgot password?
        </button>
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
        New team?{" "}
        <button type="button" style={{ ...textButtonStyle, ...linkStyle }} onClick={() => switchMode("register")}>
          Create an account
        </button>
      </p>
    </form>
  );
}
