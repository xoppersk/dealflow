"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { companyByIdSafe, contactByIdSafe, personByIdSafe, stageByIdSafe, weightedForDeal } from "@/lib/df/api";
import { useDataset } from "../dataset-context";
import { moneyCompact } from "@/lib/df/format";
import type { Deal } from "@/lib/df/types";
import { CheckIcon } from "../icons";
import { NextStepBox } from "../next-step";
import { Button, Monogram } from "../primitives";

/** One-decimal compact used by the panel's weighted figure ($55.0K on the screen). */
function moneyOneDecimal(value: number): string {
  const k = value / 1000;
  return `$${k.toFixed(1)}K`;
}

/**
 * Selected-deal panel (D-02 aside, 372px) — drawn from Main.html for the
 * selected deal: stat grid, next-step box, "Path to signature" (deals whose
 * fixtures carry the detail block), facts list, Log an activity.
 */
export function DealPanel({ deal }: { deal: Deal }) {
  const router = useRouter();
  const ds = useDataset();
  const company = companyByIdSafe(ds.companies, deal.companyId) ?? {
    id: deal.companyId, name: deal.name, initials: "??", mgBg: "#F1EEE6", mgColor: "#17201E",
  };
  const stage = stageByIdSafe(ds.stages, deal.stageId) ?? {
    id: deal.stageId, name: deal.stageId, winChance: 0, valueSep: 0, staleLimitDays: 14, requires: [],
  };
  const owner = personByIdSafe(ds.team, deal.ownerId) ?? {
    id: deal.ownerId, name: "Owner", firstName: "Owner", initials: "??", email: "", role: "Rep",
    openDeals: 0, openValue: 0, openValueLabel: "", avatarBg: "#F1EEE6", avatarColor: "#17201E", online: false,
  };
  const step = deal.nextStep;
  const weighted = deal.detail?.weighted ?? weightedForDeal(deal, ds.stages);
  const primary = deal.detail?.people[0]
    ? contactByIdSafe(ds.contacts, deal.detail.people[0].contactId)
    : ds.contacts.find((c) => c.companyId === deal.companyId);
  const logHref = `/app/activities?deal=${deal.id}&log=1`;

  return (
    <aside className="deal-panel" aria-labelledby="dp-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="eyebrow">Selected deal</span>
        <Link href={`/app/deals/${deal.companyId}`} style={{ fontSize: 13, fontWeight: 600 }}>
          Open deal
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Monogram initials={company.initials} bg={company.mgBg} color={company.mgColor} large />
        <div>
          <h2 id="dp-title" style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {company.name}
          </h2>
          <div style={{ marginTop: 4, fontSize: 13, color: "var(--muted)" }}>
            {deal.name} · {stage.name}
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div>
          <small>Deal value</small>
          <b>{moneyCompact(deal.value)}</b>
        </div>
        <div>
          <small>Weighted at {stage.winChance}%</small>
          <b style={{ color: "var(--progress)" }}>{moneyOneDecimal(weighted)}</b>
        </div>
      </div>

      {step ? (
        <NextStepBox
          eyebrow={step.blocks ? "Next step · blocks the contract" : "Next step"}
          due={step.dueLabel.replace(/^Due /, "Due ")}
          tone={step.urgency === "watch" ? "watch" : "default"}
          text={step.text}
        >
          <Button variant="pri" onClick={() => router.push(logHref)}>
            Mark done
          </Button>
          <Button onClick={() => router.push(logHref)}>Reschedule</Button>
        </NextStepBox>
      ) : (
        <div className="next-box" style={{ background: "var(--act-tint)", boxShadow: "inset 0 0 0 1px var(--act-line)" }}>
          <div className="head u-act">
            <span>Next step</span>
            <span>None set</span>
          </div>
          <p>Last touch was {deal.lastTouchLabel}. This deal can’t progress without a next step.</p>
          <div className="row">
            <Button variant="pri" onClick={() => router.push(logHref)}>
              Plan the next step
            </Button>
          </div>
        </div>
      )}

      {deal.detail && deal.detail.stageHistory.length > 0 ? (
        <section aria-labelledby="dp-path">
          <h3 id="dp-path" style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>
            Path so far
          </h3>
          {deal.detail.stageHistory.map((h, i) => {
            const hs = stageByIdSafe(ds.stages, h.stageId);
            const isLast = i === deal.detail!.stageHistory.length - 1;
            return (
              <div className="step" key={`${h.stageId}-${i}`}>
                <span className="d" style={isLast ? { boxShadow: "inset 0 0 0 2px var(--watch)" } : { background: "var(--progress)" }}>
                  {isLast ? (
                    <i style={{ width: 6, height: 6, borderRadius: 3, background: "var(--watch)" }} />
                  ) : (
                    <CheckIcon />
                  )}
                </span>
                <span style={isLast ? { fontWeight: 600 } : undefined}>{hs?.name ?? h.stageId}</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                  {h.dateLabel}
                </span>
              </div>
            );
          })}
        </section>
      ) : null}

      <dl className="dl" style={{ margin: 0, paddingTop: 16, borderTop: "1px solid var(--rule)" }}>
        <dt>Owner</dt>
        <dd style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="own"
            style={{ width: 20, height: 20, fontSize: 9.5, background: owner.avatarBg, color: owner.avatarColor }}
            aria-hidden="true"
          >
            {owner.initials}
          </span>
          {owner.name}
        </dd>
        <dt>Contact</dt>
        <dd>{primary ? `${primary.name}, ${primary.title}` : "—"}</dd>
        <dt>In stage</dt>
        <dd>{deal.daysInStage > 0 ? `${deal.daysInStage} days` : deal.enteredStageLabel}</dd>
        <dt>Last touch</dt>
        <dd>{deal.lastTouchLabel ?? "—"}</dd>
      </dl>

      <ButtonLinkBottom href={logHref} />
    </aside>
  );
}

function ButtonLinkBottom({ href }: { href: string }) {
  return (
    <Link href={href} className="btn" style={{ marginTop: "auto" }}>
      Log an activity
    </Link>
  );
}
