"use client";

/**
 * M-02 — Workspace settings (/app/settings), replicated from
 * screens/Settings.html. The stale-after rule is drawn mid-edit (21 → 14
 * days, unsaved): editing shows the consequence inline (§10 unsaved-change
 * pattern); Save applies to local state, Discard returns to the saved value.
 */
import Link from "next/link";
import { useState } from "react";
import { SettingsHead, UnsavedPill } from "@/components/df/mgmt/settings-head";
import { settings } from "@/lib/df/api";
import { workspaceData as w } from "@/lib/df/mgmt-data";

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#0F6B62" strokeWidth="1.6" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#9A5B00" strokeWidth="1.6" aria-hidden="true">
      <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="2" />
      <path d="m2.5 4.5 5.5 4 5.5-4" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M8 2v8.5M4.5 7 8 10.5 11.5 7M2.5 13.5h11" />
    </svg>
  );
}

export default function SettingsPage() {
  const [savedStale, setSavedStale] = useState(settings.staleLimitDays);
  const [draftStale, setDraftStale] = useState(String(settings.staleLimitPendingDays));
  const [nextStepRequired, setNextStepRequired] = useState(true);
  const [wonRules, setWonRules] = useState<boolean[]>(w.wonRules.map(() => true));
  const [saved, setSaved] = useState(false);

  const draftNum = Number(draftStale);
  const unsaved = Number.isFinite(draftNum) && draftNum !== savedStale;

  const save = () => {
    if (unsaved) {
      setSavedStale(draftNum);
      setSaved(true);
    }
  };
  const discard = () => {
    setDraftStale(String(savedStale));
    setSaved(false);
  };

  return (
    <main className="mgmt-page">
      <SettingsHead
        title="Settings"
        lede={w.lede}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {unsaved ? <UnsavedPill count={1} /> : saved ? <span className="saved-note">Saved</span> : null}
            <button type="button" className="btn" onClick={discard}>
              Discard
            </button>
            <button type="button" className="btn pri" onClick={save}>
              Save
            </button>
          </div>
        }
      />
      <div className="split">
        <div className="stack">
          <section className="panel">
            <div className="ph">
              <h2>Workspace</h2>
            </div>
            <div className="fr">
              <label className="lb" htmlFor="wn">
                Name
              </label>
              <input id="wn" className="in" defaultValue={`${settings.workspaceName} · ${settings.workspaceScope}`} style={{ maxWidth: 380, width: "100%" }} />
            </div>
            <div className="fr">
              <label className="lb" htmlFor="cu">
                Currency<small>{w.currencyNote}</small>
              </label>
              <select id="cu" className="in" style={{ maxWidth: 240, width: "100%" }} defaultValue={w.currency}>
                <option>{w.currency}</option>
              </select>
            </div>
            <div className="fr">
              <label className="lb" htmlFor="fy">
                Quarters start in
              </label>
              <select id="fy" className="in" style={{ maxWidth: 240, width: "100%" }} defaultValue={w.quartersStart}>
                <option>{w.quartersStart}</option>
              </select>
            </div>
            {/* Coordinator ruling: the sub-menu stays the designed four; the
                v1 audit surface is linked from inside the Workspace page. */}
            <div className="audit-link-row">
              <Link href="/app/settings/audit" className="lnk">
                Audit log
              </Link>{" "}
              <span style={{ color: "var(--muted)" }}>· every change to deals, stages and settings, in order.</span>
            </div>
          </section>

          <section className="panel">
            <div className="ph">
              <h2>Deal rules</h2>
            </div>
            <div className="fr">
              <span className="lb">
                Every open deal needs a next step<small>{w.nextStepRuleNote}</small>
              </span>
              <label className="checkrow" style={{ paddingTop: 9 }}>
                <input
                  type="checkbox"
                  className="cb"
                  checked={nextStepRequired}
                  onChange={(e) => setNextStepRequired(e.target.checked)}
                />{" "}
                {w.nextStepRuleState}
              </label>
            </div>
            <div className={`fr${unsaved ? " changed" : ""}`}>
              <label className="lb" htmlFor="st">
                Call a deal stale after
                {unsaved ? (
                  <small>
                    <span className="was">Changed · was {savedStale} days</span>
                  </small>
                ) : null}
              </label>
              <span style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    id="st"
                    className="in mono"
                    inputMode="numeric"
                    value={draftStale}
                    onChange={(e) => {
                      setDraftStale(e.target.value);
                      setSaved(false);
                    }}
                    style={unsaved ? { width: 72, boxShadow: "inset 0 0 0 1.5px #0F6B62" } : { width: 72 }}
                  />{" "}
                  <span style={{ fontSize: 14 }}>{w.staleUnit}</span>
                </span>
                {unsaved ? (
                  <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}>{w.staleConsequence}</span>
                ) : null}
              </span>
            </div>
            <div className="fr">
              <span className="lb">
                Moving a deal to Won<small>Protects the forecast.</small>
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 9, fontSize: 14 }}>
                {w.wonRules.map((rule, i) => (
                  <label key={rule} className="checkrow">
                    <input
                      type="checkbox"
                      className="cb"
                      checked={wonRules[i]}
                      onChange={(e) => setWonRules((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))}
                    />{" "}
                    {rule}
                  </label>
                ))}
              </span>
            </div>
          </section>
        </div>

        <section className="panel" aria-labelledby="cn">
          <div className="ph">
            <h2 id="cn">Connected</h2>
          </div>
          {w.connected.map((c) => (
            <div className="conn-row" key={c.name}>
              <span className="ic" style={{ background: c.kind === "calendar" ? "#E3EFEC" : "#FBF1E2" }}>
                {c.kind === "calendar" ? <CalendarIcon /> : <MailIcon />}
              </span>
              <span className="txt">
                <b style={{ fontWeight: 600 }}>{c.name}</b>
                <span>
                  {c.note ?? (
                    <>
                      {c.noteBefore}
                      <span className="watch" style={{ fontWeight: 600 }}>
                        {c.noteWatch}
                      </span>
                    </>
                  )}
                </span>
              </span>
            </div>
          ))}
          <div className="export-row">
            <b style={{ fontWeight: 600 }}>Export</b>
            <a href="#" className="btn export-btn" onClick={(e) => e.preventDefault()}>
              <DownloadIcon />
              {w.exportLabel}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
