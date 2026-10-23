import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import "@/styles/records.css";
import { ButtonLink } from "@/components/df/primitives";
import { OwnerAvatar } from "@/components/df/primitives";
import { CHIP_STYLES, RichText, initialsOf } from "@/components/df/records/shared";
import { ContactEditForm } from "@/components/df/records/edit-forms";
import { personByIdSafe } from "@/lib/df/api";
import { getDataset } from "@/lib/df/db";
import {
  colleaguesOf,
  contactBySlug,
  contactDetail,
  contactListEntry,
  safeCompany,
  standingPartsFor,
} from "@/lib/df/records-data";

/**
 * R-03 Contact detail (/app/contacts/[id]) — ContactDetail.html layout;
 * the same layout renders every contact from the real dataset (standing,
 * history, about, colleagues — all computed in records-data).
 *
 * Params are dynamic, so the component that awaits them renders inside a
 * Suspense boundary; the static shell still prerenders.
 */
export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <ContactDetailInner params={params} />
    </Suspense>
  );
}

async function ContactDetailInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ds = await getDataset();
  const contact = contactBySlug(ds, id);
  if (!contact) notFound();

  const company = safeCompany(ds, contact.companyId);
  const detail = contactDetail(ds, contact.id);
  const list = contactListEntry(ds, contact.id);
  const owner = list ? personByIdSafe(ds.team, list.ownerId) : undefined;
  const colleagues = colleaguesOf(ds, contact.id);
  const history = detail.history;
  const biggestDeal = [...ds.deals].sort((a, b) => b.value - a.value)[0];
  const dark = contact.id === biggestDeal?.detail?.people[0]?.contactId;

  return (
    <div className="rec-layout">
      <main className="rec-main">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="rec-crumb">
            <Link href="/app/contacts">Contacts</Link> / {contact.name}
          </div>
          <header className="rec-head">
            <div className="rec-head-id">
              <span
                className="av rec-av-lg"
                aria-hidden="true"
                style={dark ? { background: "#17201E", color: "#FFFFFF" } : undefined}
              >
                {initialsOf(contact.name)}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                <h1 className="rec-h1">{contact.name}</h1>
                <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
                  {contact.title},{" "}
                  {company.exists ? <Link href={`/app/companies/${company.id}`}>{company.name}</Link> : company.name} ·{" "}
                  <span className="mono" style={{ fontSize: 13 }}>
                    {contact.email}
                  </span>
                  {detail.phone ? (
                    <>
                      {" · "}
                      <span className="mono" style={{ fontSize: 13 }}>
                        {detail.phone}
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
            <div className="rec-actions">
              <ButtonLink href="/app/contacts">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
                  <path d="m2.5 4.5 5.5 4 5.5-4" />
                </svg>
                Email
              </ButtonLink>
              <ButtonLink href="/app/activities" variant="pri">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M3 2.5h3l1.2 3-1.7 1.1a8 8 0 0 0 3.9 3.9l1.1-1.7 3 1.2v3a1.5 1.5 0 0 1-1.6 1.5A11.5 11.5 0 0 1 1.5 4.1 1.5 1.5 0 0 1 3 2.5Z" />
                </svg>
                Log a call
              </ButtonLink>
            </div>
          </header>
        </div>

        <section className="rec-sum" aria-labelledby="ws-title">
          <h2 id="ws-title" className="eb">
            <i />
            Where things stand
          </h2>
          <p>
            <RichText parts={standingPartsFor(ds, contact.id)} />
          </p>
        </section>

        <section className="panel" aria-labelledby="hist-title">
          <div className="ph">
            <h2 id="hist-title">History with {contact.name.split(" ")[0]}</h2>
            <span>Newest first</span>
          </div>
          {history.map((h, i) => {
            const actor = personByIdSafe(ds.team, h.ownerId);
            if (!actor) return null;
            const last = i === history.length - 1;
            return (
              <div key={`${h.date}-${h.title}-${i}`} className="ev" style={last ? { paddingBottom: 15 } : undefined}>
                <span className="mono">{h.date}</span>
                <OwnerAvatar person={actor} large />
                <span>
                  <b>{h.title}</b>
                  {h.rest ?? ""}
                  {h.detail ? <small>{h.detail}</small> : null}
                </span>
              </div>
            );
          })}
        </section>
      </main>

      <aside className="side">
        <section>
          <h2 className="lab" style={{ marginBottom: 14 }}>
            About
          </h2>
          <div style={{ marginBottom: 14 }}>
            <ContactEditForm contact={contact} />
          </div>
          <dl className="kv">
            <dt>Role on deal</dt>
            <dd>{detail.roleOnDeal}</dd>
            {list ? (
              <>
                <dt>Relationship</dt>
                <dd>
                  <span className="chip" style={CHIP_STYLES[list.relationshipTone]}>
                    <i />
                    {list.relationshipLabel}
                  </span>{" "}
                  · {list.relationshipNote}
                </dd>
              </>
            ) : null}
            <dt>Prefers</dt>
            <dd>{detail.prefers}</dd>
            {owner ? (
              <>
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
              </>
            ) : null}
            <dt>Met through</dt>
            <dd>{detail.metThrough}</dd>
          </dl>
        </section>

        {colleagues.length > 0 ? (
          <section style={{ paddingTop: 20, borderTop: "1px solid var(--rule)" }}>
            <h2>Also at {company.name}</h2>
            {colleagues.map((c, i) => {
              const cd = contactDetail(ds, c.id);
              return (
                <div key={c.id} className="pp" style={i === 0 ? { borderTop: 0 } : undefined}>
                  <span className="av" aria-hidden="true">
                    {initialsOf(c.name)}
                  </span>
                  <span>
                    <Link href={`/app/contacts/${c.id}`}>
                      <b>{c.name}</b>
                    </Link>{" "}
                    · {c.title}
                    <small>{cd.roleOnDeal}</small>
                  </span>
                  <span />
                </div>
              );
            })}
          </section>
        ) : null}
      </aside>
    </div>
  );
}

export const instant = false;
