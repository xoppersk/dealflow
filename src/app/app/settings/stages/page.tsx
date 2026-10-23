import StagesClient from "@/components/df/mgmt/stages-client";
import { Suspense } from "react";
import { getDataset } from "@/lib/df/db";

/** M-03 — Pipeline stages (/app/settings/stages) — server shell. */
async function StagesPageInner() {
  const ds = await getDataset();
  return <StagesClient dataset={ds} />;
}

export default function StagesPage() {
  return (
    <Suspense fallback={null}>
      <StagesPageInner />
    </Suspense>
  );
}

export const instant = false;
