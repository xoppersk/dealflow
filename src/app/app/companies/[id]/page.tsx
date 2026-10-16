import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import "@/styles/records.css";
import { ButtonLink } from "@/components/df/primitives";
import { PlusIcon } from "@/components/df/icons";
import { RichText, ToneChip, initialsOf } from "@/components/df/records/shared";
import { deals, personById, stageById } from "@/lib/df/api";
import { moneyCompact } from "@/lib/df/format";
import {
  colleaguesOfCompany,
  companyBySlug,
  companyDetail,
  companyOneLineParts,
  companyPersonDate,
  contactDetail,
} from "@/lib/df/records-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function closeLabel(iso?: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

const HEALTH_DOT: Record<string, string> = {
  watch: "#9A5B00",
  act: "#B4261A",
  "on-track": "#0F6B62",
  neutral: "#0F6B62",
};

/**
 * R-05 Company detail (/app/companies/[company-slug]) — CompanyDetail.html
 * screen-exact for Bracken Works; the same layout renders every company
 * from the fixtures + records.json detail.
 *
 * Params are dynamic, so the component that awaits them renders inside a
 * Suspense boundary; the static shell still prerenders.
 */
export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <CompanyDetailInner params={params} />
    </Suspense>
  );
}

async function CompanyDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = companyBySlug(id);
  if (!company) notFound();

  const detail = companyDetail(company.id);
  const companyDeals = deals.filter((d) => d.companyId === company.id);
  const people = colleaguesOfCompany(company.id);
  const accountOwnerId = companyDeals[0]?.ownerId ?? "maya-jordan";
  const accountOwner = personById(accountOwnerId);
  const headerLine = [detail.industryFull, detail.sizeShort, detail.city, `account owner ${accountOwner.name}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rec-layout">
      <main className="rec-main">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="rec-crumb">
            <Link href="/app/companies">Companies</Link> / {company.name}
          </div>
          <header className="rec-head">
            <div className="rec-head-id">
              <span className="mg rec-mg-lg" aria-hidden="true" style={{ background: company.mgBg, color: company.mgColor }}>
                {company.initials}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                <h1 className="rec-h1">{company.name}</h1>
                <span style={{ fontSize: 14, color: "var(--ink-2)" }}>{headerLine}</span>
              </div>
            </div>
            <div className="rec-actions">
              <ButtonLink href="/app/contacts">Add contact</ButtonLink>
              <ButtonLink href={`/app/deals/${company.id}`} variant="pri">
                <PlusIcon />
                New deal
              </ButtonLink>
            </div>
          </header>
        </div>

        <section className="rec-sum" aria-labelledby="ol-title">
          <h2 id="ol-title" className="eb">
            <i style={{ background: HEALTH_DOT[detail.oneLineTone] }} />
            The account in one line
          </h2>
          <p>
            <RichText parts={companyOneLineParts(company.id)} />
          </p>
        </section>

        <section className="panel" aria-labelledby="deals-title" style={{ paddingBottom: 4 }}>
          <div className="ph">
            <h2 id="deals-title">Deals</h2>
            <span>
              {companyDeals.length} open · 0 closed
            </span>
          </div>
          {companyDeals.map((d) => {
            const stage = stageById(d.stageId);
            const chipLabel = d.nextStep?.blocks
              ? "Legal redlines due Thu"
              : d.stale
                ? "Stale · no reply in 16 days"
                : !d.nextStep
                  ? "No next step"
                  : `Next step ${d.nextStep.dueLabel}`;
            const chipTone = d.nextStep?.blocks || d.stale ? "watch" : !d.nextStep ? "act" : "on-track";
            return (
              <Link key={d.id} href={`/app/deals/${company.id}`} className="rec-dealrow">
                <span>
                  <b style={{ fontWeight: 600 }}>{d.name}</b>
                  <small>
                    {stage.name} · {d.daysInStage === 0 ? "just moved" : `day ${d.daysInStage}`}
                  </small>
                </span>
                <span className="val-lg">{moneyCompact(d.value)}</span>
                <span className="close">{closeLabel(d.closeDate)}</span>
                <span style={{ justifySelf: "end" }}>
                  <ToneChip tone={chipTone} label={chipLabel} />
                </span>
              </Link>
            );
          })}
          {companyDeals.length === 0 ? (
            <p style={{ margin: "0 20px 16px", fontSize: 14, color: "var(--ink-2)" }}>
              No open deals — Harborlight is a customer. The renewal is due in February.
            </p>
          ) : null}
        </section>

        <section className="panel" aria-labelledby="people-title" style={{ paddingBottom: 4 }}>
          <div className="ph">
            <h2 id="people-title">People · {people.length}</h2>
          </div>
          {people.map((c, i) => {
            const cd = contactDetail(c.id);
            const row = (
              <>
                <span
                  className="av"
                  aria-hidden="true"
                  style={i === 0 ? { background: "#17201E", color: "#FFFFFF" } : undefined}
                >
                  {initialsOf(c.name)}
                </span>
                <span>
                  <b style={{ fontWeight: 600 }}>{c.name}</b>
                  <small>{c.title}</small>
                </span>
                <span>{cd.roleOnDeal}</span>
                <span className="mono" style={{ fontSize: 13, color: "var(--ink-2)" }}>
                  {companyPersonDate(company.id, c.id)}
                </span>
              </>
            );
            return i === 0 ? (
              <Link key={c.id} href={`/app/contacts/${c.id}`} className="tr rec-tr-people">
                {row}
              </Link>
            ) : (
              <div key={c.id} className="tr rec-tr-people">
                {row}
              </div>
            );
          })}
        </section>
      </main>

      <aside className="side">
        <section>
          <h2 className="lab" style={{ marginBottom: 14 }}>
            Company
          </h2>
          <dl className="kv">
            <dt>Website</dt>
            <dd>{detail.website}</dd>
            <dt>Industry</dt>
            <dd>{detail.industryFull}</dd>
            <dt>Size</dt>
            <dd>{detail.sizeLong}</dd>
            <dt>First contact</dt>
            <dd>{detail.firstContact}</dd>
            <dt>Health</dt>
            <dd className={detail.healthKvTone === "watch" ? "u-watch" : detail.healthKvTone === "act" ? "u-act" : undefined} style={{ fontWeight: 600 }}>
              {detail.healthKv}
            </dd>
          </dl>
        </section>

        {detail.healthNote ? (
          <section className="rec-note">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#66716E" strokeWidth="1.6" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 7.2v3.6M8 5v.4" />
            </svg>
            <span>{detail.healthNote}</span>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
