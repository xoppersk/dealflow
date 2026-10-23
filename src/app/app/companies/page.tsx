import "@/styles/records.css";
import { Suspense } from "react";
import { CompaniesClient, NewCompanyButton } from "@/components/df/records/companies-client";
import { openTotal } from "@/lib/df/api";
import { getDataset } from "@/lib/df/db";
import { moneyCompact } from "@/lib/df/format";
import { openValueForCompany } from "@/lib/df/records-data";

/** R-04 Companies (/app/companies) — Companies.html layout; figures computed. */
async function CompaniesPageInner() {
  const ds = await getDataset();
  const withOpen = ds.companies.filter((c) => openValueForCompany(ds, c.id) > 0);
  const top = [...withOpen].sort((a, b) => openValueForCompany(ds, b.id) - openValueForCompany(ds, a.id))[0];
  const total = openTotal(ds.deals);
  const topShare = top && total > 0 ? Math.round((openValueForCompany(ds, top.id) / total) * 100) : 0;
  return (
    <main className="rec-list-main">
      <div className="page-head">
        <div>
          <h1 className="h1" style={{ marginTop: 0 }}>
            Companies
          </h1>
          <p className="lede">
            {withOpen.length} companies hold the{" "}
            <span className="mono" style={{ color: "var(--ink)" }}>
              {moneyCompact(total)}
            </span>{" "}
            open pipeline.
            {top ? ` ${top.name} alone is ${topShare}% of it.` : ""}
          </p>
        </div>
        <NewCompanyButton />
      </div>
      <CompaniesClient dataset={ds} />
    </main>
  );
}

export default function CompaniesPage() {
  return (
    <Suspense fallback={null}>
      <CompaniesPageInner />
    </Suspense>
  );
}

export const instant = false;
