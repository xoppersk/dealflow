"use client";

/** Settings sub-menu + page head, as drawn on M-02…M-05: the .sub pill menu
 *  (Workspace / Pipeline stages / Team / Import — HANDOVER §6, exactly four),
 *  then the 44px title and lede, with the page's actions on the right. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SECTIONS = [
  { href: "/app/settings", label: "Workspace" },
  { href: "/app/settings/stages", label: "Pipeline stages" },
  { href: "/app/settings/team", label: "Team" },
  { href: "/app/settings/import", label: "Import" },
] as const;

export function SettingsSubNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="sub">
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} aria-current={pathname === s.href ? "page" : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

export function SettingsHead({
  title,
  lede,
  actions,
}: {
  title: string;
  lede: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mgmt-head">
      <div>
        <SettingsSubNav />
        <h1 className="h1">{title}</h1>
        <p className="lede">{lede}</p>
      </div>
      {actions}
    </div>
  );
}

/** The amber "N unsaved change(s)" pill drawn on M-02 / M-03. */
export function UnsavedPill({ count }: { count: number }) {
  return (
    <span className="unsaved">
      <i aria-hidden="true" />
      {count} unsaved change{count === 1 ? "" : "s"}
    </span>
  );
}
