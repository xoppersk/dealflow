import { Suspense } from "react";
import { BoardClient } from "@/components/df/board/board-client";
import { EmptyPipeline } from "@/components/df/system/empty-pipeline";
import { isOpenDeal } from "@/lib/df/api";
import { getDataset } from "@/lib/df/db";
import "@/styles/daily.css";

function single(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * D-02 Pipeline (/app/pipeline) — Main.html.
 * Filters, view and the selected deal live in the URL (§10). System states
 * arise from REAL data only: a workspace with no open deals renders the
 * EmptyPipeline state; there is no ?state= fixture override.
 *
 * The query string is dynamic, so the component that awaits it renders
 * inside a Suspense boundary.
 */
export default function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={null}>
      <PipelineInner searchParams={searchParams} />
    </Suspense>
  );
}

async function PipelineInner({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const dataset = await getDataset();

  if (!dataset.deals.some(isOpenDeal)) {
    return (
      <main className="page">
        <EmptyPipeline stages={dataset.stages} />
      </main>
    );
  }

  return (
    <BoardClient
      dataset={dataset}
      dealParam={single(sp.deal)}
      ownerParam={single(sp.owner)}
      viewParam={single(sp.view)}
      quarterParam={single(sp.quarter)}
      paletteQuery={single(sp.q)}
      moveParam={single(sp.move)}
    />
  );
}

export const instant = false;
