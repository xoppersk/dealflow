import Link from "next/link";
import { Suspense } from "react";
import { companyByIdSafe, isOpenDeal, personByIdSafe, stageByIdSafe } from "@/lib/df/api";
import { getDataset } from "@/lib/df/db";
import { dateLabelWithDay, moneyCompact, todayLong } from "@/lib/df/format";
import type { Deal } from "@/lib/df/types";
import "@/styles/daily.css";

/**
 * D-01 Today (/app) — Today.html layout, production data: greeting for the
 * signed-in user, Stuck · whole team computed from real stuck signals
 * (no next step / stale / blocking next step, largest value first), Your
 * day from today's meetings + due next steps, and the 372px side column
 * (newest new lead, Your deals, Coming up) — all from the workspace
 * dataset.
 */

function stuckLine(deal: Deal): { tone: "watch" | "act"; line: string } {
  if (!deal.nextStep) {
    return { tone: "act", line: `No next step. Last touch was ${deal.lastTouchLabel ?? "a while ago"}.` };
  }
  if (deal.stale) {
    return { tone: "watch", line: `No reply in ${deal.daysInStage} days. This stage usually gets a reply sooner.` };
  }
  return {
    tone: "watch",
    line: `${deal.nextStep.text} — due ${deal.nextStep.dueLabel}. The deal can’t move until it’s done.`,
  };
}

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

