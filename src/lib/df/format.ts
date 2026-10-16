/** Money + number formatting for Dealflow (HANDOVER §5 rule 3).
 *  Compact on cards and headers ($39.5K, $141K); exact on detail pages,
 *  reports and confirmations ($141,000, −$9.5K weighted). Always DM Mono. */

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
