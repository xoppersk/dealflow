import { Suspense } from "react";
import { BoardClient } from "@/components/df/board/board-client";
import { EmptyPipeline } from "@/components/df/system/empty-pipeline";
import { OfflineDealSheet } from "@/components/df/system/offline-sheet";
import "@/styles/daily.css";

function single(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * D-02 Pipeline (/app/pipeline) — Main.html.
 * Filters, view and the selected deal live in the URL (§10); every system
 * state is reachable with ?state= (palette / empty / error / offline).
 *
 * The query string is dynamic, so the component that awaits it renders
 * inside a Suspense boundary; the static shell still prerenders.
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
  const state = single(sp.state);

  if (state === "empty") {
    return (
      <main className="page">
        <EmptyPipeline />
      </main>
    );
  }
  if (state === "offline") {
    return (
      <main className="page" style={{ alignItems: "center" }}>
        <OfflineDealSheet />
      </main>
    );
  }

  return (
    <BoardClient
      dealParam={single(sp.deal)}
      ownerParam={single(sp.owner)}
      viewParam={single(sp.view)}
      quarterParam={single(sp.quarter)}
      stateParam={state}
      paletteQuery={single(sp.q)}
      moveParam={single(sp.move)}
    />
  );
}
