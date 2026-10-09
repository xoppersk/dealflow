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

/* --------------------------------- Pipeline value by stage (Current vs Last) */

/**
 * Artifact compare-rows chart (flagship-ui-designs, dealflow Reports):
 * per-stage Current (deep teal) vs Last period (grey) SVG bars, axis ticks,
 * and the Negotiation-share takeaway. Pure markup — no recharts needed.
 */
export function StageBarChartImpl({
  data,
  currency,
  onBarClick,
}: {
  data: StageBucket[];
  currency: string;
  onBarClick?: (stageId: string) => void;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.value, d.previousValue]));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const previousTotal = data.reduce((sum, d) => sum + d.previousValue, 0);
  const negotiation =
    data.find((d) => d.stageName === "Negotiation") ?? data[data.length - 1];
  const share =
    total > 0 && negotiation
      ? Math.round((negotiation.value / total) * 100)
      : 0;
  const axisMax = Math.ceil(max / 50000) * 50000;
  const ticks = [0, 1, 2, 3, 4].map((i) => (axisMax * i) / 4);

  return (
    <figure
      className="m-0 border border-border bg-card pt-[13px]"
      style={{ borderTop: "2px solid var(--tape-border)" }}
    >
      <div className="mb-4 flex items-start justify-between gap-4 px-5">
        <div>
          <h4 className="font-display text-[17px] font-semibold tracking-tight">
            Pipeline value by stage
          </h4>
          <p className="mt-1 font-mono text-[9px] uppercase leading-relaxed tracking-[0.08em] text-muted-foreground">
            Open opportunity value · {currency} thousands
          </p>
        </div>
        <div
          className="flex items-center gap-3 text-[11px] text-muted-foreground"
          aria-label="Series"
        >
          <span className="flex items-center gap-1.5">
            <i
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ background: "var(--money)" }}
            />
            Current
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-[2px] bg-[#aeb8b1]" />
            Last period
          </span>
        </div>
      </div>
      <div className="px-5 pb-5">
        <div className="grid gap-2.5" role="img" aria-label="Pipeline value by stage, current versus last period">
          {data.map((d) => (
            <button
              key={d.stageId}
              type="button"
              onClick={() => onBarClick?.(d.stageId)}
              className={cn(
                "grid grid-cols-[90px_minmax(0,1fr)_74px] items-center gap-3 text-left",
                onBarClick && "cursor-pointer",
              )}
              aria-label={`${d.stageName}: ${formatCompactCurrency(d.value, currency)} current, ${formatCompactCurrency(d.previousValue, currency)} last period`}
            >
              <span className="truncate text-[11px]">{d.stageName}</span>
              <span className="block h-[26px] bg-muted/60">
                <svg
                  viewBox="0 0 100 26"
                  preserveAspectRatio="none"
                  className="h-full w-full"
                  aria-hidden
                >
                  <rect x="0" y="2" width={(d.value / max) * 100} height="9" fill="var(--money)" />
                  <rect x="0" y="15" width={(d.previousValue / max) * 100} height="7" fill="#aeb8b1" />
                </svg>
              </span>
              <strong className="tnum text-right font-mono text-[11px] font-medium">
                {formatCompactCurrency(d.value, currency)}
              </strong>
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[9px] text-muted-foreground">
          {ticks.map((t) => (
            <span key={t}>{formatCompactCurrency(t, currency)}</span>
          ))}
        </div>
        <figcaption className="mt-4 border-t border-border pt-3">
          <p className="text-[13px]">
            <strong>
              {negotiation ? `${negotiation.stageName} holds ${share}% of pipeline value` : "No open pipeline"}
            </strong>
            {" — clear legal review this week."}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Current stage total {formatCompactCurrency(total, currency)} · last
            period {formatCompactCurrency(previousTotal, currency)}
          </p>
        </figcaption>
      </div>
    </figure>
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
