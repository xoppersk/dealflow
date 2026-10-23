"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { isOpenDeal } from "@/lib/df/api";
import { subscribeEvents } from "@/lib/df/events";
import type { Dataset, Person } from "@/lib/df/types";
import { CommandPalette } from "./command-palette";
import { DatasetProvider } from "./dataset-context";
import { BrandMark, SearchIcon } from "./icons";

interface TabDef {
  label: string;
  href: string;
  count?: number;
  match: (p: string) => boolean;
}

function tabsFor(dataset?: Dataset): TabDef[] {
  const stuck = dataset
    ? dataset.deals.filter((d) => isOpenDeal(d) && (d.stale || !d.nextStep)).length
    : undefined;
  const overdue = dataset ? dataset.activities.filter((a) => a.overdueDays !== undefined).length : undefined;
  return [
    { label: "Today", href: "/app", count: stuck || undefined, match: (p) => p === "/app" },
    {
      label: "Pipeline",
      href: "/app/pipeline",
      match: (p) => p.startsWith("/app/pipeline") || p.startsWith("/app/deals"),
    },
    { label: "Activities", href: "/app/activities", count: overdue || undefined, match: (p) => p.startsWith("/app/activities") },
    { label: "Contacts", href: "/app/contacts", match: (p) => p.startsWith("/app/contacts") },
    { label: "Companies", href: "/app/companies", match: (p) => p.startsWith("/app/companies") },
    { label: "Reports", href: "/app/reports", match: (p) => p.startsWith("/app/reports") },
    { label: "Settings", href: "/app/settings", match: (p) => p.startsWith("/app/settings") },
  ];
}

/**
 * The pill nav is the only part of the shell that needs the current path
 * (for the dark current pill / aria-current). It reads usePathname, which
 * is runtime-only, so it renders inside its own Suspense boundary — the
 * fallback is the same nav without a current tab.
 */
function PillNav({ tabs }: { tabs: TabDef[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Main" className="pillnav">
      {tabs.map((t) => (
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

function PillNavFallback({ tabs }: { tabs: TabDef[] }) {
  return (
    <nav aria-label="Main" className="pillnav">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="tab">
          {t.label}
          {t.count !== undefined ? <span>{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/**
 * The shell's user area: avatar chip for the signed-in user (from the
 * dataset — name, email, role) opening a small menu whose last item is
 * Sign out, wired to W2's signOut server action (src/app/auth/actions.ts)
 * as a plain form so it works with no client JS state beyond the menu.
 * Without a dataset (layout not passing one yet) the chip falls back to a
 * neutral "Account" trigger — signing out works either way.
 */
function UserMenu({ user }: { user?: Person }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open] );

  return (
    <div ref={ref} style={{ position: "relative", marginLeft: 10 }}>
      <button
        type="button"
        className="btn sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? `Account — ${user.name}` : "Account"}
        onClick={() => setOpen((o) => !o)}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, paddingLeft: 5 }}
      >
        <span
          className="own"
          aria-hidden="true"
          style={{
            background: user?.avatarBg ?? "var(--ink)",
            color: user?.avatarColor ?? "#fff",
            width: 24,
            height: 24,
            borderRadius: 12,
            fontSize: 10,
          }}
        >
          {user?.initials ?? "?"}
        </span>
        <span style={{ fontWeight: 600 }}>{user ? user.firstName : "Account"}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="m2 3.5 3 3 3-3" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="User menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 250,
            background: "var(--card)",
            borderRadius: "var(--radius-m)",
            boxShadow: "var(--shadow-selected)",
            border: "1px solid var(--frame)",
            padding: 8,
            zIndex: 60,
          }}
        >
          {user ? (
            <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid var(--rule)", marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{user.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{user.email}</div>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{user.role}</div>
            </div>
          ) : null}
          <Link
            href="/app/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            style={{
              display: "block",
              padding: "8px 10px",
              borderRadius: "var(--radius-s)",
              color: "var(--ink)",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            Workspace settings
          </Link>
          <form action={signOut} style={{ marginTop: 2 }}>
            <button
              type="submit"
              role="menuitem"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                borderRadius: "var(--radius-s)",
                background: "none",
                border: 0,
                cursor: "pointer",
                color: "var(--ink)",
                fontSize: 13.5,
                fontWeight: 500,
                fontFamily: "inherit",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

/**
 * AppShell (§6 app bar + §13 signature): white bar, bar-chart mark, pill nav
 * with a dark current pill + mono counts, ⌘K search field, presence squares.
 * Hosts the CommandPalette (⌘K from every app screen, §10) and the polite
 * aria-live region that announces moves (§11).
 *
 * The workspace Dataset is props-in from the server layout (W2's
 * /app/layout.tsx): when present it drives the brand subtitle, tab counts,
 * the presence stack (only the signed-in user is honestly "online") and
 * the ⌘K palette's search data, and is provided to page content via
 * DatasetProvider. Without it the shell renders its static frame.
 */
export function AppShell({ children, dataset }: { children: ReactNode; dataset?: Dataset }) {
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

  const tabs = tabsFor(dataset);
  const team = dataset?.team ?? [];
  const online = [...team]
    .filter((t) => t.online)
    .sort((a, b) => Number(a.you ?? false) - Number(b.you ?? false) || team.indexOf(b) - team.indexOf(a));
  const onlineLabel = `Online now: ${online.map((p) => (p.you ? "you" : p.name)).join(", ")}`;
  const brandSub = dataset
    ? `${dataset.settings.workspaceName} · ${dataset.settings.workspaceScope}`
    : "Dealflow";

  const shell = (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="shell-header">
        <Link href="/app" className="brand" aria-label="Dealflow — Today">
          <span className="mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="wm">
            <b>Dealflow</b>
            <span>{brandSub}</span>
          </span>
        </Link>

        <Suspense fallback={<PillNavFallback tabs={tabs} />}>
          <PillNav tabs={tabs} />
        </Suspense>

        <button type="button" className="searchbox" onClick={() => setPaletteOpen(true)} aria-haspopup="dialog">
          <SearchIcon />
          <span className="grow">Search or jump to a deal</span>
          <span className="kbd">⌘K</span>
        </button>

        {online.length > 0 ? (
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
        ) : null}

        <UserMenu user={dataset?.team.find((p) => p.you)} />
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>{children}</div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <div className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </div>
    </div>
  );

  return dataset ? <DatasetProvider dataset={dataset}>{shell}</DatasetProvider> : shell;
}
