import Link from "next/link";

/** Authenticated 404 — same ledger state treatment inside the shell. */
export default function AppNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <div className="df-state-content">
        <h1>This page doesn&apos;t exist</h1>
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
    </div>
  );
}
