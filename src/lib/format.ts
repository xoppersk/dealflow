/**
 * Presentation formatting: currency, dates, relative time.
 * All figures use tabular numerals via the `.tnum` utility class.
 */

/** Full currency: $48,500 */
export function formatCurrency(value: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US")}`;
  }
}

/** Compact currency for cards and lists: $48.5K */
export function formatCompactCurrency(value: number, currency = "USD"): string {
  const symbol = currencySymbol(currency);
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${symbol}${trimZeros(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${symbol}${trimZeros(value / 1_000)}K`;
  return `${symbol}${value.toLocaleString("en-US")}`;
}

function trimZeros(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

function currencySymbol(currency: string): string {
  const map: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };
  return map[currency.toUpperCase()] ?? `${currency} `;
}

/** "3 days ago", "in 2 days", "just now" */
export function relativeTime(date: string | Date, now: Date = new Date()): string {
  const d = date instanceof Date ? date : new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const absMs = Math.abs(diffMs);
  const suffix = diffMs >= 0 ? "ago" : "from now";

  const minutes = Math.floor(absMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ${suffix}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ${suffix}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ${suffix}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ${suffix}`;
  const years = Math.floor(months / 12);
  return `${years} yr ${suffix}`;
}

/** "Oct 6, 2026" */
export function formatDate(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "Oct 6" (compact, for cards) */
export function formatShortDate(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "8:45 AM" (task-ledger time cell) */
export function formatTimeOfDay(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "October 8" (due-date labels: "Due October 8", "Overdue · Oct 5" uses short) */
export function formatLongDate(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/** Whole days a deal has sat in its current stage. */
export function daysInStage(stageEnteredAt: string | Date, now: Date = new Date()): number {
  const entered = stageEnteredAt instanceof Date ? stageEnteredAt : new Date(stageEnteredAt);
  return Math.max(0, Math.floor((now.getTime() - entered.getTime()) / (24 * 60 * 60 * 1000)));
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

/** Deterministic initials + hue for avatar fallbacks (zero image payload). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

const AVATAR_HUES = [172, 217, 262, 330, 28, 95, 199, 0];

export function avatarHue(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_HUES[hash % AVATAR_HUES.length] ?? 172;
}
