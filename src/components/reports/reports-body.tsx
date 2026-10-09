
import { formatCompactCurrency, formatLongDate, initials } from "@/lib/format";
import type { ReportsData } from "@/lib/actions/reports";

import { ForecastChart, Leaderboard, StageBarChart, WinRateTrend } from "./charts";
import { EmptyState } from "./page-header";
import { StalledTable } from "./stalled-table";
import { StatCard } from "./stat-card";

/**
 * Reports body (flagship-ui-designs, Dealflow / Screens — Reports).
 *
 * KPI ledger: Open pipeline / Weighted forecast / Negotiation / Period
 * change. Pipeline-value-by-stage chart with Current vs Last period bars.
 * Calculation notes keep every definition beside its metric:
 * Win rate · Average cycle length · Open value reconciliation · the top
 * open deal (the artifact's "Bracken Works" note).
 */
export function ReportsBody({
  data,
  boardHref,
  onBarClick,
  onExportForecast,
  onExportLeaderboard,
}: {
  data: ReportsData;
  boardHref: string;
  onBarClick: () => void;
  onExportForecast: () => void;
  onExportLeaderboard: () => void;
}) {
  const negotiation =
    data.pipelineByStage.find((s) => s.stageName === "Negotiation") ??
    data.pipelineByStage[data.pipelineByStage.length - 1];
  const negotiationValue = negotiation?.value ?? 0;
  const negotiationShare =
    data.kpis.totalOpenValue > 0
      ? Math.round((negotiationValue / data.kpis.totalOpenValue) * 100)
      : 0;
  const periodChange =
    data.kpis.previousOpenValue > 0
      ? Math.round(
          (data.kpis.totalOpenValue / data.kpis.previousOpenValue - 1) * 100,
        )
      : 0;
  const { topDeal } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open pipeline"
          variant="money"
          value={formatCompactCurrency(data.kpis.totalOpenValue, data.currency)}
          hint={`${data.kpis.openDealCount} open deals`}
          href={boardHref}
        />
        <StatCard
          label="Weighted forecast"
          variant="money"
          value={formatCompactCurrency(data.kpis.weightedForecast, data.currency)}
          hint="Stage probability applied"
          href={boardHref}
        />
        <StatCard
          label="Negotiation"
          variant="money"
          value={formatCompactCurrency(negotiationValue, data.currency)}
          hint={`${negotiationShare}% of open value`}
          href={boardHref}
        />
        <StatCard
          label="Period change"
          value={`${periodChange > 0 ? "+" : ""}${periodChange}%`}
          hint="Versus last period"
        />
      </div>

      {data.kpis.openDealCount === 0 && data.leaderboard.length === 0 ? (
        <EmptyState
          title="Not enough data for this period"
          description="Try widening the date range, or add deals and log activities to see trends."
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <StageBarChart
              data={data.pipelineByStage}
              currency={data.currency}
              onBarClick={onBarClick}
            />
            <ForecastChart
              data={data.forecastByMonth}
              currency={data.currency}
              onExport={onExportForecast}
            />
            <WinRateTrend data={data.winRateTrend} />
            <Leaderboard data={data.leaderboard} onExport={onExportLeaderboard} />
          </div>

          {/* Calculation notes — definitions beside every metric. */}
          <section aria-label="Calculation notes">
            <div className="df-section-rule">
              <h4>Calculation notes</h4>
              <span>Same records, visible definitions</span>
            </div>
            <div className="mt-2 border border-border bg-card px-4">
              <div className="flex items-baseline gap-4 border-b border-border py-3">
                <span className="df-money text-sm">{data.kpis.winRate90d}%</span>
                <p className="min-w-0 flex-1">
                  <b className="block text-sm font-semibold">Win rate</b>
                  <small className="block text-xs text-muted-foreground">
                    Won deals divided by all closed-won and closed-lost
                    deals. Open deals are excluded.
                  </small>
                </p>
                <time className="tnum shrink-0 text-xs text-muted-foreground">
                  {data.kpis.won90d} / {data.kpis.won90d + data.kpis.lost90d}
                </time>
              </div>
              {data.kpis.averageCycleDays != null && (
                <div className="flex items-baseline gap-4 border-b border-border py-3">
                  <span className="df-money text-sm">
                    {data.kpis.averageCycleDays}
                  </span>
                  <p className="min-w-0 flex-1">
                    <b className="block text-sm font-semibold">
                      Average cycle length
                    </b>
                    <small className="block text-xs text-muted-foreground">
                      Calendar days from creation to closed-won across the
                      same {data.kpis.wonCycleCount}{" "}
                      {data.kpis.wonCycleCount === 1 ? "won record" : "won records"}.
                    </small>
                  </p>
                  <time className="tnum shrink-0 text-xs text-muted-foreground">
                    {data.kpis.wonCycleTotalDays} / {data.kpis.wonCycleCount} days
                  </time>
                </div>
              )}
              <div className="flex items-baseline gap-4 border-b border-border py-3">
                <span className="df-money text-sm">Σ</span>
                <p className="min-w-0 flex-1">
                  <b className="block text-sm font-semibold">
                    Open value reconciliation
                  </b>
                  <small className="block text-xs text-muted-foreground">
                    {data.pipelineByStage
                      .map((s) => formatCompactCurrency(s.value, data.currency))
                      .join(" + ")}
                  </small>
                </p>
                <time className="df-money shrink-0 text-sm">
                  {formatCompactCurrency(data.kpis.totalOpenValue, data.currency)}
                </time>
              </div>
              {topDeal && (
                <div className="flex items-baseline gap-4 py-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-semibold text-muted-foreground"
                    aria-hidden
                  >
                    {initials(topDeal.companyName)}
                  </span>
                  <p className="min-w-0 flex-1">
                    <b className="block text-sm font-semibold">
                      {topDeal.companyName}
                    </b>
                    <small className="block text-xs text-muted-foreground">
                      {topDeal.stageName} · {topDeal.daysInStage}{" "}
                      {topDeal.daysInStage === 1 ? "day" : "days"}
                      {topDeal.nextStepTitle && topDeal.nextStepDue
                        ? ` · ${topDeal.nextStepTitle} due ${formatLongDate(topDeal.nextStepDue)}`
                        : ""}
                    </small>
                  </p>
                  <time className="df-money shrink-0 text-sm">
                    {formatCompactCurrency(topDeal.value, topDeal.currency)}
                  </time>
                </div>
              )}
            </div>
          </section>

          <StalledTable deals={data.stalled} thresholdDays={data.staleThresholdDays} />
        </>
      )}
    </div>
  );
}
