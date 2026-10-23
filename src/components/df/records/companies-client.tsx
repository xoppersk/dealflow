"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/df/icons";
import { OwnerAvatar } from "@/components/df/primitives";
import { CHIP_STYLES } from "./shared";
import { companyByIdSafe, personByIdSafe } from "@/lib/df/api";
import { createCompany } from "@/lib/df/actions";
import { moneyCompact } from "@/lib/df/format";
import { companiesDrawnOrder, companyListEntry, openValueForCompany } from "@/lib/df/records-data";
import type { Dataset } from "@/lib/df/types";
import { DatasetProvider } from "../dataset-context";

type Filter = "open" | "customers" | "all";

/**
 * R-04 companies table (Companies.html): order = open value desc (customers
 * with no open value last), value share bar against the largest company,
 * health in words — all computed from the real dataset. New company opens
 * a dialog that calls the createCompany action.
 */
export function CompaniesClient({ dataset: ds }: { dataset: Dataset }) {
  const [filter, setFilter] = useState<Filter>("open");
  const [query, setQuery] = useState("");

  const FILTERS: { value: Filter; label: string }[] = [
    { value: "open", label: "With open deals" },
    { value: "customers", label: "Customers" },
    { value: "all", label: `All ${ds.companies.length}` },
  ];

  const maxOpen = ds.companies.length ? Math.max(...ds.companies.map((c) => openValueForCompany(ds, c.id))) : 0;

  const rows = useMemo(() => {
    const order = companiesDrawnOrder(ds);
    let list = order.map((id) => companyByIdSafe(ds.companies, id)!).filter(Boolean);
    if (filter === "open") list = list.filter((c) => openValueForCompany(ds, c.id) > 0 || c.customer);
    if (filter === "customers") list = list.filter((c) => c.customer);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const entry = companyListEntry(ds, c.id);
        return c.name.toLowerCase().includes(q) || entry.industryLine.toLowerCase().includes(q);
      });
    }
    return list;
  }, [ds, filter, query]);

  const footer =
    filter === "open" && !query
      ? `${rows.length} shown — companies with open deals and customers`
      : `${rows.length} shown`;

  return (
    <DatasetProvider dataset={ds}>
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
            const entry = companyListEntry(ds, c.id);
            const open = openValueForCompany(ds, c.id);
            const companyDeals = ds.deals.filter((d) => d.companyId === c.id);
            const ownerId = c.ownerId ?? companyDeals[0]?.ownerId;
            const ownerPerson = ownerId ? personByIdSafe(ds.team, ownerId) : undefined;
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
    </DatasetProvider>
  );
}

/** "New company" button + dialog (page head) — creates via the action. */
export function NewCompanyButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await createCompany({ name: name.trim(), industry: industry.trim() || null });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    setName("");
    setIndustry("");
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn pri" onClick={() => setOpen(true)}>
        New company
      </button>
      {open ? (
        <div className="scrim" style={{ padding: "0 16px", alignItems: "flex-start" }}>
          <form role="dialog" aria-modal="true" aria-label="New company" className="dialog" style={{ marginTop: 96 }} onSubmit={submit}>
            <h2>New company</h2>
            <div className="f">
              <label htmlFor="nc-name">Name</label>
              <input id="nc-name" className="in" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="f">
              <label htmlFor="nc-industry">
                Industry <span className="opt">optional</span>
              </label>
              <input id="nc-industry" className="in" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            {error ? (
              <p className="form-error" role="alert">{error}</p>
            ) : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn pri">
                Add company
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
