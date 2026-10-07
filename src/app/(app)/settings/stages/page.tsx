import type { Metadata } from "next";

import { isManagerOrAdmin, requireUser } from "@/lib/auth";
import { listStages } from "@/lib/actions/stages";
import { Forbidden } from "@/components/reports/page-header";
import { StageManager } from "@/components/settings/stage-list";

export const metadata: Metadata = { title: "Pipeline stages" };

/**
 * /settings/stages — manager/admin only (UI-DESIGN.md 2.13).
 */
export default async function StagesPage() {
  const session = await requireUser();

  if (!isManagerOrAdmin(session.profile.role)) {
    return (
      <Forbidden
        title="Pipeline stages are for managers"
        message="Ask your manager or workspace admin to change the pipeline."
      />
    );
  }

  const result = await listStages();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Couldn&apos;t load stages</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again in a moment.</p>
      </div>
    );
  }

  return <StageManager initial={result.data} />;
}