async function TodayPageInner() {
  const ds = await getDataset();
  const now = new Date();
  const me = personByIdSafe(ds.team, ds.currentUserId);
  const firstName = me?.firstName ?? "there";

  const open = ds.deals.filter(isOpenDeal);
  const stuck = open
    .filter((d) => !d.nextStep || d.stale || d.nextStep.blocks)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const stuckTotal = stuck.reduce((s, d) => s + d.value, 0);

  const myDeals = open
    .filter((d) => d.ownerId === ds.currentUserId)
    .sort((a, b) => b.value - a.value);
  const myTotal = myDeals.reduce((s, d) => s + d.value, 0);

  const todayIso = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);
  const dueSoon = myDeals.filter(
    (d) => d.nextStep && (d.nextStep.dueDate === todayIso || d.nextStep.dueDate === tomorrowIso),
  );
  const todaysMeetings = ds.activities.filter((a) => a.type.startsWith("Meeting") && a.dayLabel === "Today");

  // Newest new lead for the side card: a contact flagged newLead, else the
  // newest deal sitting in the new-lead stage.
  const newLeadContact = ds.contacts.find((c) => c.newLead);
  const newLeadDeal = [...open]
    .filter((d) => d.stageId === "new-lead")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  const newLeadCompany = newLeadDeal
    ? companyByIdSafe(ds.companies, newLeadDeal.companyId)
    : newLeadContact
      ? companyByIdSafe(ds.companies, newLeadContact.companyId)
      : undefined;

  const comingUp = open
    .filter((d) => d.nextStep && d.nextStep.dueDate >= todayIso)
    .sort((a, b) => (a.nextStep!.dueDate).localeCompare(b.nextStep!.dueDate))
    .slice(0, 3);

  return (
    <div className="daily-layout">
      <main className="daily-main">
        <div>
          <div className="eb">
            <i aria-hidden="true" />
            {todayLong(now)}
          </div>
          <h1 className="h1">
            {greeting(now.getHours())}, {firstName}
          </h1>
          <p className="lede">
            {stuck.length > 0 ? (
              <>
                {stuck.length} deal{stuck.length === 1 ? "" : "s"} worth{" "}
                <b className="mono" style={{ fontWeight: 500, color: "var(--ink)" }}>
                  {moneyCompact(stuckTotal)}
                </b>{" "}
                {stuck.length === 1 ? "is" : "are"} stuck without a clear next step.
              </>
            ) : (
              <>Nothing is stuck right now — every open deal has a next step.</>
            )}{" "}
            Your own day has {todaysMeetings.length} meeting{todaysMeetings.length === 1 ? "" : "s"} and{" "}
            {dueSoon.length} thing{dueSoon.length === 1 ? "" : "s"} due by tomorrow.
          </p>
        </div>

        <section className="panel" aria-labelledby="st">
          <div className="ph">
            <h2 id="st">Stuck · whole team</h2>
            <span>Most money at risk first</span>
          </div>
          {stuck.map((deal, i) => {
            const company = companyByIdSafe(ds.companies, deal.companyId);
            const owner = personByIdSafe(ds.team, deal.ownerId);
            const stage = stageByIdSafe(ds.stages, deal.stageId)?.name ?? deal.stageId;
            const copy = stuckLine(deal);
            const last = i === stuck.length - 1;
            if (!company || !owner) return null;
            return (
              <div
                key={deal.id}
                className={`qr${last ? " last" : ""}`}
                style={copy.tone === "act" ? { background: "#FCF6F5" } : undefined}
              >
                <span className="qv">{moneyCompact(deal.value)}</span>
                <span className="mg" aria-hidden="true" style={{ background: company.mgBg, color: company.mgColor }}>
                  {company.initials}
                </span>
                <span>
                  <b>{company.name}</b> · {stage} · {owner.firstName}
                  <small className={copy.tone === "act" ? "u-act" : "u-watch"}>
                    <i aria-hidden="true" />
                    {copy.line}
                  </small>
                </span>
                {!deal.nextStep ? (
                  <Link href={`/app/activities?deal=${deal.id}&log=1`} className="btn sm pri">
                    Ask for a next step
                  </Link>
                ) : deal.ownerId === ds.currentUserId ? (
                  <Link href={`/app/deals/${deal.companyId}`} className="btn sm">
                    Open deal
                  </Link>
                ) : (
                  <Link href={`/app/activities?deal=${deal.id}&log=1`} className="btn sm">
                    Nudge {owner.firstName}
                  </Link>
                )}
              </div>
            );
          })}
          {stuck.length === 0 ? (
            <p style={{ padding: "4px 20px 16px", margin: 0, fontSize: 14, color: "var(--ink-2)" }}>
              No stuck deals — the board is healthy.
            </p>
          ) : null}
        </section>

        <section className="panel" aria-labelledby="yd">
          <div className="ph">
            <h2 id="yd">Your day</h2>
            <span>From your pipeline</span>
          </div>
          {todaysMeetings.map((a, i) => (
            <div key={a.id} className={`ag${i === todaysMeetings.length - 1 && dueSoon.length === 0 ? " last" : ""}`}>
              <span className="tm">{a.timeLabel}</span>
              <span>
                <b>{a.type} · {a.subject}</b>
                <small>{a.detail ?? "Logged today"}</small>
              </span>
              <Link href="/app/activities" className="btn sm">
                Open activities
              </Link>
            </div>
          ))}
          {dueSoon.map((deal, i) => {
            const company = companyByIdSafe(ds.companies, deal.companyId);
            const last = i === dueSoon.length - 1;
            return (
              <div key={deal.id} className={`ag${last ? " last" : ""}`}>
                <span className="tm plain">{deal.nextStep!.dueDate === todayIso ? "Today" : "Tomorrow"}</span>
                <span>
                  <b>{deal.nextStep!.text}</b>
                  <small>
                    {company?.name ?? deal.name} · {moneyCompact(deal.value)} ·{" "}
                    {stageByIdSafe(ds.stages, deal.stageId)?.name ?? deal.stageId}
                  </small>
                </span>
                <Link href={`/app/activities?deal=${deal.id}&log=1`} className="btn sm">
                  Log it
                </Link>
              </div>
            );
          })}
          {todaysMeetings.length === 0 && dueSoon.length === 0 ? (
            <div className="ag last">
              <span className="tm plain">—</span>
              <span>
                <b>Nothing due today</b>
                <small>Your next steps are all further out.</small>
              </span>
              <Link href="/app/pipeline" className="btn sm">
                Open board
              </Link>
            </div>
          ) : null}
        </section>
      </main>

      <aside className="side">
        {newLeadCompany ? (
          <section className="new-lead-card" aria-labelledby="nl">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h2 id="nl" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>
                New lead for you
              </h2>
              <span style={{ fontSize: 12, color: "#9AA8A4" }}>New lead stage</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                className="mg"
                aria-hidden="true"
                style={{ width: 40, height: 40, borderRadius: 12, background: "#E9EEDF", color: "#44562A", fontSize: 14 }}
              >
                {newLeadCompany.initials}
              </span>
              <b style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "#FFFFFF" }}>
                {newLeadCompany.name}
              </b>
            </div>
            <span style={{ color: "#C9D3D0" }}>
              {newLeadContact
                ? `${newLeadContact.name}, ${newLeadContact.title}${newLeadContact.metThrough ? ` · via ${newLeadContact.metThrough}` : ""}`
                : (newLeadDeal?.name ?? "A new deal in the New lead stage.")}
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                href={newLeadDeal ? `/app/deals/${newLeadDeal.companyId}` : "/app/setup/deal"}
                className="btn sm"
                style={{ background: "#FFFFFF", borderColor: "#FFFFFF", color: "var(--ink)" }}
              >
                {newLeadDeal ? "Open the deal" : "Make it a deal"}
              </Link>
              <Link
                href="/app/pipeline"
                className="btn sm"
                style={{ background: "transparent", borderColor: "#45524F", color: "#FFFFFF" }}
              >
                See the board
              </Link>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="mn">
          <h2 id="mn">Your deals this quarter</h2>
          {myDeals.slice(0, 5).map((deal, i) => {
            const company = companyByIdSafe(ds.companies, deal.companyId);
            if (!company) return null;
            return (
              <div key={deal.id} className="ll" style={{ alignItems: "center", borderTop: i === 0 ? 0 : undefined }}>
                <span
                  className="mg"
                  aria-hidden="true"
                  style={{ width: 24, height: 24, borderRadius: 8, fontSize: 10, background: company.mgBg, color: company.mgColor }}
                >
                  {company.initials}
                </span>
                <span>{company.name}</span>
                <i aria-hidden="true" />
                <span className="mono">{moneyCompact(deal.value)}</span>
              </div>
            );
          })}
          {myDeals.length === 0 ? (
            <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "4px 0 10px" }}>
              No open deals in your name yet.
            </p>
          ) : null}
          <div className="deals-total">
            <span style={{ fontSize: 13 }}>Open in your name</span>
            <span className="mono" style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em" }}>
              {moneyCompact(myTotal)}
            </span>
          </div>
        </section>

        <section className="coming-up" aria-labelledby="cu">
          <h2 id="cu" style={{ color: "var(--ink)" }}>
            Coming up
          </h2>
          {comingUp.map((deal) => {
            const company = companyByIdSafe(ds.companies, deal.companyId);
            return (
              <div className="step" key={deal.id}>
                <span className="mono" style={{ color: "var(--muted)" }}>
                  {dateLabelWithDay(`${deal.nextStep!.dueDate}T12:00:00`)}
                </span>
                <span>
                  {deal.nextStep!.text} — {company?.name ?? deal.name}
                </span>
              </div>
            );
          })}
          {comingUp.length === 0 ? (
            <div className="step">
              <span style={{ color: "var(--muted)" }}>No dated next steps coming up.</span>
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

export default function TodayPage() {
  return (
    <Suspense fallback={null}>
      <TodayPageInner />
    </Suspense>
  );
}

export const instant = false;
