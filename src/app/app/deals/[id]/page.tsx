import Link from "next/link";
import { Fragment, Suspense } from "react";
import { notFound } from "next/navigation";
import "@/styles/records.css";
import { OwnerAvatar } from "@/components/df/primitives";
import { CheckIcon } from "@/components/df/icons";
import {
  DealHeaderActions,
  FocusNextStep,
  NextStepActions,
  StaleNoticeBlock,
} from "@/components/df/records/deal-client";
import { ToneChip, initialsOf } from "@/components/df/records/shared";
import {
  companyById,
  contactById,
  openStages,
  personById,
  stageById,
  weightedForDeal,
} from "@/lib/df/api";
import { moneyCompact, moneyExact } from "@/lib/df/format";
import {
  dealByCompanySlug,
  dealPage,
  dealPeople,
  staleHeaderSuffix,
  staleNoticeFor,
} from "@/lib/df/records-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function closeLabel(iso?: string): string | null {
  if (!iso) return null;
  const [, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * R-01 Deal detail (/app/deals/[company-slug]) — DealDetail.html screen-exact
 * for Bracken Works; the same layout renders every deal from the fixtures.
 * X-05: a stale deal (Meridian) carries the stale notice on its page;
 * ?state=stale forces the notice for the dev toggle. ?focus=next-step
 * scrolls to and focuses the next-step panel.
 *
 * Params and the query string are dynamic, so the component that awaits
 * them renders inside a Suspense boundary; the static shell still
 * prerenders.
 */
export default function DealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string; state?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <DealInner params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function DealInner({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string; state?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const deal = dealByCompanySlug(id);
  if (!deal) notFound();

  const company = companyById(deal.companyId);
  const owner = personById(deal.ownerId);
  const stage = stageById(deal.stageId);
  const page = dealPage(deal.id);
  const people = dealPeople(deal);
  const step = deal.nextStep;
  const close = closeLabel(deal.closeDate);
  const weighted = deal.detail?.weighted ?? weightedForDeal(deal);

  const showStale = Boolean(deal.stale) || sp.state === "stale";
  const notice = showStale ? staleNoticeFor(deal) : null;

  /* Stage strip (.sg): history labels from the fixture detail block when
     drawn (Bracken), otherwise derived from the stage position. */
  const stripStages = [...openStages, stageById("won")];
  const history = new Map((deal.detail?.stageHistory ?? []).map((h) => [h.stageId, h.dateLabel]));
  const currentIdx = stripStages.findIndex((s) => s.id === deal.stageId);

  return (
    <div className="rec-layout">
      <main className="rec-main">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="rec-crumb">
            <Link href="/app/pipeline">Pipeline</Link> / {stage.name} / {company.name}
          </div>
          <header className="rec-head">
            <div className="rec-head-id">
              <span className="mg rec-mg-lg" aria-hidden="true" style={{ background: company.mgBg, color: company.mgColor }}>
                {company.initials}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                <h1 className="rec-h1">
                  {company.name} · {deal.name}
                </h1>
                <span className="rec-sub">
                  <span className="big">{moneyCompact(deal.value)}</span> · owned by {owner.name}
                  {close ? <> · expected to close {close}</> : null}
                  {staleHeaderSuffix(deal.id) ? <> · {staleHeaderSuffix(deal.id)}</> : null}
                  {deal.presence ? (
                    <>
                      {" · "}
                      <span className="rec-presence">
                        <i />
                        {deal.presence}
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
            <DealHeaderActions deal={deal} />
          </header>
        </div>

        <ol className="rec-stage-strip" aria-label="Stages">
          {stripStages.map((s, i) => {
            const state = i < currentIdx ? "done" : i === currentIdx ? "cur" : "todo";
            const hist = history.get(s.id);
            let small: string | null = null;
            if (hist) {
              if (state === "cur") small = `Day ${deal.daysInStage} · ${hist}`;
              else if (s.id === "won") small = cap(hist);
              else small = hist;
            } else if (state === "cur") {
              small = deal.daysInStage === 0 ? "Just moved" : `Day ${deal.daysInStage}`;
            } else if (s.id === "won" && close) {
              small = `Target ${close}`;
            }
            return (
              <li key={s.id} className={`sg${state === "done" ? " done" : state === "cur" ? " cur" : ""}`} aria-current={state === "cur" ? "step" : undefined}>
                <span className="d" aria-hidden="true">
                  {state === "done" ? (
                    <CheckIcon />
                  ) : state === "cur" ? (
                    <i style={{ width: 6, height: 6, borderRadius: 3, background: "#8FD0C7", display: "block" }} />
                  ) : null}
                </span>
                {s.name}
                {small ? <small>{small}</small> : null}
              </li>
            );
          })}
        </ol>

        {notice ? <StaleNoticeBlock deal={deal} notice={notice} /> : null}

        {!deal.stale ? (
          step ? (
            <section
              id="next-step-panel"
              tabIndex={-1}
              aria-labelledby="ns-title"
              className={`rec-nextstep${step.urgency === "act" ? " act" : step.urgency === "on-track" ? " ontrack" : ""}`}
            >
              <FocusNextStep enabled={sp.focus === "next-step"} />
              <div className="head">
                <h2 id="ns-title" className={step.urgency === "watch" ? "u-watch" : step.urgency === "act" ? "u-act" : undefined}>
                  <i style={{ background: step.urgency === "watch" ? "#9A5B00" : step.urgency === "act" ? "#B4261A" : "#0F6B62" }} />
                  Next step
                </h2>
                <span className={`due u-${step.urgency}`}>
                  {page.nextStepDueHeader ?? (step.dueLabel.startsWith("Due") ? step.dueLabel : `Due ${step.dueLabel}`)}
                </span>
              </div>
              <p className="rec-ns-sentence">{page.nextStepSentence ?? step.text}</p>
              {page.nextStepWhy ? <p className="rec-ns-why">{page.nextStepWhy}</p> : null}
              <NextStepActions />
            </section>
          ) : (
            <section id="next-step-panel" tabIndex={-1} aria-labelledby="ns-title" className="rec-nextstep act">
              <FocusNextStep enabled={sp.focus === "next-step"} />
              <div className="head">
                <h2 id="ns-title" className="u-act">
                  <i style={{ background: "#B4261A" }} />
                  Next step
                </h2>
                <span className="due u-act">No next step</span>
              </div>
              <p className="rec-ns-sentence">No next step is set.</p>
              <p className="rec-ns-why">
                Last touch was {deal.lastTouchLabel}. Every open deal needs a next step before it can move.
              </p>
              <NextStepActions
                primaryLabel="Set the next step"
                secondaryLabel="Log activity"
                primaryMsg="Set the next step — a deal can’t be saved without one and a date."
                secondaryMsg="Log activity — note what happened on the last call."
              />
            </section>
          )
        ) : null}

        <section className="panel" aria-labelledby="tl-title">
          <div className="ph">
            <h2 id="tl-title">Activity</h2>
            <Link href="/app/activities" style={{ fontSize: 13, fontWeight: 600 }}>
              All activity
            </Link>
          </div>
          {page.activities.map((a, i) => {
            const actor = personById(a.ownerId);
            const last = i === page.activities.length - 1;
            return (
              <div
                key={`${a.date}-${a.title}-${i}`}
                className="ev"
                style={{
                  ...(last ? { paddingBottom: 15 } : {}),
                  ...(a.act ? { background: "#FDF6F5" } : {}),
                }}
              >
                <span className="mono">{a.date}</span>
                <OwnerAvatar person={actor} large />
                <span>
                  <b className={a.act ? "u-act" : undefined}>{a.title}</b>
                  {a.subject ? <> · {a.subject}</> : ""}
                  {a.detail ? <small>{a.detail}</small> : null}
                </span>
              </div>
            );
          })}
        </section>
      </main>

      <aside className="side">
        <section>
          <h2 className="lab" style={{ marginBottom: 14 }}>
            The deal
          </h2>
          <dl className="kv">
            <dt>Value</dt>
            <dd className="mono">
              {moneyExact(deal.value)}
              {deal.detail?.composition ? " / year" : ""}
            </dd>
            {deal.detail?.composition ? (
              <>
                <dt>Made of</dt>
                <dd>
                  {deal.detail.composition.map((c, i) => (
                    <Fragment key={c.label}>
                      {i > 0 ? " · " : ""}
                      {i === 0 ? c.label : c.label.toLowerCase()} <span className="mono">{moneyCompact(c.value)}</span>
                    </Fragment>
                  ))}
                  {page.compositionNote ? ` ${page.compositionNote}` : ""}
                </dd>
              </>
            ) : null}
            <dt>Win chance</dt>
            <dd>
              {stage.winChance}% at this stage · <span className="mono">{moneyCompact(weighted)}</span> weighted
            </dd>
            {deal.detail?.source ? (
              <>
                <dt>Source</dt>
                <dd>{cap(deal.detail.source)}</dd>
              </>
            ) : null}
            <dt>Company</dt>
            <dd>
              <Link href={`/app/companies/${company.id}`}>{company.name}</Link>
            </dd>
          </dl>
        </section>

        <section style={{ paddingTop: 20, borderTop: "1px solid var(--rule)" }}>
          <h2>People on this deal</h2>
          {people.map((p, i) => {
            const contact = contactById(p.contactId);
            return (
              <div key={p.contactId} className="pp" style={i === 0 ? { borderTop: 0 } : undefined}>
                <span
                  className="av"
                  aria-hidden="true"
                  style={i === 0 ? { background: "#17201E", color: "#FFFFFF" } : undefined}
                >
                  {initialsOf(contact.name)}
                </span>
                <span>
                  <Link href={`/app/contacts/${contact.id}`}>
                    <b>{contact.name}</b>
                  </Link>{" "}
                  · {contact.title}
                  <small>{p.sub}</small>
                </span>
                <span>{p.chipLabel ? <ToneChip tone={p.chipTone ?? "watch"} label={p.chipLabel} /> : null}</span>
              </div>
            );
          })}
        </section>

        {step?.blocks ? (
          <section className="rec-note">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#66716E" strokeWidth="1.6" aria-hidden="true">
              <rect x="3" y="7" width="10" height="7" rx="1.5" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
            </svg>
            <span>Move to Won stays off until the legal step is done, so the forecast never counts an unsigned contract.</span>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
