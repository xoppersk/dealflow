"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

/**
 * X-01 sign-in form (Login.html): Google button, the "or" divider, the
 * work-email link form and the new-team line. Fixture demo — no backend:
 * submitting the email form opens the app (the screen draws no
 * "check your inbox" state).
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("sheku@sevynlabs.io");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    router.push("/app");
  }

  return (
    <form className="sys-login-form" onSubmit={onSubmit}>
      <h1>Sign in to your pipeline</h1>
      <Link href="/app" className="btn sys-wide">
        Continue with Google
      </Link>
      <div className="sys-login-or" aria-hidden="true">
        <span />
        or
        <span />
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
      <button type="submit" className="btn pri sys-wide">
        Email me a sign-in link
      </button>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
        New team?{" "}
        <Link href="/app/setup/deal" style={{ fontWeight: 600 }}>
          Set up a workspace
        </Link>
      </p>
    </form>
  );
}
