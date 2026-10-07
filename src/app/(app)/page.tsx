import Link from "next/link";
import { Check } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/actions/dashboard";
import { formatCurrency } from "@/lib/format";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Greeting } from "@/components/dashboard/greeting";
import { AttentionRow } from "@/components/dashboard/attention-row";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

/**
 * Dashboard — the "Today" view (APP-FLOW.md §3 /, UI-DESIGN.md §2.3).
 * Greeting + stat cards + needs-attention list + live recent-activity feed.
 * Managers also get the team rollup section.
 */
export default async function DashboardPage() {
  const session = await requireUser();
  const result = await getDashboardData();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Couldn&apos;t load your dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const data = result.data;

  // New workspace: hero empty state instead of the dashboard grid.
  if (!data.hasAnyDeals) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
        <Greeting name={data.greetingName} />
        <svg
          className="mt-10 h-24 w-24 text-muted-foreground"
          viewBox="0 0 96 96"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="18" y1="78" x2="78" y2="78" />
          <rect x="24" y="54" width="12" height="24" rx="2" />
          <rect x="42" y="42" width="12" height="36" rx="2" />
          <rect x="60" y="28" width="12" height="50" rx="2" />
          <circle cx="66" cy="20" r="3" className="text-primary" fill="currentColor" stroke="none" />
        </svg>
        <h2 className="mt-6 text-xl font-semibold">Your pipeline starts here</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Add your first contact, then create a deal and start logging activity. Your today view
          will fill in as the pipeline grows.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/contacts?create=1">Add your first contact</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings/import">Import a CSV</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
      <Greeting name={data.greetingName} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open pipeline" value={formatCurrency(stats.openPipelineValue, stats.currency)} />
        <StatCard
          label="Deals by stage"
          value={String(stats.openDealsCount)}
          sparkData={stats.dealsByStage.map((s) => s.count)}
        />
        <StatCard
          label="Overdue follow-ups"
          value={String(stats.overdueCount)}
          tone={stats.overdueCount > 0 ? "alert" : "default"}
        />
        <StatCard label="Activities this week" value={String(stats.activitiesThisWeek)} />
      </div>

      {/* Attention + recent activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-label="Needs attention">
          <h2 className="mb-3 text-base font-semibold">Needs attention</h2>
          {data.needsAttention.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">Nothing needs attention</p>
                <p className="text-xs text-muted-foreground">Enjoy the quiet.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {data.needsAttention.map((item) => (
                <AttentionRow key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </section>

        <section aria-label="Recent activity">
          <h2 className="mb-3 text-base font-semibold">Recent activity</h2>
          <Card>
            <CardContent className="px-4 py-1">
              <ActivityFeed
                initial={data.recentActivity}
                currentUserId={session.id}
                currentUserName={session.profile.full_name}
              />
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Manager variant: team rollup */}
      {data.isManager && data.team && (
        <section aria-label="Team" className="space-y-4 border-t border-border pt-6">
          <h2 className="text-base font-semibold">Team</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Team pipeline"
              value={formatCurrency(data.team.teamPipelineValue, data.team.currency)}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Per rep</CardTitle>
            </CardHeader>
            <CardContent className="px-0 py-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Rep</th>
                    <th className="px-4 py-2 text-right font-medium tabular-nums">Open deals</th>
                    <th className="px-4 py-2 text-right font-medium tabular-nums">Pipeline</th>
                    <th className="px-4 py-2 text-right font-medium tabular-nums">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.team.perRep.map((rep) => (
                    <tr key={rep.userId} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium">{rep.name}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{rep.openDeals}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCurrency(rep.pipelineValue, data.team?.currency ?? "USD")}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums ${rep.overdue > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                      >
                        {rep.overdue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div>
            <h3 className="mb-3 text-sm font-semibold">Stalled across the team</h3>
            {data.team.stalledDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stalled deals. The team is on it.</p>
            ) : (
              <div className="space-y-2">
                {data.team.stalledDeals.map((item) => (
                  <AttentionRow key={`team-${item.id}`} item={item} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
