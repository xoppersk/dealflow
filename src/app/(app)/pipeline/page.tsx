import { Suspense } from "react";

import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { getBoardData } from "@/lib/actions/pipeline";
import { requireUser } from "@/lib/auth";

export const metadata = {
  title: "Pipeline",
};

/**
 * /pipeline — kanban board (APP-FLOW.md §3).
 *
 * Server Component: gates on the session, loads the initial board payload
 * (stages + deals), and hands it to the client board. Realtime takes over
 * from there — no polling.
 */
export default async function PipelinePage() {
  const session = await requireUser();
  const result = await getBoardData();

  if (!result.ok) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-xl font-semibold">Couldn&apos;t load the pipeline</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{result.error}</p>
        <a
          href="/pipeline"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </a>
      </main>
    );
  }

  return (
    <Suspense fallback={null}>
      <PipelineBoard
        initialStages={result.data.stages}
        initialDeals={result.data.deals}
        totalCount={result.data.totalCount}
        user={{
          id: session.id,
          name: session.profile.full_name,
          avatarUrl: session.profile.avatar_url,
        }}
      />
    </Suspense>
  );
}
