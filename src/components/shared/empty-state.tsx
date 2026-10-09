import * as React from "react";

import { cn } from "@/lib/utils";

export type EmptyStateIllustration =
  | "deal"
  | "contact"
  | "company"
  | "activity"
  | "search"
  | "inbox";

/**
 * In-house line illustrations — ascending-bar / inbox / calendar motifs at
 * the same 2px stroke weight as Lucide, warm-gray strokes on paper, one
 * teal accent dot where the focal point sits. Calm and instructional.
 */
function BarsIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <line x1="10" y1="60" x2="62" y2="60" />
      <rect x="16" y="40" width="10" height="20" />
      <rect x="31" y="30" width="10" height="30" />
      <rect x="46" y="18" width="10" height="42" />
      <circle cx="51" cy="12" r="2.5" className="text-primary" fill="currentColor" stroke="none" />
    </svg>
  );
}

function InboxIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d="M12 26h48l-6 28H18l-6-28Z" strokeLinejoin="round" />
      <path d="M12 26l10-10h28l10 10" strokeLinejoin="round" />
      <circle cx="36" cy="42" r="2.5" className="text-primary" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CalendarIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <rect x="14" y="18" width="44" height="40" />
      <line x1="14" y1="30" x2="58" y2="30" />
      <line x1="26" y1="12" x2="26" y2="22" />
      <line x1="46" y1="12" x2="46" y2="22" />
      <circle cx="46" cy="44" r="2.5" className="text-primary" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PeopleIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="28" cy="26" r="8" />
      <path d="M14 58c0-8 6-13 14-13s14 5 14 13" />
      <circle cx="50" cy="30" r="6" />
      <path d="M48 46c6 1 10 5 10 12" />
      <circle cx="50" cy="24" r="2" className="text-primary" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LedgerIllustration() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <rect x="16" y="10" width="40" height="52" />
      <line x1="16" y1="22" x2="56" y2="22" />
      <line x1="24" y1="32" x2="48" y2="32" />
      <line x1="24" y1="40" x2="48" y2="40" />
      <line x1="24" y1="48" x2="40" y2="48" />
      <circle cx="48" cy="48" r="2.5" className="text-primary" fill="currentColor" stroke="none" />
    </svg>
  );
}

const ILLUSTRATIONS: Record<EmptyStateIllustration, () => React.ReactElement> = {
  deal: BarsIllustration,
  contact: PeopleIllustration,
  company: LedgerIllustration,
  activity: CalendarIllustration,
  search: InboxIllustration,
  inbox: InboxIllustration,
};

export interface EmptyStateProps {
  illustration?: EmptyStateIllustration;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  illustration = "search",
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const Art = ILLUSTRATIONS[illustration];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[2px] border border-dashed border-border bg-card px-6 py-12 text-center",
        className
      )}
    >
      <div className="text-muted-foreground" aria-hidden>
        <Art />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
