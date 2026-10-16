"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { team } from "@/lib/df/api";
import { subscribeEvents } from "@/lib/df/events";
import { CommandPalette } from "./command-palette";
import { BrandMark, SearchIcon } from "./icons";

const TABS: { label: string; href: string; count?: number; match: (p: string) => boolean }[] = [
  { label: "Today", href: "/app", count: 3, match: (p) => p === "/app" },
  {
    label: "Pipeline",
    href: "/app/pipeline",
    match: (p) => p.startsWith("/app/pipeline") || p.startsWith("/app/deals"),
  },
  { label: "Activities", href: "/app/activities", count: 2, match: (p) => p.startsWith("/app/activities") },
  { label: "Contacts", href: "/app/contacts", match: (p) => p.startsWith("/app/contacts") },
  { label: "Companies", href: "/app/companies", match: (p) => p.startsWith("/app/companies") },
  { label: "Reports", href: "/app/reports", match: (p) => p.startsWith("/app/reports") },
  { label: "Settings", href: "/app/settings", match: (p) => p.startsWith("/app/settings") },
];

const online = [...team]
  .filter((t) => t.online)
  .sort((a, b) => Number(a.you ?? false) - Number(b.you ?? false) || team.indexOf(b) - team.indexOf(a));

const onlineLabel = `Online now: ${online.map((p) => (p.you ? "you" : p.name)).join(", ")}`;

/**
 * The pill nav is the only part of the shell that needs the current path
 * (for the dark current pill / aria-current). It reads usePathname, which
 * is runtime-only, so it renders inside its own Suspense boundary — the
 * fallback is the same nav without a current tab, and the shell around it
 * still prerenders.
 */
function PillNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Main" className="pillnav">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className="tab"
          aria-current={t.match(pathname) ? "page" : undefined}
        >
          {t.label}
          {t.count !== undefined ? <span>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

function PillNavFallback() {
  return (
    <nav aria-label="Main" className="pillnav">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="tab">
          {t.label}
          {t.count !== undefined ? <span>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/**
 * AppShell (§6 app bar + §13 signature): white bar, bar-chart mark, pill nav
 * with a dark current pill + mono counts, ⌘K search field, presence squares.
 * Hosts the CommandPalette (⌘K from every app screen, §10) and the polite
 * aria-live region that announces moves (§11).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(
    () =>
      subscribeEvents((event) => {
        if (event.kind === "announce") setLiveMessage(event.message);
        else
          setLiveMessage(
            `${event.byName} moved ${event.companyName} to ${event.toStageName}`,
          );
      }),
    [],
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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

        <Suspense fallback={<PillNavFallback />}>
          <PillNav />
        </Suspense>

        <button type="button" className="searchbox" onClick={() => setPaletteOpen(true)} aria-haspopup="dialog">
          <SearchIcon />
          <span className="grow">Search or jump to a deal</span>
          <span className="kbd">⌘K</span>
        </button>

        <div className="presence-stack" aria-label={onlineLabel} role="img">
          {online.map((p) => (
            <span
              key={p.id}
              className="own"
              style={{ background: p.avatarBg, color: p.avatarColor }}
              aria-hidden="true"
            >
              {p.initials}
            </span>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>{children}</div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <div className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </div>
    </div>
  );
}
