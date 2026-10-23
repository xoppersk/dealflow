/** Money + number formatting for Dealflow (HANDOVER §5 rule 3).
 *  Compact on cards and headers ($39.5K, $141K); exact on detail pages,
 *  reports and confirmations ($141,000, −$9.5K weighted). Always DM Mono.
 *  Date helpers format REAL dates (production clock) in the screens' style. */

export function moneyCompact(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1000) {
    const k = abs / 1000;
    const text = Number.isInteger(k) ? String(k) : k.toFixed(1);
    return `${sign}$${text}K`;
  }
  return `${sign}$${abs}`;
}

export function moneyExact(value: number): string {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString("en-US")}`;
}

/** Signed delta label vs September, e.g. "−$8K vs Sep" / "+$12K vs Sep". */
export function deltaVsSep(valueNow: number, valueSep: number): { label: string; up: boolean } {
  const diff = valueNow - valueSep;
  const sign = diff >= 0 ? "+" : "−";
  const abs = Math.abs(diff);
  const k = abs / 1000;
  const text = Number.isInteger(k) ? String(k) : k.toFixed(1);
  return { label: `${sign}$${text}K vs Sep`, up: diff >= 0 };
}

/* ---------------- real-date helpers ---------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "Oct 3" */
export function dateLabel(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Thu, Oct 8" */
export function dateLabelWithDay(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Tue, Oct 6" for today (real clock). */
export function todayLabel(now: Date = new Date()): string {
  return dateLabelWithDay(now);
}

/** "Tuesday, October 6, 2026" for today (real clock). */
export function todayLong(now: Date = new Date()): string {
  return `${DAYS_LONG[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

/** "10:12" (24h, as drawn). */
export function timeLabel(value: string | Date): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Whole days from `from` to `to` (floored, never negative). */
export function wholeDays(from: string | Date, to: string | Date): number {
  const a = toDate(from).getTime();
  const b = toDate(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.floor((b - a) / 86_400_000));
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Timeline group label for an instant: "Today" / "Yesterday" / "Oct 3". */
export function dayGroupLabel(value: string | Date, now: Date = new Date()): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  if (sameDay(d, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return "Yesterday";
  return dateLabel(d);
}

/** Card footer: "3 days" / "1 day" / "Today". */
export function enteredStageLabel(daysInStage: number): string {
  if (daysInStage <= 0) return "Today";
  return daysInStage === 1 ? "1 day" : `${daysInStage} days`;
}

/** ISO yyyy-mm-dd for a Date (local time). */
export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
