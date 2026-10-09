"use client";

import Link from "next/link";

import { Card, CardContent } from "./ui";

/**
 * KPI stat card: label, tabular-numeral value, optional hint line.
 * Variants: default / alert (overdue-style red accent).
 */
export function StatCard({
  label,
  value,
  hint,
  variant = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  variant?: "default" | "alert";
  href?: string;
}) {
  const body = (
    <div className={`df-kpi${href ? " transition-colors hover:border-primary/40" : ""}`}>
      <span>{label}</span>
      <strong
        style={variant === "alert" ? { color: "var(--urgency-act)" } : undefined}
      >
        {value}
      </strong>
      {hint && <small className="tnum">{hint}</small>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block" aria-label={`${label}: ${value}`}>
        {body}
      </Link>
    );
  }
  return body;
}

/** Skeleton stat card for the loading state (no layout shift). */
export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-9 w-32 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
