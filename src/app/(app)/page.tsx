import Link from "next/link";
import { Check } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/actions/dashboard";
import { formatCompactCurrency, formatCurrency, formatTimeOfDay } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Greeting } from "@/components/dashboard/greeting";
import { AttentionRow } from "@/components/dashboard/attention-row";

function todayKicker(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Today — the rep's morning desk (flagship-ui-designs, Dealflow / Screens).
 * Stat ledger, "Due next steps" task queue sorted by urgency, and the live
 * recent-activity rail. Managers also get the team rollup.
 */
export default async function DashboardPage() {
  await requireUser();
  const result = await getDashboardData();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="df-state-content">
          <h1>Couldn&apos;t load your dashboard</h1>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            {result.error}
          </p>
          <div className="mt-6 flex gap-2">
            <Link href="/" className="df-state-action inline-flex items-center">
              Try again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const data = result.data;

  // New workspace: hero empty state instead of the desk.
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
          <rect x="24" y="54" width="12" height="24" />
          <rect x="42" y="42" width="12" height="36" />
          <rect x="60" y="28" width="12" height="50" />
          <circle cx="66" cy="20" r="3" className="text-primary" fill="currentColor" stroke="none" />
        </svg>
        <h2 className="font-display mt-6 text-2xl font-semibold">Your pipeline starts here</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Add your first contact, then create a deal and start logging activity.
          Your today view will fill in as the pipeline grows.
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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="df-kicker">{todayKicker()}</p>
          <h1 className="df-page-title">Today</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            A rep&apos;s morning desk, ordered by urgency: clear overdue work
            first, then move through today&apos;s next steps and meetings.
          </p>
        </div>
        <Button asChild className="h-11 shrink-0">
          <Link href="/activities?create=1">Log activity</Link>
        </Button>
      </div>

      {/* Stat ledger (flagship-ui-designs, Dealflow / Screens — Today) */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="df-kpi">
          <span>Due today</span>
          <strong>{stats.dueTodayCount}</strong>
          <small>{stats.overdueCount} overdue</small>
        </div>
        <div className="df-kpi">
          <span>Value in motion</span>
          <strong style={{ color: "var(--money)" }}>
            {formatCompactCurrency(stats.valueInMotion, stats.currency)}
          </strong>
          <small>
            Across {stats.valueInMotionDeals}{" "}
            {stats.valueInMotionDeals === 1 ? "deal" : "deals"}
          </small>
        </div>
        <div className="df-kpi">
          <span>Meetings</span>
          <strong>{stats.meetingsCount}</strong>
          <small>
            {stats.nextMeetingAt
              ? `Next at ${formatTimeOfDay(stats.nextMeetingAt)}`
              : "None today"}
          </small>
        </div>
        <div className="df-kpi">
          <span>Open pipeline</span>
          <strong style={{ color: "var(--money)" }}>
            {formatCompactCurrency(stats.openPipelineValue, stats.currency)}
          </strong>
          <small>
            {stats.openDealsCount} {stats.openDealsCount === 1 ? "deal" : "deals"}
          </small>
        </div>
      </div>

      {/* Morning grid: due-next-steps ledger + today's meetings rail */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-label="Due next steps">
          <div className="df-section-rule">
            <h4>Due next steps</h4>
            <span>Sorted by urgency</span>
          </div>
          {data.needsAttention.length === 0 ? (
            <div className="mt-2 flex items-center gap-3 border border-border bg-card px-4 py-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium">Nothing needs attention</p>
                <p className="text-xs text-muted-foreground">Enjoy the quiet.</p>
              </div>
            </div>
          ) : (
            <div className="mt-2 grid gap-2">
              {data.needsAttention.map((item) => (
                <AttentionRow key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </section>

        <aside aria-label="Today's meetings">
          <div className="df-section-rule">
            <h4>Today&apos;s meetings</h4>
            <span>{data.meetingsToday.length} scheduled</span>
          </div>
          <div className="mt-2">
            {data.meetingsToday.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No meetings on the calendar today.
              </p>
            ) : (
              data.meetingsToday.map((m) => (
                <article key={m.id} className="df-meeting">
                  <time>{formatTimeOfDay(m.startsAt)}</time>
                  <b>{m.title}</b>
                  <small>{m.detail}</small>
                </article>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* Manager variant: team rollup */}
      {data.isManager && data.team && (
        <section aria-label="Team" className="mt-10 border-t-2 border-[var(--tape-border)] pt-6">
          <div className="df-section-rule">
            <h4>Team</h4>
            <span>Pipeline rollup</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="df-kpi">
              <span>Team pipeline</span>
              <strong>
                {formatCompactCurrency(data.team.teamPipelineValue, data.team.currency)}
              </strong>
              <small>All open deals</small>
            </div>
          </div>

          <div className="mt-4 border border-border bg-card">
            <table className="df-table">
              <thead>
                <tr>
                  <th>Rep</th>
                  <th className="text-right">Open deals</th>
                  <th className="text-right">Pipeline</th>
                  <th className="text-right">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.team.perRep.map((rep) => (
                  <tr key={rep.userId}>
                    <td className="font-medium">{rep.name}</td>
                    <td className="df-money text-right">{rep.openDeals}</td>
                    <td className="df-money text-right">
                      {formatCurrency(rep.pipelineValue, data.team?.currency ?? "USD")}
                    </td>
                    <td
                      className={`tnum text-right ${
                        rep.overdue > 0 ? "font-semibold text-[var(--urgency-act)]" : "text-muted-foreground"
                      }`}
                    >
                      {rep.overdue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <div className="df-section-rule">
              <h4>Stalled across the team</h4>
            </div>
            {data.team.stalledDeals.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No stalled deals. The team is on it.
              </p>
            ) : (
              <div className="mt-2 grid gap-2">
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
