import Link from "next/link";
import { openStagesOf } from "@/lib/df/api";
import type { Stage } from "@/lib/df/types";
import { moneyCompact } from "@/lib/df/format";
import "@/styles/system.css";

/**
 * X-03 Empty pipeline (EmptyPipeline.html) — an empty workspace's board:
 * the Pipeline title + lede, Import a CSV / Add your first deal actions,
 * four stage columns at $0 with dashed drop bodies (the first invites the
 * drop), and the settings footnote. The pipeline page renders this when the
 * workspace has no open deals.
 */
export function EmptyPipeline({ stages }: { stages: Stage[] }) {
  const openStages = openStagesOf(stages);
  return (
    <>
      <div className="page-head">
        <div className="titles">
          <h1 className="h1" style={{ marginTop: 0 }}>
            Pipeline
          </h1>
          <p className="lede">No deals yet. Add the one you’re working on, or bring in a list.</p>
        </div>
        <div className="sys-empty-actions">
          <Link href="/app/settings/import" className="btn">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
            </svg>
            Import a CSV
          </Link>
          <Link href="/app/setup/deal" className="btn pri">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 1.5v9M1.5 6h9" />
            </svg>
            Add your first deal
          </Link>
        </div>
      </div>

      <div className="sys-board-scroll">
        <div className="sys-board-grid">
          {openStages.map((stage, i) => (
            <section className="col" key={stage.id} aria-label={stage.name}>
              <div className="ch">
                <div className="t">
                  <b>{stage.name}</b>
                  <span style={{ color: "var(--muted)" }}>{moneyCompact(0)}</span>
                </div>
              </div>
              {i === 0 ? (
                <div className="drop sys-drop-first">
                  <span className="inner">
                    <span className="ic" aria-hidden="true">
                      <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#0F6B62" strokeWidth="1.8" aria-hidden="true">
                        <path d="M6 1.5v9M1.5 6h9" />
                      </svg>
                    </span>
                    Drop new leads here
                  </span>
                </div>
              ) : (
                <div className="drop">
                  <span>—</span>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      <p className="sys-empty-foot">
        Stages and win chances can be changed in{" "}
        <Link href="/app/settings/stages">Settings › Pipeline stages</Link>.
      </p>
    </>
  );
}
