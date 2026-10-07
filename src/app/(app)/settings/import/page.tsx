import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { Forbidden } from "@/components/reports/page-header";
import { ImportWizard } from "@/components/settings/import-wizard";

export const metadata: Metadata = { title: "Import contacts" };

/**
 * /settings/import — admin only (UI-DESIGN.md 2.15).
 */
export default async function ImportPage() {
  const session = await requireUser();

  if (session.profile.role !== "admin") {
    return (
      <Forbidden
        title="CSV import is for admins"
        message="Ask your workspace admin to import contacts."
      />
    );
  }

  return <ImportWizard />;
}
