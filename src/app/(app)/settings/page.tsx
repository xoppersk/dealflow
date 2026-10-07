import type { Metadata } from "next";

import { requireUser } from "@/lib/auth";
import { getWorkspaceSettings } from "@/lib/actions/settings";
import { WorkspaceForm } from "@/components/settings/workspace-form";

export const metadata: Metadata = { title: "Workspace settings" };

/**
 * /settings — every signed-in user can view; currency and stale threshold
 * are admin-only fields (lock hint), enforced again in the action.
 */
export default async function SettingsPage() {
  const session = await requireUser();
  const result = await getWorkspaceSettings();

  if (!result.ok) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Couldn&apos;t load settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again in a moment.</p>
      </div>
    );
  }

  return (
    <WorkspaceForm initial={result.data} isAdmin={session.profile.role === "admin"} />
  );
}
