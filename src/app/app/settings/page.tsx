import SettingsClient from "@/components/df/mgmt/settings-client";
import { Suspense } from "react";
import { getDataset } from "@/lib/df/db";

/** M-02 — Workspace settings (/app/settings) — server shell. */
async function SettingsPageInner() {
  const ds = await getDataset();
  return <SettingsClient dataset={ds} />;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

export const instant = false;
