"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createDeal } from "@/lib/df/actions";
import type { Stage } from "@/lib/df/types";
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
function parseDue(input: string): string | null {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const cleaned = s.replace(/^[A-Za-z]{3,9},?\s*/, "");
  const d = new Date(`${cleaned}, ${new Date().getFullYear()}`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() < Date.now() - 86400000) d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default function SetupDealForm({
  stages: openStages,
  companies,
  preselectCompanyId,
}: {
  stages: Stage[];
  companies: { id: string; name: string }[];
  preselectCompanyId?: string;
}) {
  const preselected = companies.find((c) => c.id === preselectCompanyId);
  const [step, setStep] = useState<2 | 3>(2);
  const [company, setCompany] = useState(preselected?.name ?? "");
  const [dealName, setDealName] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState(openStages[0]?.id ?? "new-lead");
  const [nextStep, setNextStep] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdDealId, setCreatedDealId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!company.trim() || !dealName.trim()) {
      setError("Give the deal a company and a name.");
      return;
    }
    if (!nextStep.trim() || !nextDate.trim()) {
      setError("Every deal needs a next step and a date. Add both to save this deal.");
      return;
    }
    const due = parseDue(nextDate);
    if (!due) {
      setError("That date isn’t readable — try “Oct 8” or 2026-10-08.");
      return;
    }
    setBusy(true);
    const res = await createDeal({
      name: dealName.trim(),
      companyName: company.trim(),
      value: Number(value.replace(/[^0-9.]/g, "")) || 0,
      stageSlug: stageId,
      nextStepText: nextStep.trim(),
      nextStepDue: due,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setCreatedDealId(res.data?.id ?? null);
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
                <button type="submit" className="btn pri" disabled={busy}>
                  {busy ? "Adding…” : "Add deal and continue"}
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
                <Link
                  href={createdDealId ? `/app/activities?deal=${createdDealId}&log=1` : "/app/activities"}
                  className="btn"
                >
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
