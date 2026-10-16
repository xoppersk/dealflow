import Link from "next/link";
import { companyById, dealById, deals, personById, stageById } from "@/lib/df/api";
import { moneyCompact } from "@/lib/df/format";
import "@/styles/daily.css";

/**
 * D-01 Today (/app) — Today.html: greeting, Stuck · whole team (largest
 * value first, one fix button each), Your day, and the 372px side column
 * (New lead: Halden Outdoor, Your deals $128K, Coming up).
 */

const STUCK_COPY: Record<string, { tone: "watch" | "act"; line: string }> = {
  "bracken-works": {
    tone: "watch",
    line: "Legal redlines due Thu, Oct 8. The contract can’t move until Jordan Bell confirms.",
  },
  "meridian-foods": {
    tone: "watch",
    line: "No reply in 16 days. Proposals here usually get a reply within 7.",
  },
  "kestrel-freight": {
    tone: "act",
    line: "No next step. Last touch was a call on Sep 29.",
  },
};

export default function TodayPage() {
  const stuck = ["bracken-works", "meridian-foods", "kestrel-freight"]
    .map((cid) => deals.find((d) => d.companyId === cid)!)
    .sort((a, b) => b.value - a.value);

  const myDeals = ["vesper-studio", "aurora-biologics", "cedar-and-co"].map(
    (cid) => deals.find((d) => d.companyId === cid)!,
  );
  const myTotal = myDeals.reduce((s, d) => s + d.value, 0);
  const vesper = dealById("vesper-studio-agency-partnership")!;

  return (
    <div className="daily-layout">
      <main className="daily-main">
        <div>
          <div className="eb">
            <i aria-hidden="true" />
            Tuesday, October 6
          </div>
          <h1 className="h1">Good morning, Sheku</h1>
          <p className="lede">
            3 deals worth{" "}
            <b className="mono" style={{ fontWeight: 500, color: "var(--ink)" }}>
              $244.5K
            </b>{" "}
            are stuck without a clear next step. Your own day has 2 meetings and 1 thing due tomorrow.
          </p>
        </div>

        <section className="panel" aria-labelledby="st">
          <div className="ph">
            <h2 id="st">Stuck · whole team</h2>
            <span>Most money at risk first</span>
          </div>
          {stuck.map((deal, i) => {
            const company = companyById(deal.companyId);
            const owner = personById(deal.ownerId);
            const stage = stageById(deal.stageId).name;
            const copy = STUCK_COPY[deal.companyId]!;
            const last = i === stuck.length - 1;
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
                {deal.companyId === "bracken-works" ? (
                  <Link href="/app/deals/bracken-works" className="btn sm">
                    Open deal
                  </Link>
                ) : deal.companyId === "meridian-foods" ? (
                  <Link href={`/app/activities?deal=${deal.id}&log=1`} className="btn sm">
                    Nudge Maya
                  </Link>
                ) : (
                  <Link href={`/app/activities?deal=${deal.id}&log=1`} className="btn sm pri">
                    Ask for a next step
                  </Link>
                )}
              </div>
            );
          })}
        </section>

        <section className="panel" aria-labelledby="yd">
          <div className="ph">
            <h2 id="yd">Your day</h2>
            <span>From your calendar</span>
          </div>
          <div className="ag">
            <span className="tm">11:00</span>
            <span>
              <b>Weekly pipeline review</b>
              <small>30 min · everyone · 8 open deals</small>
            </span>
            <Link href="/app/pipeline" className="btn sm">
              Open board
            </Link>
          </div>
          <div className="ag">
            <span className="tm">13:30</span>
            <span>
              <b>Call · Vesper Studio</b>
              <small>Lena Park, COO · walk through the revised terms draft</small>
            </span>
            <Link href={`/app/activities?deal=${vesper.id}&log=1`} className="btn sm">
              Log the call
            </Link>
          </div>
          <div className="ag last">
            <span className="tm plain">Wed</span>
            <span>
              <b>Send revised terms to Vesper Studio</b>
              <small>Due tomorrow · $48K · Negotiation</small>
            </span>
            <span />
          </div>
        </section>
      </main>

      <aside className="side">
        <section className="new-lead-card" aria-labelledby="nl">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 id="nl" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>
              New lead for you
            </h2>
            <span style={{ fontSize: 12, color: "#9AA8A4" }}>2 h ago</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="mg"
              aria-hidden="true"
              style={{ width: 40, height: 40, borderRadius: 12, background: "#E9EEDF", color: "#44562A", fontSize: 14 }}
            >
              HO
            </span>
            <b style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "#FFFFFF" }}>Halden Outdoor</b>
          </div>
          <span style={{ color: "#C9D3D0" }}>
            Website form from Ines Moreau, Ops Director: “Looking at tools for 40 field staff.”
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href="/app/setup/deal"
              className="btn sm"
              style={{ background: "#FFFFFF", borderColor: "#FFFFFF", color: "var(--ink)" }}
            >
              Make it a deal
            </Link>
            <Link
              href="/app"
              className="btn sm"
              style={{ background: "transparent", borderColor: "#45524F", color: "#FFFFFF" }}
            >
              Pass to Andre
            </Link>
          </div>
        </section>

        <section aria-labelledby="mn">
          <h2 id="mn">Your deals this quarter</h2>
          {myDeals.map((deal, i) => {
            const company = companyById(deal.companyId);
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
          <div className="step">
            <span className="mono" style={{ color: "var(--muted)" }}>
              Thu 14:00
            </span>
            <span>Bracken legal review, Priya with Jordan Bell</span>
          </div>
          <div className="step">
            <span className="mono" style={{ color: "var(--muted)" }}>
              Fri
            </span>
            <span>Aurora pilot scope · Cedar reply expected</span>
          </div>
        </section>
      </aside>
    </div>
  );
}
