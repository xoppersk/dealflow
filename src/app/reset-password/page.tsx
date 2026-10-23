import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/df/icons";
import "@/styles/system.css";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset password" };

/**
 * /reset-password — lands here from /auth/callback after a recovery link
 * exchanges its code for a session. Drawn in the X-01 login language:
 * same slim brand header, dark product-statement panel, legal footer.
 */
export default function ResetPasswordPage() {
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
          <ResetPasswordForm />
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
