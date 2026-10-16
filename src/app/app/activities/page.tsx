import { Suspense } from "react";
import { ActivitiesClient } from "@/components/df/daily/activities-client";
import "@/styles/daily.css";

function single(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * D-03 Activities (/app/activities) — Activities.html.
 * ?deal= prefills the log form's deal; ?log= focuses the form (§10: the
 * board's L key and the command palette land here).
 *
 * The query string is dynamic, so the component that awaits it renders
 * inside a Suspense boundary; the static shell still prerenders.
 */
export default function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={null}>
      <ActivitiesInner searchParams={searchParams} />
    </Suspense>
  );
}

async function ActivitiesInner({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <ActivitiesClient dealParam={single(sp.deal)} logParam={single(sp.log)} />;
}
