"use client";

/**
 * Route error boundary — "Something went wrong on our end", Try again,
 * support link. Never echoes user data back.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-16">
      <div className="df-state-content w-full">
        <h1>Something went wrong on our end</h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          The page failed to load. Your data is safe — try again, and if the
          problem persists, contact support.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className="df-state-action">
            Try again
          </button>
          <a
            href="mailto:support@dealflow.example.com"
            className="inline-flex min-h-11 items-center rounded-[2px] border border-border bg-card px-4 text-sm font-medium hover:border-primary"
          >
            Contact support
          </a>
        </div>
      </div>
    </main>
  );
}
