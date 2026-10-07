import { Suspense } from "react";

import { CompaniesTable } from "@/components/companies/companies-table";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Companies",
};

/**
 * /companies — companies list (APP-FLOW.md §3, UI-DESIGN.md §2.8).
 * `?create=1` opens the NewCompanyDialog on load (⌘K / ＋ New menu).
 */
export default async function CompaniesPage() {
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
        <CompaniesTable currentUserId={session.id} />
      </Suspense>
    </main>
  );
}
