import "@/styles/mgmt.css";
import { Suspense } from "react";
import ImportClient from "@/components/df/mgmt/import-client";
import { SettingsHead } from "@/components/df/mgmt/settings-head";
import { getDataset } from "@/lib/df/db";

/** M-05 — Import (/app/settings/import) — server shell; the client runs
 *  the real CSV upload → check → commit flow against the live dataset. */
async function ImportPageInner() {
  const ds = await getDataset();
  return (
    <>
      <SettingsHead
        title="Import contacts"
        lede="Bring a CSV of contacts — Dealflow checks it against this workspace before anything is written."
      />
      <ImportClient dataset={ds} />
    </>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={null}>
      <ImportPageInner />
    </Suspense>
  );
}

export const instant = false;
