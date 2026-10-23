import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark, SearchIcon } from "@/components/df/icons";
import "@/styles/system.css";

export const metadata: Metadata = { title: "Page not found" };

const TABS: { label: string; href: string; count?: number; current?: boolean }[] = [
  { label: "Today", href: "/app" },
  { label: "Pipeline", href: "/app/pipeline", current: true },
  { label: "Activities", href: "/app/activities" },
  { label: "Contacts", href: "/app/contacts" },
  { label: "Companies", href: "/app/companies" },
  { label: "Reports", href: "/app/reports" },
  { label: "Settings", href: "/app/settings" },
];

/**
 * X-06 404 — NotFound.html: "We can't find that deal." Production copy is
 * static (not-found renders outside the /app layout and has no session
 * dataset) — the header is replicated statically, with no fixture counts
 * or fixture-deal suggestion.
 */
export default function NotFound() {

  return (
    <div className="sys-404-root">
      <header className="shell-header">
        <Link href="/app" className="brand" aria-label="Dealflow — Today">
          <span className="mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="wm">
            <b>Dealflow</b>
            <span>Dealflow</span>
          </span>
        </Link>

        <nav aria-label="Main" className="pillnav">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="tab"
              aria-current={t.current ? "page" : undefined}
            >
              {t.label}
              {t.count !== undefined ? <span>{t.count}</span> : null}
            </Link>
          ))}
        </nav>

        <span className="searchbox" aria-hidden="true">
          <SearchIcon />
          <span className="grow">Search or jump to a deal</span>
          <span className="kbd">⌘K</span>
        </span>

        <span />
      </header>

      <main className="sys-state-wrap">
        <section className="state">
          <div className="sys-state-top">
            <span className="ic" style={{ background: "#F1EEE6" }} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#44504D" strokeWidth="1.5" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="m10.5 10.5 3 3M5.5 7h3" />
              </svg>
            </span>
            <span className="stamp">404 · nothing at this address</span>
          </div>
          <h1>We can’t find that deal.</h1>
          <p>
            It may have been merged into another deal, deleted, or the link is from a different
            workspace. Nothing you were working on was lost.
          </p>
          <Link href="/app/pipeline" className="sys-suggest">
            <span className="body">
              <span>
                <b>Browse the pipeline</b> instead?
              </span>
              <span className="when">Deals, contacts and companies live there.</span>
            </span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#66716E" strokeWidth="1.6" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </Link>
          <div className="sys-state-actions">
            <Link href="/app/pipeline" className="btn pri">
              <SearchIcon size={13} />
              Search deals
            </Link>
            <Link href="/app/pipeline" className="btn">
              Back to the board
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
