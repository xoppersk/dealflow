"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

import { formatCompactCurrency, formatCurrency } from "@/lib/format";
import { getReportsData, type ReportsData } from "@/lib/actions/reports";

import { ForecastChart, Leaderboard, StageBarChart, WinRateTrend } from "./charts";
import { ReportFilterBar, type ReportFilters } from "./filter-bar";
import { EmptyState, PageHeader } from "./page-header";
import { StalledTable, downloadCsv } from "./stalled-table";
import { StatCard, StatCardSkeleton } from "./stat-card";

function defaultRange(): ReportFilters {
  const to = new Date();
  const from = new Date(to.getTime() - 89 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to), ownerId: null };
}

function errorMessage(code: string): string {
  switch (code) {
    case "INVALID_RANGE":
      return "The start date must be before the end date.";
    case "FORBIDDEN":
      return "Reports are for managers.";
    default:
      return "Couldn't load the report data.";
  }
}

export function ReportsClient() {
  const router = useRouter();
  const [filters, setFilters] = useState<ReportFilters>(defaultRange);
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async (f: ReportFilters) => {
    setLoading(true);
    setFailed(null);
    const result = await getReportsData({
      from: f.from,
      to: f.to,
      ...(f.ownerId ? { ownerId: f.ownerId } : {}),
    });
    if (result.ok) {
      setData(result.data);
      setTeam(result.data.team);
    } else {
      setFailed(errorMessage(result.error));
    }
    setLoading(false);
  }, []);

  // Initial data load: setState-in-effect is intentional here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (f: ReportFilters) => {
    setFilters(f);
    void load(f);
  };

  const exportForecast = () => {
    if (!data) return;
    downloadCsv(
      "forecast-by-month.csv",
      ["Month", "Weighted", "Raw", "Deals"],
      data.forecastByMonth.map((b) => [b.month, Math.round(b.weighted), Math.round(b.raw), b.count]),
    );
    toast.success("Forecast exported");
  };

  const exportLeaderboard = () => {
    if (!data) return;
    downloadCsv(
      "activity-leaderboard.csv",
      ["Rep", "Activities"],
      data.leaderboard.map((r) => [r.name, r.count]),
    );
    toast.success("Leaderboard exported");
  };

  const boardHref = filters.ownerId ? `/pipeline?owner=${filters.ownerId}` : "/pipeline";

  return (
    <div>
      <Toaster position="bottom-right" />
      <PageHeader
        title="Reports"
        kicker="Dealflow / Management"
        description="Inspect conversion, velocity, pipeline health, and team activity without hiding definitions."
      />

      <ReportFilterBar initial={defaultRange()} team={team} onApply={apply} />

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      )}

      {failed && (
        <EmptyState
          title="Couldn't load reports"
          description={failed}
          action={
            <button
              onClick={() => void load(filters)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          }
        />
      )}

      {!loading && !failed && data && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total open value"
              value={formatCurrency(data.kpis.totalOpenValue, data.currency)}
              hint={`${data.kpis.openDealCount} open deals`}
              href={boardHref}
            />
            <StatCard
              label="Weighted forecast"
              value={formatCurrency(data.kpis.weightedForecast, data.currency)}
              hint="Value × effective probability"
              href={boardHref}
            />
            <StatCard
              label="Win rate · 90 days"
              value={`${data.kpis.winRate90d}%`}
              hint={`${data.kpis.won90d} won · ${data.kpis.lost90d} lost`}
            />
            <StatCard
              label="Activities logged"
              value={String(data.kpis.activitiesInRange)}
              hint="In selected range"
              href="/activities"
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
                  onBarClick={() => router.push(boardHref)}
                />
                <ForecastChart
                  data={data.forecastByMonth}
                  currency={data.currency}
                  onExport={exportForecast}
                />
                <WinRateTrend data={data.winRateTrend} />
                <Leaderboard data={data.leaderboard} onExport={exportLeaderboard} />
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
                      {data.kpis.won90d} won ÷ {data.kpis.won90d + data.kpis.lost90d} closed
                    </time>
                  </div>
                  <div className="flex items-baseline gap-4 border-b border-border py-3">
                    <span className="df-money text-sm">Σ</span>
                    <p className="min-w-0 flex-1">
                      <b className="block text-sm font-semibold">Open value reconciliation</b>
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
                </div>
              </section>

              <StalledTable deals={data.stalled} thresholdDays={data.staleThresholdDays} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
