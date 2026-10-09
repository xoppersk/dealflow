import Link from "next/link";

/**
 * 404 — line illustration, "This page doesn't exist", shortcuts back into
 * the workspace. Ledger state-page treatment.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-16">
      <div className="df-state-content w-full">
        <svg
          width="72"
          height="72"
          viewBox="0 0 72 72"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="text-muted-foreground"
          aria-hidden
        >
          <line x1="10" y1="60" x2="62" y2="60" />
          <rect x="16" y="40" width="10" height="20" />
          <rect x="31" y="30" width="10" height="30" />
          <rect x="46" y="18" width="10" height="42" />
          <circle cx="51" cy="12" r="2.5" className="text-primary" fill="currentColor" stroke="none" />
        </svg>
        <h1 className="mt-6">This page doesn&apos;t exist</h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          The link you followed is broken, or the page was moved. Your data is
          safe — pick a place to continue.
        </p>
        <nav className="mt-6 flex flex-wrap gap-2" aria-label="Shortcuts">
          <Link href="/pipeline" className="df-state-action inline-flex items-center">
            Pipeline
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-[2px] border border-border bg-card px-4 text-sm font-medium hover:border-primary"
          >
            Today
          </Link>
          <Link
            href="/pipeline?create=1"
            className="inline-flex min-h-11 items-center rounded-[2px] border border-border bg-card px-4 text-sm font-medium hover:border-primary"
          >
            New deal
          </Link>
        </nav>
      </div>
    </main>
  );
}
