"use client";

import { useEffect, useState } from "react";

/**
 * Greeting header: "Good morning, Maya" + full date, computed in local time.
 *
 * The text is filled in only after mount. Server and browser can sit in
 * different timezones, so SSR-ing the local-time greeting made the server's
 * day-part/date disagree with the client's first render whenever they
 * straddled a boundary — a React #418 hydration mismatch on the dashboard
 * (production servers run UTC, so US users hit it every evening). The
 * pre-mount placeholder is timezone-neutral, keeps the exact layout, and is
 * replaced by the real local greeting immediately after mount — the user
 * never sees a wrong greeting.
 */
export function Greeting({ name }: { name: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  const part = now
    ? now.getHours() < 12
      ? "morning"
      : now.getHours() < 17
        ? "afternoon"
        : "evening"
    : null;
  const date = now?.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
        {part ? `Good ${part}, ${name}` : `Welcome, ${name}`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{date ?? "\u00A0"}</p>
    </div>
  );
}
