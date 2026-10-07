import { notFound } from "next/navigation";

import { ContactDetailView } from "@/components/contacts/contact-detail-view";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getContact } from "@/lib/actions/contacts";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Contact",
};

/**
 * /contacts/[id] — contact detail (APP-FLOW.md §3, UI-DESIGN.md §2.7):
 * profile header, Timeline / Deals / Details tabs.
 */
export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;

  const result = await getContact(id);

  if (!result.ok) {
    if (result.error === "Contact not found.") notFound();
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <EmptyState
          title="Couldn't load this contact"
          description={result.error}
          illustration="search"
          action={
            <Button asChild>
              <Link href="/contacts">Back to contacts</Link>
            </Button>
          }
        />
      </main>
    );
  }

  return <ContactDetailView data={result.data} currentUserId={session.id} />;
}
