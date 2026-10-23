"use client";

/**
 * M-05 — Import client (REAL upload flow).
 * Step 1: pick a CSV → parsed in the browser with papaparse.
 * Step 3 (Check): duplicates detected against the live dataset (email or
 * name); each duplicate can merge (skip) or keep anyway. Rows without a
 * name can't import. Step 4: commit through the importRows action, which
 * reports per-row errors. Nothing is pre-filled or faked.
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { importRows } from "@/lib/df/actions";
import { importCopy as imp } from "@/lib/df/mgmt-data";
import type { Dataset } from "@/lib/df/types";

type CsvRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  company: string;
};

type Parsed = { fileName: string; rows: CsvRow[] };

function pick(rec: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = rec[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export default function ImportClient({ dataset }: { dataset: Dataset }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [keepAnyway, setKeepAnyway] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const existingEmails = useMemo(
    () => new Set(dataset.contacts.map((c) => c.email.toLowerCase()).filter(Boolean)),
    [dataset],
  );
  const existingNames = useMemo(
    () => new Set(dataset.contacts.map((c) => c.name.toLowerCase())),
    [dataset],
  );
  const existingCompanies = useMemo(
    () => new Set(dataset.companies.map((c) => c.name.toLowerCase())),
    [dataset],
  );

  const isDup = (r: CsvRow) =>
    (r.email && existingEmails.has(r.email.toLowerCase())) ||
    existingNames.has(`${r.firstName} ${r.lastName}`.trim().toLowerCase());

  const duplicates = parsed ? parsed.rows.map((r, i) => ({ r, i })).filter(({ r }) => isDup(r)) : [];
  const cantImport = parsed ? parsed.rows.filter((r) => !`${r.firstName} ${r.lastName}`.trim()) : [];
  const newRows = parsed ? parsed.rows.filter((r) => `${r.firstName} ${r.lastName}`.trim() && !isDup(r)) : [];
  const keptDups = parsed
    ? parsed.rows.filter((r, i) => `${r.firstName} ${r.lastName}`.trim() && isDup(r) && keepAnyway[i])
    : [];
  const newCompanies = parsed
    ? new Set(
        parsed.rows
          .map((r) => r.company)
          .filter((c) => c && !existingCompanies.has(c.toLowerCase())),
      ).size
    : 0;
  const toImport = [...newRows, ...keptDups];

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
      complete: (res) => {
        const rows: CsvRow[] = res.data.map((rec) => {
          const fullName = pick(rec, ["name", "contact", "full_name"]);
          const [fn, ...rest] = fullName.split(/\s+/);
          return {
            firstName: pick(rec, ["first_name", "first", "firstname"]) || fn || "",
            lastName: pick(rec, ["last_name", "last", "lastname"]) || rest.join(" "),
            email: pick(rec, ["email", "email_address", "work_email"]),
            phone: pick(rec, ["phone", "phone_number", "mobile"]),
            title: pick(rec, ["title", "job_title", "role"]),
            company: pick(rec, ["company", "company_name", "account", "organization"]),
          };
        });
        setParsed({ fileName: file.name, rows });
      },
      error: (err) => setParseError(err.message),
    });
  }

  async function commit() {
    if (!parsed) return;
    setBusy(true);
    const res = await importRows({
      companies: [],
      contacts: toImport.map((r) => ({
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email || undefined,
        phone: r.phone || undefined,
        title: r.title || undefined,
        companyName: r.company || undefined,
      })),
      deals: [],
    });
    setBusy(false);
    if (!res.ok) {
      setParseError(res.error);
      return;
    }
    setResult({
      imported: (res.data?.companies ?? 0) + (res.data?.contacts ?? 0) + (res.data?.deals ?? 0),
      errors: res.data?.errors ?? [],
    });
    router.refresh();
  }

  const step = result ? 4 : parsed ? 3 : 1;

  return (
    <>
      <ol className="imp-steps">
        {imp.steps.map((s, i) => (
          <li key={s} className={i + 1 === step ? "cur" : i + 1 < step ? "done" : undefined}>
            {s}
          </li>
        ))}
      </ol>

      {parsed ? (
        <div className="imp-counts">
          <span>
            <b className="mono">{parsed.rows.length}</b> rows read
          </span>
          <span>
            <b className="mono">{newRows.length}</b> new contacts
          </span>
          <span>
            <b className="mono">{duplicates.length}</b> duplicates
          </span>
          <span>
            <b className="mono">{cantImport.length}</b> can’t import
          </span>
        </div>
      ) : null}

      <div className="split imp-split">
        <div>
          <div className="panel">
            <div className="head">
              <div className="head-copy">
                <h2>Upload a CSV</h2>
                <p>Columns are matched by header — name, email, phone, title, company.</p>
              </div>
              <button type="button" className="btn pri" onClick={() => fileRef.current?.click()}>
                Choose a file
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
            </div>
            {parseError ? (
              <p className="form-error" role="alert" style={{ padding: "0 20px 16px" }}>
                {parseError}
              </p>
            ) : parsed ? (
              <p style={{ padding: "0 20px 16px", fontSize: 13.5, color: "var(--muted)" }}>
                {parsed.fileName} — {parsed.rows.length} rows.
              </p>
            ) : (
              <p style={{ padding: "0 20px 16px", fontSize: 13.5, color: "var(--muted)" }}>No file chosen yet.</p>
            )}
          </div>

          {parsed && duplicates.length > 0 ? (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="head">
                <div className="head-copy">
                  <h2>{imp.duplicatesTitle}</h2>
                  <p>These rows look like contacts already in this workspace. Merge skips the row; keep both imports it anyway.</p>
                </div>
              </div>
              <div>
                {duplicates.map(({ r, i }) => {
                  const existing = dataset.contacts.find(
                    (c) =>
                      (r.email && c.email.toLowerCase() === r.email.toLowerCase()) ||
                      c.name.toLowerCase() === `${r.firstName} ${r.lastName}`.trim().toLowerCase(),
                  );
                  return (
                    <div className="dp" key={i}>
                      <div className="dp-top">
                        <div>
                          <b>
                            {r.firstName} {r.lastName}
                          </b>{" "}
                          <span className="dim">— {r.company || "no company"} · {r.title || "—"}</span>
                          <span className="match-line">
                            Already exists as <b>{existing?.name ?? "a contact"}</b>
                            {existing ? <> at {dataset.companies.find((c) => c.id === existing.companyId)?.name ?? ""}</> : null}
                          </span>
                        </div>
                        <div className="seg" role="group" aria-label="Duplicate choice">
                          <button
                            type="button"
                            className={!keepAnyway[i] ? "on" : undefined}
                            onClick={() => setKeepAnyway((p) => ({ ...p, [i]: false }))}
                          >
                            Merge
                          </button>
                          <button
                            type="button"
                            className={keepAnyway[i] ? "on" : undefined}
                            onClick={() => setKeepAnyway((p) => ({ ...p, [i]: true }))}
                          >
                            Keep both
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {parsed && cantImport.length > 0 ? (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="head">
                <div className="head-copy">
                  <h2>{imp.cantImportTitle}</h2>
                  <p>Rows without a contact name are skipped.</p>
                </div>
              </div>
              {cantImport.map((r, i) => (
                <div className="ci" key={i}>
                  <b>{r.company || "Row without a name"}</b>
                  <span className="dim"> — skipped: no contact name in the row.</span>
                </div>
              ))}
            </div>
          ) : null}

          {result ? (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="head">
                <div className="head-copy">
                  <h2>{imp.doneTitle}</h2>
                  <p>
                    {result.imported} rows imported.
                    {result.errors.length > 0 ? ` ${result.errors.length} rows failed:` : ""}
                  </p>
                </div>
              </div>
              {result.errors.map((e, i) => (
                <div className="ci" key={i}>
                  <span className="dim">{e}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="panel dark">
          <div className="dk">
            <h2>When you import</h2>
            <dl className="dkv">
              <div>
                <dt>New contacts</dt>
                <dd className="mono">{parsed ? toImport.length : 0}</dd>
              </div>
              <div>
                <dt>New companies</dt>
                <dd className="mono">{parsed ? newCompanies : 0}</dd>
              </div>
              <div>
                <dt>Duplicates merged</dt>
                <dd className="mono">{parsed ? duplicates.length - keptDups.length : 0}</dd>
              </div>
              <div>
                <dt>Skipped</dt>
                <dd className="mono">{parsed ? cantImport.length : 0}</dd>
              </div>
            </dl>
            <p className="dk-note">Companies are created from the company column when they don’t exist yet.</p>
            <button type="button" className="btn pri lg block" disabled={!parsed || busy} onClick={commit}>
              {busy ? "Importing…" : `Import ${parsed ? toImport.length : 0} contacts`}
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
