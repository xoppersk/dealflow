"use client";

/**
 * Recharts chart implementations for the reports page.
 *
 * This module imports recharts directly and is ONLY loaded through
 * next/dynamic with ssr:false (see charts.tsx) — the bundle gate forbids
 * recharts in the initial server/client bundle. All colors come from CSS
 * variables (--chart-1..5) so charts re-theme automatically in dark mode.
 */

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompactCurrency } from "@/lib/format";
import type {
  ForecastBucket,
  LeaderboardRow,
  StageBucket,
  WinRateWeek,
} from "@/lib/actions/reports";

import { cn } from "./ui";

const TICK = { fill: "var(--muted-foreground)", fontSize: 12 } as const;

export function ChartCard({
  title,
  description,
  actions,
  children,
  height = 280,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <figure
      className="m-0 border border-border bg-card pt-[13px]"
      style={{ borderTop: "2px solid var(--tape-border)" }}
    >
      <div className="mb-4 flex items-start justify-between gap-4 px-5">
        <div>
          <h4 className="font-display text-[17px] font-semibold tracking-tight">
            {title}
          </h4>
          {description && (
            <p className="mt-1 font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      <div className="px-5 pb-5">
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      </div>
    </figure>
  );
}

function ChartTooltip({ active, payload, label, formatter }: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="tnum text-muted-foreground">
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {formatter && typeof p.value === "number" ? formatter(p.value, p.name ?? "") : p.value}
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------- Pipeline by stage */

export function StageBarChartImpl({
  data,
  currency,
  onBarClick,
}: {
  data: StageBucket[];
  currency: string;
  onBarClick?: (stageId: string) => void;
}) {
  const chartData = data.map((d) => ({ ...d, label: formatCompactCurrency(d.value, currency) }));
  return (
    <ChartCard title="Pipeline value by stage" description="Open deals grouped by stage">
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={TICK} domain={[0, "dataMax"]} tickFormatter={(v: number) => formatCompactCurrency(v, currency)} />
        <YAxis type="category" dataKey="stageName" tick={TICK} width={110} />
        <Tooltip content={<ChartTooltip formatter={(v) => formatCompactCurrency(v, currency)} />} cursor={{ fill: "var(--muted)" }} />
        <Bar
          dataKey="value"
          name="Value"
          radius={[0, 4, 4, 0]}
          onClick={(entry) => {
            const stageId = (entry as unknown as StageBucket | undefined)?.stageId;
            if (stageId && onBarClick) onBarClick(stageId);
          }}
          className={cn(onBarClick && "cursor-pointer")}
        >
          {chartData.map((d) => (
            <Cell key={d.stageId} fill={d.color} />
          ))}
          <LabelList dataKey="label" position="right" style={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ChartCard>
  );
}

/* ---------------------------------------------------------- Forecast chart */

export function ForecastChartImpl({
  data,
  currency,
  onExport,
}: {
  data: ForecastBucket[];
  currency: string;
  onExport?: () => void;
}) {
  const [mode, setMode] = useState<"weighted" | "raw">("weighted");
  const dataKey = mode === "weighted" ? "weighted" : "raw";
  const chartData = data.map((d) => ({
    ...d,
    label: formatCompactCurrency(d[dataKey], currency),
  }));

  return (
    <ChartCard
      title="Forecast by close month"
      description="Weighted = value × effective probability"
      actions={
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5 text-xs" role="tablist" aria-label="Forecast mode">
            {(["weighted", "raw"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded px-2.5 py-1 font-medium capitalize transition-colors",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          {onExport && (
            <button
              onClick={onExport}
              className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Export CSV
            </button>
          )}
        </div>
      }
    >
      <BarChart data={chartData} margin={{ left: 8, right: 8, top: 16, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="monthLabel" tick={TICK} interval={0} angle={data.length > 6 ? -20 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 48 : 28} />
        <YAxis tick={TICK} domain={[0, "dataMax"]} width={64} tickFormatter={(v: number) => formatCompactCurrency(v, currency)} />
        <Tooltip content={<ChartTooltip formatter={(v) => formatCompactCurrency(v, currency)} />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey={dataKey} name={mode === "weighted" ? "Weighted" : "Raw"} fill="var(--chart-2)" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="label" position="top" style={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ChartCard>
  );
}

/* ------------------------------------------------------------ Win rate trend */

export function WinRateTrendImpl({ data }: { data: WinRateWeek[] }) {
  return (
    <ChartCard title="Win rate trend" description="Won vs lost per week, trailing 90 days">
      <ComposedChart data={data} margin={{ left: 8, right: 8, top: 16, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="weekLabel" tick={TICK} interval={2} />
        <YAxis
          yAxisId="rate"
          tick={TICK}
          domain={[0, 100]}
          width={44}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis yAxisId="count" orientation="right" tick={TICK} width={32} allowDecimals={false} />
        <Tooltip
          content={
            <ChartTooltip
              formatter={(v, name) => (name === "Win rate" ? `${v}%` : `${v} deals`)}
            />
          }
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar yAxisId="count" dataKey="won" name="Won" fill="var(--success)" radius={[3, 3, 0, 0]} barSize={10} />
        <Bar yAxisId="count" dataKey="lost" name="Lost" fill="var(--closed-lost)" radius={[3, 3, 0, 0]} barSize={10} />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="rate"
          name="Win rate"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--chart-1)" }}
        >
          <LabelList
            dataKey="rate"
            position="top"
            formatter={(v: unknown) => (typeof v === "number" && v > 0 ? `${v}%` : "")}
            style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
        </Line>
      </ComposedChart>
    </ChartCard>
  );
}

/* -------------------------------------------------------------- Leaderboard */

export function LeaderboardImpl({ data, onExport }: { data: LeaderboardRow[]; onExport?: () => void }) {
  const top = data.slice(0, 8);
  return (
    <ChartCard
      title="Activity leaderboard"
      description="Activities logged per rep in range"
      height={Math.max(200, top.length * 36 + 40)}
      actions={
        onExport && top.length > 0 ? (
          <button
            onClick={onExport}
            className="rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Export CSV
          </button>
        ) : undefined
      }
    >
      <BarChart data={top} layout="vertical" margin={{ left: 8, right: 44, top: 4, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={TICK} domain={[0, "dataMax"]} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={TICK} width={110} />
        <Tooltip content={<ChartTooltip formatter={(v) => `${v} activities`} />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" name="Activities" fill="var(--chart-3)" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="count" position="right" style={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ChartCard>
  );
}
