import { Suspense } from "react";

import { ContactsTable } from "@/components/contacts/contacts-table";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Contacts",
};

/**
 * /contacts — contacts list (APP-FLOW.md §3, UI-DESIGN.md §2.6).
 * `?create=1` opens the NewContactDialog on load (⌘K / ＋ New menu).
 */
export default async function ContactsPage() {
  const session = await requireUser();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <Suspense
        fallback={
          <div className="grid gap-4">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <ContactsTable currentUserId={session.id} />
      </Suspense>
    </main>
  );
}
