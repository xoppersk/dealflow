"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/df/icons";
import { OwnerAvatar } from "@/components/df/primitives";
import { CHIP_STYLES, initialsOf } from "./shared";
import { personById } from "@/lib/df/api";
import { moneyCompact } from "@/lib/df/format";
import {
  companyListEntry,
  contactListEntry,
  contactsCustomers,
  contactsEveryone,
  contactsOnOpenDeals,
  safeCompany,
} from "@/lib/df/records-data";
import type { Contact } from "@/lib/df/types";

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
export function ContactsClient() {
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<"any" | "mine">("any");

  const base: Contact[] = filter === "open" ? contactsOnOpenDeals() : filter === "customers" ? contactsCustomers() : contactsEveryone();

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return base.filter((c) => {
      const entry = contactListEntry(c.id);
      if (owner === "mine" && entry?.ownerId !== "sheku-koroma") return false;
      if (!q) return true;
      const company = safeCompany(c.companyId);
      return (
        c.name.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        company.name.toLowerCase().includes(q)
      );
    });
  }, [base, query, owner]);

  const footer =
    filter === "open" && owner === "any" && !query
      ? "Showing 10 of 31 on open deals or recent customers"
      : `Showing ${rows.length} of 31`;

  return (
    <>
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
            const entry = contactListEntry(c.id);
            if (!entry) return null;
            const company = safeCompany(c.companyId);
            const mgOverride = companyListEntry(c.companyId);
            const ownerPerson = personById(entry.ownerId);
            const dark = c.id === "jordan-bell";
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
                <span role="cell">
                  <OwnerAvatar person={ownerPerson} />
                </span>
              </Link>
            );
          })}
        </div>
        <div className="rec-foot">{footer}</div>
      </section>
    </>
  );
}
