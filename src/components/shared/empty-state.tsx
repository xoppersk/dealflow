import * as React from "react";
import {
  Activity,
  Building2,
  Handshake,
  Inbox,
  Search,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type EmptyStateIllustration =
  | "deal"
  | "contact"
  | "company"
  | "activity"
  | "search"
  | "inbox";

const ILLUSTRATIONS: Record<EmptyStateIllustration, LucideIcon> = {
  deal: Handshake,
  contact: Users,
  company: Building2,
  activity: Activity,
  search: Search,
  inbox: Inbox,
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
  const Icon = ILLUSTRATIONS[illustration];
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
