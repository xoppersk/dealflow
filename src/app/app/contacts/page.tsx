import "@/styles/records.css";
import { ButtonLink } from "@/components/df/primitives";
import { PlusIcon } from "@/components/df/icons";
import { ContactsClient } from "@/components/df/records/contacts-client";

/** R-02 Contacts (/app/contacts) — Contacts.html screen-exact. */
export default function ContactsPage() {
  return (
    <main className="rec-list-main">
      <div className="page-head">
        <div>
          <h1 className="h1" style={{ marginTop: 0 }}>
            Contacts
          </h1>
          <p className="lede">142 people at 61 companies. 2 relationships tied to open deals are cooling.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ButtonLink href="/app/settings/import">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M6 1.5v6.5M3.2 5.4 6 8.2l2.8-2.8M1.5 10.5h9" />
            </svg>
            Import
          </ButtonLink>
          <ButtonLink href="/app/contacts" variant="pri">
            <PlusIcon />
            New contact
          </ButtonLink>
        </div>
      </div>
      <ContactsClient />
    </main>
  );
}
