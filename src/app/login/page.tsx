import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BrandMark } from "@/components/df/icons";
import "@/styles/system.css";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/**
 * X-01 Login (/login) — Login.html exactly. Outside the app shell: its own
 * slim header (brand mark + wordmark only), the sign-in form beside the dark
 * product-statement panel (no data shown), and the product's only footer —
 * the one-line legal footer.
 */
export default function LoginPage() {
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
          <LoginForm />
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
        <span>© 2026 Sevyn Labs · <a href="tel:+12762702729">(276) 270-2729</a></span>
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
