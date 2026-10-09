import { TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

export type StatCardTone = "default" | "alert";

export interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  tone?: StatCardTone;
  sparkData?: number[];
  className?: string;
}

/** Dashboard KPI card with tabular numerals and an optional sparkline. */
export function StatCard({
  label,
  value,
  delta,
  tone = "default",
  sparkData,
  className,
}: StatCardProps) {
  return (
    <div className={cn("df-kpi", className)}>
      <span>{label}</span>
      <strong
        style={tone === "alert" ? { color: "var(--urgency-act)" } : undefined}
      >
        {value}
      </strong>
      {delta ? (
        <small
          className={cn(
            "tnum inline-flex items-center gap-0.5",
            tone === "alert" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {tone === "alert" ? (
            <TrendingDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" aria-hidden />
          )}
          {delta}
        </small>
      ) : null}
      {sparkData && sparkData.length > 1 ? (
        <Sparkline data={sparkData} />
      ) : null}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const width = 120;
  const height = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((value, i) => {
      const x = i * step;
      const y = height - 2 - ((value - min) / range) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mt-3 text-primary"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
