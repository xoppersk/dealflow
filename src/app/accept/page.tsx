"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrandMark } from "@/components/df/icons";
import "@/styles/system.css";

/**
 * /accept — NO v2 SCREEN (coordinator ruling, flagged in BUILD-LOG): the v1
 * invite set-password route kept functional as a v2-styled screen in
 * Login.html's visual language — brand header, the dark product-statement
 * panel, the legal footer, a name + password form, and the
 * "Set password and open Dealflow" button. Fixture demo — no backend:
 * submitting opens the app.
 */
export default function AcceptPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    router.push("/app");
  }

  return (
    <div className="sys-login-root">
      <header className="sys-login-header">
        <div className="sys-login-brand">
          <span className="mark" aria-hidden="true">
            <BrandMark />
          </span>
          <b>Dealflow</b>
        </div>
      </header>

      <div className="sys-login-main">
        <form className="sys-login-form" onSubmit={onSubmit}>
          <h1>Set your password</h1>
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
          </div>
          <button type="submit" className="btn pri sys-wide">
            Set password and open Dealflow
          </button>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Already set up?{" "}
            <Link href="/login" style={{ fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </form>

        <aside className="sys-login-aside">
          <span className="eyebrow">
            <i aria-hidden="true" />
            What you’ll see first
          </span>
          <p className="statement">
            Today: the deals that are stuck, the money behind them, and the one thing to do about
            each.
          </p>
          <span className="sub">
            Every deal carries a next step and a date, so nothing quietly goes cold.
          </span>
        </aside>
      </div>

      <footer className="sys-login-foot">
        <span>© 2026 [Company]</span>
        <nav aria-label="Legal">
          <Link href="#">Privacy</Link>
          <Link href="#">Terms</Link>
          <Link href="#">Security</Link>
          <Link href="#">Status</Link>
          <Link href="#">Help</Link>
        </nav>
      </footer>
    </div>
  );
}
