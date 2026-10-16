"use client";

/** M-01 period switch — the screens draw "This quarter" selected; the
 *  switch is interactive local state (fixtures are quarter-to-date). */
import { useState } from "react";
import { Segmented } from "@/components/df/primitives";
import { reportsData } from "@/lib/df/mgmt-data";

export function PeriodSwitch() {
  const [period, setPeriod] = useState(reportsData.defaultPeriod);
  return (
    <Segmented
      label="Period"
      options={reportsData.periods.map((p) => ({ value: p, label: p }))}
      value={period}
      onChange={setPeriod}
    />
  );
}
