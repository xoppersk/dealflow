"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

import { getReportsData, type ReportsData } from "@/lib/actions/reports";

import { ReportFilterBar, type ReportFilters } from "./filter-bar";
import { EmptyState, PageHeader } from "./page-header";
import { ReportsBody } from "./reports-body";
import { downloadCsv } from "./stalled-table";
import { StatCardSkeleton } from "./stat-card";

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
        <ReportsBody data={data} boardHref={boardHref} onBarClick={() => router.push(boardHref)} onExportForecast={exportForecast} onExportLeaderboard={exportLeaderboard} />
      )}
    </div>
  );
}
