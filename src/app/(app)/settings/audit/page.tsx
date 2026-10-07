import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { Forbidden } from "@/components/reports/page-header";
import { AuditTable } from "@/components/settings/audit-table";

export const metadata: Metadata = { title: "Audit log" };

/**
 * /settings/audit — admin only.
 */
export default async function AuditPage() {
  const session = await requireUser();

  if (session.profile.role !== "admin") {
    return (
      <Forbidden
        title="The audit log is for admins"
        message="Ask your workspace admin if you need something looked up."
      />
    );
  }

  return <AuditTable />;
}
