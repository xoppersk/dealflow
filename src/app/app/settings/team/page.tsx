import TeamClient from "@/components/df/mgmt/team-client";
import { Suspense } from "react";
import { getDataset } from "@/lib/df/db";

/** M-04 — Team (/app/settings/team) — server shell. */
async function TeamPageInner() {
  const ds = await getDataset();
  return <TeamClient dataset={ds} />;
}

export default function TeamPage() {
  return (
    <Suspense fallback={null}>
      <TeamPageInner />
    </Suspense>
  );
}

export const instant = false;
