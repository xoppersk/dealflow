import "@/styles/records.css";
import { ButtonLink } from "@/components/df/primitives";
import { PlusIcon } from "@/components/df/icons";
import { CompaniesClient } from "@/components/df/records/companies-client";
import { openTotal, deals } from "@/lib/df/api";
import { moneyCompact } from "@/lib/df/format";

/** R-04 Companies (/app/companies) — Companies.html screen-exact. */
export default function CompaniesPage() {
  return (
    <main className="rec-list-main">
      <div className="page-head">
        <div>
          <h1 className="h1" style={{ marginTop: 0 }}>
            Companies
          </h1>
          <p className="lede">
            8 companies hold the{" "}
            <span className="mono" style={{ color: "var(--ink)" }}>
              {moneyCompact(openTotal(deals))}
            </span>{" "}
            open pipeline. Bracken Works alone is 29% of it.
          </p>
        </div>
        <ButtonLink href="/app/companies" variant="pri">
          <PlusIcon />
          New company
        </ButtonLink>
      </div>
      <CompaniesClient />
    </main>
  );
}
