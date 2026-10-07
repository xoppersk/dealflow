/**
 * Forecast math (IMPLEMENTATION-PLAN.md: weighted = Σ value × effective probability).
 *
 * Effective probability = the deal's own probability when set, otherwise the
 * current stage's default_probability. Kept deliberately simple and
 * explainable — the in-app tooltip documents the formula.
 */

export function effectiveProbability(
  dealProbability: number | null,
  stageDefaultProbability: number,
): number {
  if (dealProbability !== null && Number.isFinite(dealProbability)) {
    return Math.min(100, Math.max(0, Math.round(dealProbability)));
  }
  return Math.min(100, Math.max(0, stageDefaultProbability));
}

/** Weighted value of a single deal: value × effective probability / 100. */
export function weightedValue(value: number, probabilityPercent: number): number {
  return (Math.max(0, value) * Math.min(100, Math.max(0, probabilityPercent))) / 100;
}

export interface ForecastDeal {
  value: number;
  probability: number | null;
  stageDefaultProbability: number;
}

/** Sum of weighted values across open deals. */
export function forecastTotal(deals: ForecastDeal[]): number {
  return deals.reduce(
    (sum, d) =>
      sum + weightedValue(d.value, effectiveProbability(d.probability, d.stageDefaultProbability)),
    0,
  );
}

/** Win rate over a period: won / (won + lost). 0 when there are no closed deals. */
export function winRate(wonCount: number, lostCount: number): number {
  const total = wonCount + lostCount;
  if (total <= 0) return 0;
  return wonCount / total;
}

/** Group weighted forecast by close month ("2026-10" keys). */
export function forecastByCloseMonth(
  deals: (ForecastDeal & { closeDate: string | null })[],
): { month: string; weighted: number; raw: number; count: number }[] {
  const buckets = new Map<string, { weighted: number; raw: number; count: number }>();
  for (const d of deals) {
    if (!d.closeDate) continue;
    const month = d.closeDate.slice(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const entry = buckets.get(month) ?? { weighted: 0, raw: 0, count: 0 };
    entry.weighted += weightedValue(
      d.value,
      effectiveProbability(d.probability, d.stageDefaultProbability),
    );
    entry.raw += Math.max(0, d.value);
    entry.count += 1;
    buckets.set(month, entry);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, v]) => ({ month, ...v }));
}
