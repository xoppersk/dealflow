import { notFound } from "next/navigation";

import { DealDetailView, DealNotFound } from "@/components/deals/deal-detail-view";
import { getDeal, listStages } from "@/lib/actions/deals";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Deal",
};

/**
 * /deals/[id] — deal detail (APP-FLOW.md §3, UI-DESIGN.md §2.5).
 *
 * Server Component: gates on the session, loads the deal (company, owner,
 * contacts, attachments, stage history, activities) plus the stage list for
 * the move menu, and hands everything to the client detail view.
 */
export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;

  const [dealResult, stagesResult] = await Promise.all([getDeal(id), listStages()]);

  if (!dealResult.ok) {
    if (dealResult.error === "Deal not found.") notFound();
    return <DealNotFound />;
  }

  return (
    <DealDetailView
      data={dealResult.data}
      stages={stagesResult.ok ? stagesResult.data : []}
      currentUser={{
        id: session.id,
        name: session.profile.full_name,
        avatarUrl: session.profile.avatar_url,
        role: session.profile.role,
      }}
    />
  );
}
