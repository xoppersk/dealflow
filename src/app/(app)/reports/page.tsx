import type { Metadata } from "next";

import { isManagerOrAdmin, requireUser } from "@/lib/auth";
import { Forbidden } from "@/components/reports/page-header";
import { ReportsClient } from "@/components/reports/reports-client";

export const metadata: Metadata = { title: "Reports" };

/**
 * /reports — manager/admin only. Non-managers get the 403-style
 * "Reports are for managers" page (UI-DESIGN.md 2.11).
 */
export default async function ReportsPage() {
  const session = await requireUser();

  if (!isManagerOrAdmin(session.profile.role)) {
    return (
      <Forbidden
        title="Reports are for managers"
        message="Ask your manager or workspace admin for a pipeline summary."
      />
    );
  }

  return <ReportsClient />;
}
