import * as React from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  /** Mono kicker above the title, e.g. "DEALFLOW / DAILY". */
  kicker?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  kicker,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {kicker ? <p className="df-kicker">{kicker}</p> : null}
        <h1 className="df-page-title">{title}</h1>
        {description ? (
          <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
