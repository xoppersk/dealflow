"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SetupChecklistItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  done: boolean;
}

/**
 * "Finish setup" checklist card for workspaces with incomplete onboarding.
 * The dashboard itself renders the empty-state hero for zero-deal
 * workspaces; this card is for the partial-setup states.
 */
export function SetupChecklist({ items }: { items: SetupChecklistItem[] }) {
  const remaining = items.filter((i) => !i.done);
  if (remaining.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Finish setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60",
              item.done && "opacity-60",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                item.done ? "border-transparent bg-primary text-primary-foreground" : "border-border",
              )}
              aria-hidden
            >
              {item.done && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-sm font-medium", item.done && "line-through")}>
                {item.label}
              </span>
              {item.description && (
                <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
              )}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
