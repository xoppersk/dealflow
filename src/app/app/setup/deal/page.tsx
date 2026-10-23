import { openStagesOf } from "@/lib/df/api";
import { Suspense } from "react";
import { getDataset } from "@/lib/df/db";
import SetupDealForm from "./setup-form";

/**
 * S-02 First deal (/app/setup/deal) — server shell: the user's real
 * stages + companies feed the form; submitting creates the deal through
 * the createDeal action (company inline-created when new).
 */
async function SetupDealPageInner({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const ds = await getDataset();
  const sp = await searchParams;
  return (
    <SetupDealForm
      stages={openStagesOf(ds.stages)}
      companies={ds.companies.map((c) => ({ id: c.id, name: c.name }))}
      preselectCompanyId={sp.company}
    />
  );
}

export default function SetupDealPage(props: Parameters<typeof SetupDealPageInner>[0]) {
  return (
    <Suspense fallback={null}>
      <SetupDealPageInner {...props} />
    </Suspense>
  );
}

export const instant = false;
