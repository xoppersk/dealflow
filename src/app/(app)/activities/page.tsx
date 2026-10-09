import { requireUser } from "@/lib/auth";
import {
  getActivityCounts,
  listActivities,
  listTeamMembers,
} from "@/lib/actions/activities";
import { PageHeader } from "@/components/shared/page-header";
import { ActivitiesView } from "@/components/activities/activities-view";

type View = "overdue" | "upcoming" | "all";

const VIEWS: View[] = ["overdue", "upcoming", "all"];

/**
 * /activities — follow-up queue (UI-DESIGN.md §2.10).
 * Segmented Overdue/Upcoming/All with counts, filter bar, keyset load-more.
 * ?create=1 opens the activity composer on load.
 */
export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; create?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const view: View = VIEWS.includes(params.view as View) ? (params.view as View) : "overdue";

  const [listResult, countsResult, teamResult] = await Promise.all([
    listActivities({ view }),
    getActivityCounts(),
    listTeamMembers(),
  ]);

  if (!listResult.ok || !countsResult.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <PageHeader title="Activities" />
        <p className="mt-6 text-sm text-destructive">
          {(!listResult.ok && listResult.error) || (!countsResult.ok && countsResult.error) || "Could not load activities"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <PageHeader
          title="Activities"
          kicker="Dealflow / Daily"
          description="Capture calls, notes, tasks, and meetings in one chronological sales record."
        />
      </div>
      <ActivitiesView
        initialView={view}
        initialItems={listResult.data.items}
        initialCursor={listResult.data.nextCursor}
        counts={countsResult.data}
        team={teamResult.ok ? teamResult.data : []}
        openComposer={params.create === "1"}
      />
    </div>
  );
}
