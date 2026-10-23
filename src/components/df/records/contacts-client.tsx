"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/df/icons";
import { OwnerAvatar } from "@/components/df/primitives";
import { CHIP_STYLES, initialsOf } from "./shared";
import { personByIdSafe } from "@/lib/df/api";
import { createContact } from "@/lib/df/actions";
import { moneyCompact } from "@/lib/df/format";
import {
  companyListEntry,
  contactListEntry,
  contactsCustomers,
  contactsEveryone,
  contactsOnOpenDeals,
  safeCompany,
} from "@/lib/df/records-data";
import type { Contact, Dataset } from "@/lib/df/types";
import { DatasetProvider } from "../dataset-context";

type Filter = "open" | "customers" | "everyone";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "On open deals" },
  { value: "customers", label: "Customers" },
  { value: "everyone", label: "Everyone" },
];

const FLAG_CLASS: Record<string, string> = { watch: "u-watch", act: "u-act", ok: "u-on-track" };

/**
 * R-02 contacts table (Contacts.html): drawn rows, relationship in words,
 * cooling rows on the warm background, "Showing 10 of 31" footer. Search,
 * the On open deals / Customers / Everyone segmented control and the owner
 * select filter the canon rows client-side.
 */
export function ContactsClient({ dataset: ds }: { dataset: Dataset }) {
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<"any" | "mine">("any");

  const base: Contact[] =
    filter === "open" ? contactsOnOpenDeals(ds) : filter === "customers" ? contactsCustomers(ds) : contactsEveryone(ds);

  // The drawn dark avatar belongs to the primary contact on the biggest
  // open deal (the fixture's Jordan Bell seat) — computed, not hard-coded.
  const biggestDeal = [...ds.deals].sort((a, b) => b.value - a.value)[0];
  const darkContactId = biggestDeal?.detail?.people[0]?.contactId;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((c) => {
      const entry = contactListEntry(ds, c.id);
      if (owner === "mine" && entry?.ownerId !== ds.currentUserId) return false;
      if (!q) return true;
      const company = safeCompany(ds, c.companyId);
      return (
        c.name.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        company.name.toLowerCase().includes(q)
      );
    });
  }, [base, query, owner, ds]);

  const footer = `Showing ${rows.length} of ${ds.contacts.length}`;

  return (
    <DatasetProvider dataset={ds}>
      <div className="rec-filterrow">
        <label htmlFor="contact-q" className="sr-only">
          Find a contact
        </label>
        <span className="rec-srch">
          <SearchIcon />
          <input
            id="contact-q"
            className="in"
            placeholder="Name, company or title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </span>
        <div className="seg" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <label htmlFor="contact-owner" className="sr-only">
          Owner
        </label>
        <select
          id="contact-owner"
          className="in"
          style={{ width: "auto" }}
          value={owner}
          onChange={(e) => setOwner(e.target.value as "any" | "mine")}
        >
          <option value="any">Any owner</option>
          <option value="mine">Mine</option>
        </select>
      </div>

      <section className="panel" style={{ overflowX: "auto" }}>
        <div role="table" aria-label="Contacts" className="tbl">
          <div role="row" className="tr th rec-tr-contacts">
            <span role="columnheader">Person</span>
            <span role="columnheader">Company</span>
            <span role="columnheader">Relationship</span>
            <span role="columnheader">Last touch</span>
            <span role="columnheader">Open</span>
            <span role="columnheader">Owner</span>
          </div>
          {rows.map((c) => {
            const entry = contactListEntry(ds, c.id);
            if (!entry) return null;
            const company = safeCompany(ds, c.companyId);
            const mgOverride = companyListEntry(ds, c.companyId);
            const ownerPerson = personByIdSafe(ds.team, entry.ownerId);
            const dark = c.id === darkContactId;
            return (
              <Link
                key={c.id}
                role="row"
                href={`/app/contacts/${c.id}`}
                className="tr rec-tr-contacts"
                style={entry.cooling ? { background: "#FFFBF4" } : undefined}
              >
                <span role="cell" className="who">
                  <span className="av" aria-hidden="true" style={dark ? { background: "#17201E", color: "#FFFFFF" } : undefined}>
                    {initialsOf(c.name)}
                  </span>
                  <span>
                    <b style={{ fontWeight: 600 }}>{c.name}</b>
                    <small>{c.title}</small>
                  </span>
                </span>
                <span role="cell" className="rec-co2">
                  <span
                    className="mg"
                    aria-hidden="true"
                    style={{ background: mgOverride.mgBg ?? company.mgBg, color: mgOverride.mgColor ?? company.mgColor }}
                  >
                    {company.initials}
                  </span>
                  {company.name}
                </span>
                <span role="cell" className="rec-rl">
                  <span className="chip" style={CHIP_STYLES[entry.relationshipTone]}>
                    <i />
                    {entry.relationshipLabel}
                  </span>
                  <small>{entry.relationshipNote}</small>
                </span>
                <span role="cell" className="mono" style={{ fontSize: 13 }}>
                  {entry.lastTouchDate}
                  {entry.lastTouchFlag ? (
                    <small
                      className={FLAG_CLASS[entry.lastTouchFlagTone ?? "ok"]}
                      style={{ fontWeight: 600, fontFamily: "var(--font-sans)" }}
                    >
                      {entry.lastTouchFlag}
                    </small>
                  ) : null}
                </span>
                <span
                  role="cell"
                  className="mono"
                  style={{ fontSize: 14, ...(entry.openValue === null ? { color: "var(--muted)" } : {}) }}
                >
                  {entry.openValue === null ? "—" : moneyCompact(entry.openValue)}
                </span>
                <span role="cell">{ownerPerson ? <OwnerAvatar person={ownerPerson} /> : null}</span>
              </Link>
            );
          })}
        </div>
        <div className="rec-foot">{footer}</div>
      </section>
    </DatasetProvider>
  );
}

/** "New contact" button + dialog (page head) — creates via the action. */
export function NewContactButton({ companies }: { companies: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const res = await createContact({
      firstName: firstName ?? name,
      lastName: rest.join(" "),
      title: title.trim() || null,
      email: email.trim() || null,
      companyId: companyId || null,
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn pri" onClick={() => setOpen(true)}>
        New contact
      </button>
      {open ? (
        <div className="scrim" style={{ padding: "0 16px", alignItems: "flex-start" }}>
          <form role="dialog" aria-modal="true" aria-label="New contact" className="dialog" style={{ marginTop: 96 }} onSubmit={submit}>
            <h2>New contact</h2>
            <div className="f">
              <label htmlFor="nct-name">Name</label>
              <input id="nct-name" className="in" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="f">
              <label htmlFor="nct-title">Title</label>
              <input id="nct-title" className="in" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="f">
              <label htmlFor="nct-email">Email</label>
              <input id="nct-email" className="in" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="f">
              <label htmlFor="nct-company">Company</label>
              <select id="nct-company" className="in" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p className="form-error" role="alert">{error}</p>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn pri">
                Add contact
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
