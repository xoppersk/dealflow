"use client";

import "@/styles/system.css";
import Link from "next/link";

/**
 * X-06 error boundary for /app/** — in the design language. Used when a
 * server fetch fails: the copy names the recovery, not the stack trace.
 */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="sys-state-wrap">
      <section className="state">
        <div className="sys-state-top">
          <span className="stamp">Something broke</span>
        </div>
        <h1>This page didn’t load.</h1>
        <p>
          Your deals are safe — only this view failed. Try again; if it keeps happening, the
          pipeline board is the fastest way back in.
        </p>
        <div className="sys-state-actions">
          <button type="button" className="btn pri" onClick={reset}>
            Try again
          </button>
          <Link className="btn" href="/app/pipeline">
            Back to the pipeline
          </Link>
        </div>
      </section>
    </main>
  );
}
