"use client";

import "@/styles/system.css";

/**
 * X-08 Stage load error card (ErrorState.html) — drawn in place of the
 * failed stage's column on the board: the stage header with a dash for its
 * total, then the act-ringed error card (reference code + Try again).
 * role="alert" per HANDOVER §11. Daily renders this in place of the failed
 * Proposal column for /app/pipeline?state=error.
 */
export function StageErrorCard({ stageName }: { stageName: string }) {
  return (
    <section className="col" role="alert" aria-label={`${stageName} failed to load`}>
      <div className="ch">
        <div className="t">
          <b>{stageName}</b>
          <span style={{ color: "var(--muted)" }}>—</span>
        </div>
      </div>
      <div className="sys-stage-error">
        <span className="ic" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#B4261A" strokeWidth="1.6" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 4.8v3.6M8 10.8v.4" />
          </svg>
        </span>
        <b className="title">This stage didn’t load.</b>
        <span className="detail">Your deals are safe; only this view failed. We’ve been told.</span>
        <div className="foot">
          <span className="stamp">Ref DF-7Q2-41K</span>
          <button type="button" className="btn sm pri" onClick={() => window.location.reload()}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3" />
            </svg>
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}
