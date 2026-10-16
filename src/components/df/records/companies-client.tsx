"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/df/icons";
import { OwnerAvatar } from "@/components/df/primitives";
import { CHIP_STYLES } from "./shared";
import { companies, companyById, deals, personById } from "@/lib/df/api";
import { moneyCompact } from "@/lib/df/format";
import { companiesDrawnOrder, companyListEntry, openValueForCompany } from "@/lib/df/records-data";

type Filter = "open" | "customers" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "With open deals" },
  { value: "customers", label: "Customers" },
  { value: "all", label: "All 61" },
];

/**
 * R-04 companies table (Companies.html): drawn order (open value desc,
 * Harborlight customer last), value share bar against the largest company,
 * health in words, "8 with open deals and 1 recent customer shown" footer.
 */
export function CompaniesClient() {
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");

  const maxOpen = Math.max(...companies.map((c) => openValueForCompany(c.id)));

  const rows = useMemo(() => {
    const order = companiesDrawnOrder();
    let list = order.map((id) => companyById(id));
    if (filter === "customers") list = list.filter((c) => c.customer);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const entry = companyListEntry(c.id);
        return c.name.toLowerCase().includes(q) || entry.industryLine.toLowerCase().includes(q);
      });
    }
    return list;
  }, [filter, query]);

  const footer =
    filter === "open" && !query ? "8 with open deals and 1 recent customer shown" : `${rows.length} shown`;

  return (
    <>
      <div className="rec-filterrow">
        <label htmlFor="company-q" className="sr-only">
          Find a company
        </label>
        <span className="rec-srch">
          <SearchIcon />
          <input
            id="company-q"
            className="in"
            placeholder="Company or industry"
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
      </div>

      <section className="panel" style={{ overflowX: "auto" }}>
        <div role="table" aria-label="Companies" className="tbl" style={{ minWidth: 720 }}>
          <div role="row" className="tr th rec-tr-companies">
            <span role="columnheader">Company</span>
            <span role="columnheader">Open</span>
            <span role="columnheader">Deals</span>
            <span role="columnheader">Health</span>
            <span role="columnheader">Owner</span>
          </div>
          {rows.map((c) => {
            const entry = companyListEntry(c.id);
            const open = openValueForCompany(c.id);
            const companyDeals = deals.filter((d) => d.companyId === c.id);
            const ownerDeal = companyDeals[0];
            const ownerId = c.customer ? "maya-jordan" : ownerDeal?.ownerId;
            const ownerPerson = ownerId ? personById(ownerId) : null;
            const pct = maxOpen > 0 ? (open / maxOpen) * 100 : 0;
            return (
              <Link key={c.id} role="row" href={`/app/companies/${c.id}`} className="tr rec-tr-companies">
                <span role="cell" className="who">
                  <span
                    className="mg"
                    aria-hidden="true"
                    style={{ background: entry.mgBg ?? c.mgBg, color: entry.mgColor ?? c.mgColor }}
                  >
                    {c.initials}
                  </span>
                  <span>
                    <b style={{ fontWeight: 600 }}>{c.name}</b>
                    <small>{entry.industryLine}</small>
                  </span>
                </span>
                <span
                  role="cell"
                  className="mono"
                  style={{ fontSize: 14, ...(open === 0 ? { color: "var(--muted)" } : {}) }}
                >
                  {open === 0 ? (
                    "—"
                  ) : (
                    <>
                      {moneyCompact(open)}
                      <span className="rec-bar" aria-hidden="true">
                        <i style={{ width: `${pct.toFixed(1)}%` }} />
                      </span>
                    </>
                  )}
                </span>
                <span role="cell" className="mono" style={{ fontSize: 13 }}>
                  {companyDeals.length}
                </span>
                <span role="cell">
                  <span className="chip" style={CHIP_STYLES[entry.healthTone]}>
                    <i />
                    {entry.healthLabel}
                  </span>
                </span>
                <span role="cell">{ownerPerson ? <OwnerAvatar person={ownerPerson} /> : null}</span>
              </Link>
            );
          })}
        </div>
        <div className="rec-foot">{footer}</div>
      </section>
    </>
  );
}
