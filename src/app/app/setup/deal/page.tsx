"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { openStages } from "@/lib/df/api";
import { CheckIcon } from "@/components/df/icons";
import "@/styles/system.css";

/**
 * X-02 Onboarding (/app/setup/deal) — Onboarding.html exactly: the .stp
 * step pills (Step 2 of 3, "First deal" current), the first-deal form in a
 * panel, and the "Your stages" side panel with the starting win chances
 * from the fixture stages.
 *
 * A deal can't be saved without a next step + a date (§10): submitting with
 * either missing keeps the form open and shows the error treatment.
 * A valid submit advances to Step 3 in the same language (the screen draws
 * no step-3 panel — see the BUILD-LOG assumption note).
 */
export default function SetupDealPage() {
  const [step, setStep] = useState<2 | 3>(2);
  const [company, setCompany] = useState("Atlas Labs");
  const [dealName, setDealName] = useState("Enterprise expansion");
  const [value, setValue] = useState("$44,000");
  const [stageId, setStageId] = useState(openStages[0]!.id);
  const [nextStep, setNextStep] = useState("Discovery call with their IT lead");
  const [nextDate, setNextDate] = useState("Thu, Oct 8");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nextStep.trim() || !nextDate.trim()) {
      setError("Every deal needs a next step and a date. Add both to save this deal.");
      return;
    }
    setError(null);
    setStep(3);
  }

  return (
    <main className="sys-setup-main">
      <ol className="sys-steps" aria-label="Steps">
        <li className="stp">
          <span className="d">
            <CheckIcon size={10} color="#0F6B62" />
          </span>
          1 · Workspace and team
        </li>
        <li className="stp-line" aria-hidden="true" />
        {step === 2 ? (
          <li className="stp cur" aria-current="step">
            <span className="d">
              <i aria-hidden="true" />
            </span>
            2 · First deal
          </li>
        ) : (
          <li className="stp">
            <span className="d">
              <CheckIcon size={10} color="#0F6B62" />
            </span>
            2 · First deal
          </li>
        )}
        <li className="stp-line" aria-hidden="true" />
        {step === 3 ? (
          <li className="stp cur" aria-current="step">
            <span className="d">
              <i aria-hidden="true" />
            </span>
            3 · Log a call
          </li>
        ) : (
          <li className="stp next">
            <span className="d" />
            3 · Log a call
          </li>
        )}
      </ol>

      <div className="sys-setup-grid">
        {step === 2 ? (
          <form className="panel sys-setup-form" onSubmit={onSubmit} noValidate>
            <div>
              <h1>Add the deal you’re working on right now</h1>
              <p className="lede" style={{ marginTop: 10 }}>
                One real deal makes the board useful straight away. You can import the rest after.
              </p>
            </div>

            <div className="sys-form-grid">
              <div className="f">
                <label htmlFor="co">Company</label>
                <input id="co" className="in" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
              <div className="f">
                <label htmlFor="dn">Deal name</label>
                <input id="dn" className="in" value={dealName} onChange={(e) => setDealName(e.target.value)} />
              </div>
              <div className="f">
                <label htmlFor="va">Value</label>
                <input id="va" className="in mono" value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div className="f">
                <label htmlFor="sg">Stage</label>
                <select
                  id="sg"
                  className="in sys-select"
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                >
                  {openStages.map((s, i) => (
                    <option key={s.id} value={s.id}>
                      {i === 0 ? `${s.name} · ${s.winChance}% win` : s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sys-nextstep-box">
              <div className="f">
                <label htmlFor="ns" className="next-label">
                  <i aria-hidden="true" />
                  Next step
                </label>
                <input
                  id="ns"
                  className="in"
                  value={nextStep}
                  aria-invalid={Boolean(error && !nextStep.trim())}
                  aria-describedby={error ? "ns-error" : undefined}
                  onChange={(e) => setNextStep(e.target.value)}
                />
              </div>
              <div className="f">
                <label htmlFor="nd">By</label>
                <input
                  id="nd"
                  className="in mono"
                  value={nextDate}
                  aria-invalid={Boolean(error && !nextDate.trim())}
                  aria-describedby={error ? "ns-error" : undefined}
                  onChange={(e) => setNextDate(e.target.value)}
                />
              </div>
              <span className="wide-note">
                Every deal needs a next step and a date. It’s what keeps the board honest.
              </span>
              {error ? (
                <span className="wide-note sys-field-error" id="ns-error" role="alert">
                  {error}
                </span>
              ) : null}
            </div>

            <div className="sys-setup-actions">
              <Link href="/app" className="btn">
                Back
              </Link>
              <div className="group">
                <Link href="/app/settings/import" className="btn">
                  Import a list instead
                </Link>
                <button type="submit" className="btn pri">
                  Add deal and continue
                </button>
              </div>
            </div>
          </form>
        ) : (
          <section className="panel sys-setup-form" aria-label="Step 3: log a call">
            <div>
              <h1>Log a call</h1>
              <p className="lede" style={{ marginTop: 10 }}>
                {company} · {dealName} is on the board. Log the first call while it’s fresh — or
                do it later from Activities.
              </p>
            </div>
            <div className="sys-done-note">
              <b>
                {dealName} · {value}
              </b>{" "}
              was added in {openStages.find((s) => s.id === stageId)?.name} with the next step “
              {nextStep}” by {nextDate}.
            </div>
            <div className="sys-setup-actions">
              <button type="button" className="btn" onClick={() => setStep(2)}>
                Back
              </button>
              <div className="group">
                <Link href="/app/activities" className="btn">
                  Log a call in Activities
                </Link>
                <Link href="/app" className="btn pri">
                  Open Today
                </Link>
              </div>
            </div>
          </section>
        )}

        <aside className="panel sys-stages-panel">
          <h2 className="lab" style={{ margin: "0 0 8px" }}>
            Your stages
          </h2>
          {openStages.map((s, i) => (
            <div className="ll" key={s.id} style={i === 0 ? { borderTop: 0 } : undefined}>
              <span>{s.name}</span>
              <i aria-hidden="true" />
              <span className="mono">{s.winChance}%</span>
            </div>
          ))}
          <p className="sys-stages-note">
            Starting win chances. They update from your own results after 20 closed deals.
          </p>
        </aside>
      </div>
    </main>
  );
}
