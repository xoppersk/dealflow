import { CalendarDays, History, Info, Mail, Phone, StickyNote } from "lucide-react";

import type { ActivityKind } from "@/lib/types";

export type TimelineIconKind = ActivityKind | "stage-change" | "system";

const ICONS: Record<TimelineIconKind, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
  note: StickyNote,
  "stage-change": History,
  system: Info,
};

/** Single-stroke Lucide icon for an activity or system timeline entry. */
export function TypeIcon({ type, className }: { type: TimelineIconKind; className?: string }) {
  const Icon = ICONS[type] ?? Info;
  return <Icon className={`h-4 w-4${className ? ` ${className}` : ""}`} aria-hidden />;
}
