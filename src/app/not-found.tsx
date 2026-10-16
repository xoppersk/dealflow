import type { Metadata } from "next";
import Link from "next/link";
import { companyById, dealById } from "@/lib/df/api";
import { BrandMark, SearchIcon } from "@/components/df/icons";
import { Monogram } from "@/components/df/primitives";
import "@/styles/system.css";

export const metadata: Metadata = { title: "Page not found" };

const TABS: { label: string; href: string; count?: number; current?: boolean }[] = [
  { label: "Today", href: "/app", count: 3 },
  { label: "Pipeline", href: "/app/pipeline", current: true },
  { label: "Activities", href: "/app/activities", count: 2 },
  { label: "Contacts", href: "/app/contacts" },
  { label: "Companies", href: "/app/companies" },
  { label: "Reports", href: "/app/reports" },
  { label: "Settings", href: "/app/settings" },
];

/**
 * X-06 404 — NotFound.html exactly: "We can't find that deal." with the
 * suggestion of the renamed Bracken deal. not-found renders outside the
 * /app layout, so the screen's app header is replicated statically here
 * (Pipeline is the drawn current tab).
 */
export default function NotFound() {
  const bracken = dealById("bracken-works-annual-operations-plan")!;
  const company = companyById(bracken.companyId);

  return (
    <div className="sys-404-root">
      <header className="shell-header">
        <Link href="/app" className="brand" aria-label="Dealflow — Today">
          <span className="mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="wm">
            <b>Dealflow</b>
            <span>Sevyn Labs · Sales</span>
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

        <div className="presence-stack" aria-label="Online now: Maya Jordan, Priya Shah, you" role="img">
          <span className="own" style={{ background: "#D9ECE9" }} aria-hidden="true">
            MJ
          </span>
          <span className="own" style={{ background: "#E7E0F2" }} aria-hidden="true">
            PS
          </span>
          <span className="own" style={{ background: "var(--ink)", color: "#fff" }} aria-hidden="true">
            SK
          </span>
        </div>
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
          <Link href="/app/deals/bracken-works" className="sys-suggest">
            <Monogram initials={company.initials} bg={company.mgBg} color={company.mgColor} />
            <span className="body">
              <span>
                Did you mean <b>{company.name} · Annual operations plan</b>?
              </span>
              <span className="when">It was renamed on Sep 18.</span>
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
