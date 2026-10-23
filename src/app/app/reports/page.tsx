import { Suspense } from "react";
import { ForbiddenState } from "@/components/df/system/forbidden-state";
import { PeriodSwitch } from "@/components/df/mgmt/period-switch";
import { OwnerAvatar } from "@/components/df/primitives";
import { openStagesOf, personByIdSafe, stageTotal } from "@/lib/df/api";
import { getDataset } from "@/lib/df/db";
import { deltaVsSep, moneyCompact } from "@/lib/df/format";
import { buildReports } from "@/lib/df/mgmt-data";
import "@/styles/mgmt.css";

/**
 * M-01 — Reports (/app/reports), replicated from screens/Reports.html.
 * Every figure is computed from the workspace dataset (mgmt-data
 * buildReports); the period switch (?period=) re-windows closed deals by
 * closed_at and calls by occurred_at. Reps get the X-07 Forbidden state —
 * from their real workspace role, not a URL override.
 */
export default function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  return (
    <Suspense fallback={null}>
      <ReportsInner searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsInner({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const sp = await searchParams;
  const ds = await getDataset();
  if (ds.workspaceRole === "rep") {
    const admin = ds.team.find((p) => p.role === "Admin");
    return <ForbiddenState admin={admin} roleLabel="Rep" />;
  }
  const period = (Array.isArray(sp.period) ? sp.period[0] : sp.period) ?? "This quarter";
  const reportsData = buildReports(ds, period);
  const deals = ds.deals;
  const closed = ds.closed;
  const openStages = openStagesOf(ds.stages);

  const maxStageValue = Math.max(200000, ...openStages.map((s) => stageTotal(deals, s.id)));
  const ownerRows = reportsData.byOwner
    .map((row) => {
      const person = personByIdSafe(ds.team, row.personId);
      if (!person) return null;
      const mine = deals.filter((d) => d.ownerId === person.id && d.stageId !== "won" && d.stageId !== "lost");
      return { row, person, open: mine.length, value: mine.reduce((s, d) => s + d.value, 0) };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <main className="mgmt mgmt-page">
      <div className="mgmt-head">
        <div>
          <h1 className="h1">Reports</h1>
          <p className="lede">{reportsData.lede}</p>
        </div>
        <PeriodSwitch periods={reportsData.periods} current={period} />
      </div>

      <div className="rep-kl" role="list" aria-label="Headline numbers">
        {reportsData.headline.map((k) => (
          <div key={k.label} role="listitem">
            <span>{k.label}</span>
            <b style={k.accent ? { color: "var(--progress)" } : undefined}>
              {k.value}
              {k.unit ? <span className="unit">{k.unit}</span> : null}
            </b>
            <small>{k.note}</small>
          </div>
        ))}
      </div>

      <div className="split-reports">
        <section className="panel" aria-labelledby="sv" style={{ display: "flex", flexDirection: "column" }}>
          <div className="ph">
            <h2 id="sv">Value by stage</h2>
            <span className="legend">
              <span>
                <i className="sw" aria-hidden="true" />
                Bar now
              </span>
              <span>
                <i className="ln" aria-hidden="true" />
                line end of September
              </span>
            </span>
          </div>
          <div style={{ flex: 1, padding: "8px 20px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
            {openStages.map((stage) => {
              const now = stageTotal(deals, stage.id);
              const delta = deltaVsSep(now, stage.valueSep);
              const short = delta.label.replace(" vs Sep", "");
              return (
                <div className="br" key={stage.id}>
                  <span>
                    {stage.name}
                    <small>{stage.winChance}% win</small>
                  </span>
                  <span
                    className="bt"
                    role="img"
                    aria-label={`${stage.name}: ${moneyCompact(now)} now, ${moneyCompact(stage.valueSep)} at end of September`}
                  >
                    <i style={{ width: `${(now / maxStageValue) * 100}%` }} />
                    <i className="marker" style={{ width: `${(stage.valueSep / maxStageValue) * 100}%` }} aria-hidden="true" />
                  </span>
                  <span className="mono val">
                    {moneyCompact(now)}
                    <small className={delta.up ? "up" : "down"}>{short}</small>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="def">{reportsData.stageBarsNote}</p>
        </section>

        <section className="dark-panel" aria-labelledby="ws">
          <div className="ph">
            <h2 id="ws">Won deals, days to close</h2>
            <span>{closed.won} won all-time in this workspace</span>
          </div>
          <div
            className="cy-wrap"
            role="img"
            aria-label={`Days to close for ${closed.won} won deals: ${closed.daysToClose.join(", ")}`}
          >
            {closed.daysToClose.map((days, i) => (
              <i
                key={i}
                className="cy"
                style={{ height: `${closed.daysToClose.length ? Math.round((days / Math.max(...closed.daysToClose)) * 100) : 0}%` }}
              />
            ))}
          </div>
          <p className="def">{reportsData.daysNote}</p>
        </section>
      </div>

      <section className="panel" aria-labelledby="tm" style={{ overflowX: "auto" }}>
        <div className="ph">
          <h2 id="tm">By owner</h2>
          <span>Open now · won this quarter · calls this week</span>
        </div>
        <div style={{ minWidth: 640 }}>
          <div className="tr th" style={{ gridTemplateColumns: "minmax(0,1.3fr) 70px 110px 80px 80px", borderRadius: 0 }}>
            <span>Owner</span>
            <span>Open</span>
            <span>Value</span>
            <span>Won</span>
            <span>Calls</span>
          </div>
          {ownerRows.map(({ row, person, open, value }) => (
            <div className="tr" key={person.id} style={{ gridTemplateColumns: "minmax(0,1.3fr) 70px 110px 80px 80px" }}>
              <span className="who">
                <OwnerAvatar person={person} large />
                <span>
                  {person.name}
                  {row.stuck ? (
                    <small className="watch" style={{ fontWeight: 600 }}>
                      {row.stuck}
                    </small>
                  ) : null}
                </span>
              </span>
              <span className="mono">{open}</span>
              <span className="mono">{moneyCompact(value)}</span>
              <span className="mono">{row.won}</span>
              <span className="mono">{row.calls}</span>
            </div>
          ))}
          <div
            className="tr"
            style={{
              gridTemplateColumns: "minmax(0,1.3fr) 70px 110px 80px 80px",
              fontWeight: 600,
              background: "#F7F6F2",
              borderTop: "1px solid var(--frame)",
              borderRadius: "0 0 12px 12px",
            }}
          >
            <span style={{ paddingLeft: 42 }}>Team</span>
            <span className="mono">{reportsData.teamTotal.open}</span>
            <span className="mono">{reportsData.teamTotal.value}</span>
            <span className="mono">{reportsData.teamTotal.won}</span>
            <span className="mono">{reportsData.teamTotal.calls}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

export const instant = false;
