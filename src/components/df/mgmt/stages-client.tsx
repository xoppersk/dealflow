"use client";

/**
 * M-03 — Pipeline stages client. Every open stage's stale limit is
 * editable with the dark "If you save" panel (§10 pattern); Save persists
 * all stages through the updateStages action (admin-gated by RLS).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsHead, UnsavedPill } from "@/components/df/mgmt/settings-head";
import { dealsInStage, openStagesOf } from "@/lib/df/api";
import { updateStages } from "@/lib/df/actions";
import { buildStagesScreen } from "@/lib/df/mgmt-data";
import type { Dataset } from "@/lib/df/types";

const COLS = "44px minmax(0,1fr) 180px 190px minmax(0,1.3fr) 60px";

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#8FD0C7" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l2.5 1.5" />
    </svg>
  );
}

export default function StagesClient({ dataset }: { dataset: Dataset }) {
  const router = useRouter();
  const s = buildStagesScreen(dataset);
  const openStages = openStagesOf(dataset.stages);
  const deals = dataset.deals;
  const [savedDays, setSavedDays] = useState<Record<string, number>>(
    Object.fromEntries(dataset.stages.map((st) => [st.id, st.staleLimitDays])),
  );
  const [draftDays, setDraftDays] = useState<Record<string, string>>(
    Object.fromEntries(dataset.stages.map((st) => [st.id, String(st.staleLimitDays)])),
  );
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const changed = openStages.filter((st) => Number(draftDays[st.id]) !== savedDays[st.id]);
  const unsaved = changed.length > 0;
  const firstChanged = changed[0];

  return (
    <main className="mgmt-page">
      <SettingsHead
        title="Pipeline stages"
        lede={s.lede}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {unsaved ? <UnsavedPill count={changed.length} /> : saved ? <span className="saved-note">Saved</span> : null}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDraftDays(Object.fromEntries(Object.entries(savedDays).map(([k, v]) => [k, String(v)])));
                setSaved(false);
              }}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn pri"
              onClick={async () => {
                if (!unsaved) return;
                const res = await updateStages(
                  dataset.stages.map((st, i) => ({
                    slug: st.id,
                    name: st.name,
                    winChance: st.winChance,
                    requires: st.requires,
                    staleLimitDays: Number(draftDays[st.id] ?? st.staleLimitDays),
                    position: i,
                  })),
                );
                if (!res.ok) {
                  setSaveError(res.error);
                  return;
                }
                setSaveError(null);
                setSavedDays(Object.fromEntries(dataset.stages.map((st) => [st.id, Number(draftDays[st.id] ?? st.staleLimitDays)])));
                setSaved(true);
                router.refresh();
              }}
            >
              Save
            </button>
            {saveError ? (
              <span className="form-error" role="alert">
                {saveError}
              </span>
            ) : null}
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
                const isChanged = Number(draftDays[stage.id]) !== savedDays[stage.id];
                return (
                  <div className={`tr${isChanged ? " changed" : ""}`} key={stage.id} style={{ gridTemplateColumns: COLS }}>
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
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        className="in mono"
                        aria-label={`${stage.name} stale after`}
                        inputMode="numeric"
                        value={draftDays[stage.id] ?? String(stage.staleLimitDays)}
                        onChange={(e) => {
                          setDraftDays((prev) => ({ ...prev, [stage.id]: e.target.value }));
                          setSaved(false);
                        }}
                        style={
                          isChanged
                            ? { width: 60, height: 32, boxShadow: "inset 0 0 0 1.5px #0F6B62" }
                            : { width: 60, height: 32 }
                        }
                      />
                      {isChanged ? (
                        <small className="was" style={{ margin: 0, whiteSpace: "nowrap" }}>
                          was {savedDays[stage.id]} days
                        </small>
                      ) : null}
                    </span>
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
              {firstChanged ? (
                <>
                  {firstChanged.name} deals go stale after {draftDays[firstChanged.id]} days instead of{" "}
                  {savedDays[firstChanged.id]}.
                </>
              ) : null}
            </span>
            <span className="row-sep">{s.ifYouSave[1]}</span>
            <span className="row-sep">{s.ifYouSave[2]}</span>
          </aside>
        ) : null}
      </div>
    </main>
  );
}
