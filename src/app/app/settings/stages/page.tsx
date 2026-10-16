"use client";

/**
 * M-03 — Pipeline stages (/app/settings/stages), replicated from
 * screens/PipelineStages.html. Proposal's stale limit is drawn mid-edit
 * (14 → 10 days, unsaved) with the dark "If you save" panel (§10 pattern);
 * editing the value updates the panel, Save applies to local state.
 * Entry requirements come from data/stages.json `requires` via the api seam.
 */
import { useState } from "react";
import { SettingsHead, UnsavedPill } from "@/components/df/mgmt/settings-head";
import { dealsInStage, deals, openStages } from "@/lib/df/api";
import { stagesScreenData as s } from "@/lib/df/mgmt-data";

const COLS = "44px minmax(0,1fr) 180px 190px minmax(0,1.3fr) 60px";

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#8FD0C7" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}

export default function StagesPage() {
  const proposal = openStages.find((st) => st.id === "proposal")!;
  const [savedDays, setSavedDays] = useState(s.proposalStaleSavedDays);
  const [draftDays, setDraftDays] = useState(String(s.proposalStaleDraftDays));
  const [saved, setSaved] = useState(false);
  const draftNum = Number(draftDays);
  const unsaved = Number.isFinite(draftNum) && draftNum !== savedDays;

  return (
    <main className="mgmt-page">
      <SettingsHead
        title="Pipeline stages"
        lede={s.lede}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {unsaved ? <UnsavedPill count={1} /> : saved ? <span className="saved-note">Saved</span> : null}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDraftDays(String(savedDays));
                setSaved(false);
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn pri"
              onClick={() => {
                if (unsaved) {
                  setSavedDays(draftNum);
                  setSaved(true);
                }
              }}
            >
              Save
            </button>
          </div>
        }
      />
      <div className="split">
        <section className="panel" aria-label="Pipeline stages" style={{ minWidth: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 760 }}>
              <div className="tr th" style={{ gridTemplateColumns: COLS }}>
                <span>Order</span>
                <span>Stage</span>
                <span>Win chance</span>
                <span>Stale after</span>
                <span>Needed to enter</span>
                <span>Deals</span>
              </div>
              {openStages.map((stage, i) => {
                const isProposal = stage.id === proposal.id;
                return (
                  <div className={`tr${isProposal && unsaved ? " changed" : ""}`} key={stage.id} style={{ gridTemplateColumns: COLS }}>
                    <span className="mono order-dot">{i + 1}</span>
                    <span>
                      <b style={{ fontWeight: 600 }}>{stage.name}</b>
                    </span>
                    <span>
                      <span className="winbar">
                        <b className="mono">{stage.winChance}%</b>
                        <span className="track" aria-hidden="true">
                          <i style={{ width: `${stage.winChance}%` }} />
                        </span>
                      </span>
                      <small>from 12 months</small>
                    </span>
                    {isProposal ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          className="in mono"
                          aria-label="Proposal stale after"
                          inputMode="numeric"
                          value={draftDays}
                          onChange={(e) => {
                            setDraftDays(e.target.value);
                            setSaved(false);
                          }}
                          style={
                            unsaved
                              ? { width: 60, height: 32, boxShadow: "inset 0 0 0 1.5px #0F6B62" }
                              : { width: 60, height: 32 }
                          }
                        />
                        {unsaved ? (
                          <small className="was" style={{ margin: 0, whiteSpace: "nowrap" }}>
                            was {savedDays} days
                          </small>
                        ) : null}
                      </span>
                    ) : (
                      <span className="mono" style={{ fontSize: 13 }}>
                        {s.staleDisplay[stage.id]}
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: "#2C3634" }}>{stage.requires.join(", ")}</span>
                    <span className="mono">{dealsInStage(deals, stage.id).length}</span>
                  </div>
                );
              })}
              <div className="tr" style={{ gridTemplateColumns: COLS, background: "var(--card-sunk)" }}>
                <span />
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <b className="chip chip-won">Won</b>
                  <span style={{ color: "var(--muted)" }}>·</span>
                  <b className="chip chip-lost">Lost</b>
                </span>
                <span style={{ gridColumn: "3 / -1", fontSize: 13, color: "var(--ink-2)" }}>{s.closedLine}</span>
              </div>
            </div>
          </div>
          <p className="def">{s.definition}</p>
        </section>

        {unsaved ? (
          <aside className="dark-aside" aria-labelledby="is">
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="ic">
                <ClockIcon />
              </span>
              <h2 id="is">If you save</h2>
            </span>
            <span>
              Proposal deals go stale after {draftNum} days instead of {savedDays}.
            </span>
            <span className="row-sep">
              <b>Meridian Foods</b> stays stale (16 days). <b>Solace Energy</b> would go stale on Oct 16 if nothing moves.
            </span>
            <span className="row-sep">{s.ifYouSave[2]}</span>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
