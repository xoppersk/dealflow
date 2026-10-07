import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { Forbidden } from "@/components/reports/page-header";
import { TeamManager } from "@/components/settings/user-table";

export const metadata: Metadata = { title: "Team" };

/**
 * /settings/team — admin only (UI-DESIGN.md 2.14).
 */
export default async function TeamPage() {
  const session = await requireUser();

  if (session.profile.role !== "admin") {
    return (
      <Forbidden
        title="Team management is for admins"
        message="Ask your workspace admin to invite users or change roles."
      />
    );
  }

  return <TeamManager selfId={session.id} />;
}
