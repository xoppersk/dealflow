"use client";

/**
 * Dynamically-loaded chart wrappers (bundle gate: recharts must never enter
 * the initial bundle). Each wrapper renders a skeleton with reserved space so
 * there is no layout shift while the chart chunk loads.
 */

import dynamic from "next/dynamic";

import { Card, CardContent } from "./ui";

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="mb-4 h-4 w-64 animate-pulse rounded bg-muted" />
        <div className="w-full animate-pulse rounded bg-muted" style={{ height }} />
      </CardContent>
    </Card>
  );
}

const loading = (height?: number) => {
  function ChartLoading() {
    return <ChartSkeleton height={height} />;
  }
  ChartLoading.displayName = "ChartLoading";
  return ChartLoading;
};

export const StageBarChart = dynamic(
  () => import("./charts-impl").then((m) => m.StageBarChartImpl),
  { ssr: false, loading: loading() },
);

export const ForecastChart = dynamic(
  () => import("./charts-impl").then((m) => m.ForecastChartImpl),
  { ssr: false, loading: loading() },
);

export const WinRateTrend = dynamic(
  () => import("./charts-impl").then((m) => m.WinRateTrendImpl),
  { ssr: false, loading: loading() },
);

export const Leaderboard = dynamic(
  () => import("./charts-impl").then((m) => m.LeaderboardImpl),
  { ssr: false, loading: loading(240) },
);
