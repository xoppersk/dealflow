import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/df/icons";
import "@/styles/system.css";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Accept invitation" };

/**
 * /accept?token=… — team-invite landing. NO v2 SCREEN (coordinator
 * ruling): kept in Login.html’s visual language — brand header, the dark
 * product-statement panel, the legal footer. Behaviour is real: the
 * token is looked up server-side (service role), a signed-out invitee
 * creates their account with the invited email, and acceptance adds
 * their workspace membership (see ./actions.ts).
 */
export default function AcceptPage() {
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
        <Suspense fallback={null}>
          <AcceptForm />
        </Suspense>

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
        <span>© 2026 Sevyn Labs</span>
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
