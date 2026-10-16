"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { companyById, contactById, contacts, personById, stageById, weightedForDeal } from "@/lib/df/api";
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
  const company = companyById(deal.companyId);
  const stage = stageById(deal.stageId);
  const owner = personById(deal.ownerId);
  const step = deal.nextStep;
  const weighted = deal.detail?.weighted ?? weightedForDeal(deal);
  const primary = deal.detail?.people[0]
    ? contactById(deal.detail.people[0].contactId)
    : contacts.find((c) => c.companyId === deal.companyId);
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
          due={
            deal.detail
              ? "Due Thu, in 2 days"
              : step.dueLabel.replace(/^Due /, "Due ")
          }
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

      {deal.detail ? (
        <section aria-labelledby="dp-path">
          <h3 id="dp-path" style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>
            Path to signature
          </h3>
          <div className="step">
            <span className="d" style={{ background: "var(--progress)" }}>
              <CheckIcon />
            </span>
            <span>Verbal yes on scope and price</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              Oct 1
            </span>
          </div>
          <div className="step">
            <span className="d" style={{ boxShadow: "inset 0 0 0 2px var(--watch)" }}>
              <i style={{ width: 6, height: 6, borderRadius: 3, background: "var(--watch)" }} />
            </span>
            <span style={{ fontWeight: 600 }}>Legal redlines</span>
            <span className="mono u-watch" style={{ fontSize: 12 }}>
              Oct 8
            </span>
          </div>
          <div className="step">
            <span className="d" style={{ boxShadow: "inset 0 0 0 1.5px var(--control)" }} />
            <span style={{ color: "var(--muted)" }}>Countersigned contract</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              —
            </span>
          </div>
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
