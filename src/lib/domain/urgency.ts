/**
 * The strict three-step urgency scale (DESIGN-BRIEF.md §2, UI-DESIGN.md §5).
 *
 * slate = on track, amber = watch, red = act. The same scale appears on
 * deal cards, dashboard lists, and reports so the team learns one language.
 * Days-in-stage: < 7 → slate, 7–14 → amber, > 14 → red.
 */

export type Urgency = "on-track" | "watch" | "act";

export function urgencyForDaysInStage(days: number): Urgency {
  if (days > 14) return "act";
  if (days >= 7) return "watch";
  return "on-track";
}

/** Tailwind classes for the urgency badge (works in light and dark mode). */
export function urgencyBadgeClasses(urgency: Urgency): string {
  switch (urgency) {
    case "act":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "watch":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "on-track":
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  }
}

export function urgencyLabel(urgency: Urgency, days: number): string {
  const unit = days === 1 ? "day" : "days";
  switch (urgency) {
    case "act":
      return `${days} ${unit} — needs action`;
    case "watch":
      return `${days} ${unit} — keep an eye on it`;
    case "on-track":
      return `${days} ${unit} in stage`;
  }
}
