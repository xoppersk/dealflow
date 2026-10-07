import Link from "next/link";
import { notFound } from "next/navigation";

import { CompanyDetailView } from "@/components/companies/company-detail-view";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getCompany } from "@/lib/actions/companies";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Company",
};

/**
 * /companies/[id] — company detail (APP-FLOW.md §3, UI-DESIGN.md §2.9):
 * Deals / Contacts / Activities / Details tabs.
 */
export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser();
  const { id } = await params;

  const result = await getCompany(id);

  if (!result.ok) {
    if (result.error === "Company not found.") notFound();
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        <EmptyState
          title="Couldn't load this company"
          description={result.error}
          illustration="search"
          action={
            <Button asChild>
              <Link href="/companies">Back to companies</Link>
            </Button>
          }
        />
      </main>
    );
  }

  return <CompanyDetailView data={result.data} currentUserId={session.id} />;
}
