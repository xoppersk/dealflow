import "@/styles/records.css";
import { Suspense } from "react";
import { ButtonLink } from "@/components/df/primitives";
import { ContactsClient, NewContactButton } from "@/components/df/records/contacts-client";
import { contactListEntry } from "@/lib/df/records-data";
import { getDataset } from "@/lib/df/db";

/** R-02 Contacts (/app/contacts) — Contacts.html layout; counts computed. */
async function ContactsPageInner() {
  const ds = await getDataset();
  const cooling = ds.contacts.filter((c) => contactListEntry(ds, c.id)?.cooling).length;
  return (
    <main className="rec-list-main">
      <div className="page-head">
        <div>
          <h1 className="h1" style={{ marginTop: 0 }}>
            Contacts
          </h1>
          <p className="lede">
            {ds.contacts.length} people at {ds.companies.length} companies.{" "}
            {cooling} relationship{cooling === 1 ? "" : "s"} tied to open deals {cooling === 1 ? "is" : "are"} cooling.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ButtonLink href="/app/settings/import">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M6 1.5v6.5M3.2 5.4 6 8.2l2.8-2.8M1.5 10.5h9" />
            </svg>
            Import
          </ButtonLink>
          <NewContactButton companies={ds.companies.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
      </div>
      <ContactsClient dataset={ds} />
    </main>
  );
}

export default function ContactsPage() {
  return (
    <Suspense fallback={null}>
      <ContactsPageInner />
    </Suspense>
  );
}

export const instant = false;
