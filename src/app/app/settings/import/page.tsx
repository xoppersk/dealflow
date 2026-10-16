"use client";

/**
 * M-05 — Import contacts (/app/settings/import), replicated from
 * screens/CsvImport.html: wizard step 3 "Check" of 4 for
 * trade-show-leads.csv (64 rows: 51 new, 9 duplicates, 4 can't import,
 * 22 new companies). Per-duplicate Merge / Keep both choices are
 * interactive; the commit button label stays as drawn ("Import 51 and
 * merge 8" — the screen's fixed copy for the drawn default choices) and
 * clicking it advances to a completion state in the same visual language
 * (step 4 becomes current, a completion panel replaces the check list).
 */
import Link from "next/link";
import { useState } from "react";
import { CheckIcon } from "@/components/df/icons";
import { Segmented } from "@/components/df/primitives";
import { SettingsHead } from "@/components/df/mgmt/settings-head";
import { companyById, settings } from "@/lib/df/api";
import { importScreenData as imp } from "@/lib/df/mgmt-data";

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#44504D" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 1.8h5.5L12.5 5v9.2H4z" />
      <path d="M9.5 1.8V5h3" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9AA19F" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5" />
    </svg>
  );
}
function AlertRedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#B4261A" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8v3.6M8 10.8v.4" />
    </svg>
  );
}

export default function ImportPage() {
  const [choices, setChoices] = useState<Record<string, "merge" | "keep">>(
    () => Object.fromEntries(imp.duplicates.map((d) => [d.id, d.defaultChoice])) as Record<string, "merge" | "keep">,
  );
  const [done, setDone] = useState(false);

  return (
    <main className="mgmt-page">
      <SettingsHead
        title={imp.title}
        lede={
          <>
            <span className="mono" style={{ fontSize: 14 }}>
              {imp.file}
            </span>{" "}
            · {imp.rowsRead} {imp.ledeSuffix}
          </>
        }
        actions={
          <div className="imp-kl" role="list" aria-label="Rows">
            {imp.counts.map((c) => (
              <div key={c.label} role="listitem">
                <span>{c.label}</span>
                <b className={c.act ? "act" : undefined}>{c.value}</b>
                <small>{c.note}</small>
              </div>
            ))}
          </div>
        }
      />

      <ol className="steps" aria-label="Steps">
        {imp.steps.map((label, i) => {
          const stepNo = i + 1;
          const state = done
            ? stepNo <= imp.currentStep + 1
              ? stepNo === imp.currentStep + 1
                ? "cur"
                : "done"
              : "next"
            : stepNo < imp.currentStep
              ? "done"
              : stepNo === imp.currentStep
                ? "cur"
                : "next";
          return (
            <span key={label} style={{ display: "contents" }}>
              {i > 0 ? <li className="stp-line" aria-hidden="true" /> : null}
              <li className={`stp${state === "cur" ? " cur" : state === "next" ? " next" : ""}`} aria-current={state === "cur" ? "step" : undefined}>
                <span className="d">
                  {state === "done" ? <CheckIcon size={10} color="#0F6B62" /> : state === "cur" ? <i /> : null}
                </span>
                {label}
              </li>
            </span>
          );
        })}
      </ol>

      <div className="split">
        <section className="panel" style={{ minWidth: 0 }}>
          {done ? (
            <>
              <div className="ph">
                <h2>{imp.doneTitle}</h2>
                <span>
                  {imp.file} · {imp.rowsRead} rows
                </span>
              </div>
              <div className="done-box">
                <span className="ic" style={{ background: "#E3EFEC" }}>
                  <CheckIcon size={12} color="#0F6B62" />
                </span>
                <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <h2>{imp.commitLabel} — done</h2>
                  <p>{imp.doneNote}</p>
                </span>
              </div>
              <p className="def" style={{ borderTop: 0, paddingTop: 0 }}>
                <Link href="/app/contacts" className="lnk">
                  See the imported contacts
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="ph">
                <h2>{imp.duplicatesTitle}</h2>
                <span>{imp.duplicatesShowing}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 720 }}>
                  {imp.duplicates.map((d) => {
                    const company = companyById(d.matchCompanyId);
                    return (
                      <div className="dup" key={d.id}>
                        <span className="side-cell">
                          <span className="ic" aria-hidden="true" style={{ background: "#F1EEE6" }}>
                            <FileIcon />
                          </span>
                          <span>
                            <b style={{ fontWeight: 600 }}>{d.fromName}</b>
                            <small>{d.fromNote}</small>
                          </span>
                        </span>
                        <ArrowIcon />
                        <span className="side-cell">
                          <span className="mg" aria-hidden="true" style={{ background: company.mgBg, color: company.mgColor }}>
                            {company.initials}
                          </span>
                          <span>
                            {d.matchVerb}{" "}
                            <b style={{ fontWeight: 600 }}>{d.matchName}</b>
                            <small>{d.matchNote}</small>
                          </span>
                        </span>
                        <Segmented
                          label={d.fromName}
                          options={[
                            { value: "merge" as const, label: "Merge" },
                            { value: "keep" as const, label: "Keep both" },
                          ]}
                          value={choices[d.id] ?? d.defaultChoice}
                          onChange={(v) => setChoices((prev) => ({ ...prev, [d.id]: v }))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="cant">
                <span className="ic">
                  <AlertRedIcon />
                </span>
                <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                    <h2>{imp.cantImportTitle}</h2>
                    <a href="#" className="lnk" onClick={(e) => e.preventDefault()}>
                      Download these rows
                    </a>
                  </span>
                  <p>{imp.cantImportNote}</p>
                </span>
              </div>
            </>
          )}
        </section>

        <aside className="panel" aria-labelledby="wi" style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 12, fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)", overflow: "visible" }}>
          <h2 id="wi" style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 600, lineHeight: 1.2, color: "var(--ink)" }}>
            When you import
          </h2>
          {imp.whenYouImport.map((line) => (
            <span className="li" key={line}>
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#0F6B62" strokeWidth="1.8" aria-hidden="true">
                <path d="m2.5 6.5 2.3 2.3 4.7-5" />
              </svg>
              <span>{line}</span>
            </span>
          ))}
          {done ? (
            <span className="saved-note" role="status" style={{ marginTop: 8 }}>
              Imported by {settings.workspaceName} · just now
            </span>
          ) : (
            <button type="button" className="btn pri" style={{ marginTop: 8, height: 42 }} onClick={() => setDone(true)}>
              {imp.commitLabel}
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}
