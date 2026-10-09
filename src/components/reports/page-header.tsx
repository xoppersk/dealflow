"use client";

import Link from "next/link";

import { Button } from "./ui";

import { PageHeader as SharedPageHeader } from "@/components/shared/page-header";

/** Consistent page header: kicker, title, description, actions slot. */
export function PageHeader({
  title,
  description,
  actions,
  kicker,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  kicker?: string;
}) {
  return (
    <SharedPageHeader
      title={title}
      kicker={kicker}
      description={description}
      actions={actions}
      className="mb-6"
    />
  );
}

/** Designed empty state: line-art slot, title, description, one primary action. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[2px] border border-dashed bg-card px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted" aria-hidden>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
          <path d="M3 20h18" strokeLinecap="round" />
          <rect x="4" y="13" width="4" height="7" rx="1" />
          <rect x="10" y="9" width="4" height="11" rx="1" />
          <rect x="16" y="5" width="4" height="15" rx="1" />
          <circle cx="18" cy="5" r="1.5" fill="var(--primary)" stroke="none" />
        </svg>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

/** 403-style page: "You don't have access to this" + back link. */
export function Forbidden({
  title,
  message,
  backHref = "/",
  backLabel = "Back to dashboard",
}: {
  title: string;
  message: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <div className="df-state-content">
        <h1>You don&apos;t have access to this</h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{title}.</span> {message}{" "}
          Ask your admin if you need it.
        </p>
        <div className="mt-6">
          <Button asChild className="df-state-action border-0">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
