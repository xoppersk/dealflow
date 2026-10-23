"use client";

/** M-01 period switch — writes the period to the URL; the server page
 *  recomputes every figure for that window (real dates). */
import { useRouter } from "next/navigation";
import { Segmented } from "@/components/df/primitives";

export function PeriodSwitch({ periods, current }: { periods: string[]; current: string }) {
  const router = useRouter();
  return (
    <Segmented
      label="Period"
      options={periods.map((p) => ({ value: p, label: p }))}
      value={current}
      onChange={(p) => router.push(`/app/reports?period=${encodeURIComponent(p)}`)}
    />
  );
}
