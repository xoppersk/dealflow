/**
 * Stale-deal computation (PRD §2: the 14-day touch rule).
 *
 * A deal is "stalled" when it has no touch (stage change, activity logged, or
 * field updated — all bump `last_touched_at`) for more than the threshold.
 * Closed deals are never stale. The threshold is workspace-configurable;
 * 14 days is the default.
 */

export const DEFAULT_STALE_THRESHOLD_DAYS = 14;

export function isStaleDeal(args: {
  lastTouchedAt: string | Date;
  now?: Date;
  thresholdDays?: number;
  isClosed?: boolean;
}): boolean {
  const {
    lastTouchedAt,
    now = new Date(),
    thresholdDays = DEFAULT_STALE_THRESHOLD_DAYS,
    isClosed = false,
  } = args;

  if (isClosed) return false;

  const touched = lastTouchedAt instanceof Date ? lastTouchedAt : new Date(lastTouchedAt);
  if (Number.isNaN(touched.getTime())) return false;

  const ms = now.getTime() - touched.getTime();
  if (ms < 0) return false; // touched in the future — clock skew, not stale
  return ms > thresholdDays * 24 * 60 * 60 * 1000;
}

/** Whole days between two instants, floored. */
export function wholeDaysBetween(from: string | Date, to: string | Date): number {
  const a = from instanceof Date ? from : new Date(from);
  const b = to instanceof Date ? to : new Date(to);
  return Math.floor((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}
