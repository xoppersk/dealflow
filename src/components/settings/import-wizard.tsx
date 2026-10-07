"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, UploadCloud, XCircle } from "lucide-react";
import { Toaster, toast } from "sonner";

import { importContacts, parseCsvPreview, type ContactField, type CsvPreview, type ImportSummary } from "@/lib/actions/import";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FieldHint,
  FieldLabel,
  ProgressBar,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/components/reports/ui";
import { EmptyState, PageHeader } from "@/components/reports/page-header";

const FIELD_OPTIONS: { value: ContactField; label: string }[] = [
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "title", label: "Title" },
  { value: "company", label: "Company" },
  { value: "ignore", label: "Don't import" },
];

const REQUIRED_FIELDS: ContactField[] = ["first_name", "last_name"];

function guessField(header: string): ContactField {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  if (["email", "emailaddress"].includes(h)) return "email";
  if (["firstname", "first", "fname", "givenname"].includes(h)) return "first_name";
  if (["lastname", "last", "lname", "surname", "familyname"].includes(h)) return "last_name";
  if (["phone", "mobile", "tel", "telephone", "cell", "phonenumber"].includes(h)) return "phone";
  if (["title", "jobtitle", "position"].includes(h)) return "title";
  if (["company", "companyname", "organization", "organisation", "account", "employer", "co"].includes(h))
    return "company";
  return "ignore";
}

function Stepper({ step }: { step: number }) {
  const steps = ["Upload", "Map columns", "Validate & import"];
  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Import steps">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-2">
            {n > 1 && <span className="mx-1 h-px w-6 bg-border" aria-hidden />}
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                done && "bg-primary text-primary-foreground",
                current && "border-2 border-primary text-primary",
                !done && !current && "bg-muted text-muted-foreground",
              )}
              aria-current={current ? "step" : undefined}
            >
              {done ? "✓" : n}
            </span>
            <span className={cn("text-sm", current ? "font-medium" : "text-muted-foreground")}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * 3-step CSV import wizard (UI-DESIGN.md 2.15): Upload → Map columns
 * (auto-guess) → Validate & import (row errors, progress, summary).
 */
export function ImportWizard() {
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, ContactField>>({});
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please choose a .csv file");
      return;
    }
    setParsing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const csvText = String(reader.result ?? "");
      // Full client-side parse for the import payload…
      const full = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
      });
      // …and a server-side preview for the mapping step.
      const result = await parseCsvPreview({ csvText });
      setParsing(false);
      if (!result.ok) {
        toast.error(
          result.error === "PARSE_ERROR"
            ? "Couldn't parse that CSV."
            : result.error === "NO_COLUMNS"
              ? "No columns found in the file."
              : "Couldn't read the file.",
        );
        return;
      }
      setPreview(result.data);
      setAllRows(full.data);
      setFileName(file.name);
      const initialMapping: Record<string, ContactField> = {};
      const guessedHeaders = new Set<string>();
      for (const header of result.data.headers) {
        const g = guessField(header);
        initialMapping[header] = g;
        if (g !== "ignore") guessedHeaders.add(header);
      }
      setMapping(initialMapping);
      setGuessed(guessedHeaders);
      setSummary(null);
      setStep(2);
    };
    reader.onerror = () => {
      setParsing(false);
      toast.error("Couldn't read the file");
    };
    reader.readAsText(file);
  };

  const mappedFields = new Set(Object.values(mapping));
  const missingRequired = REQUIRED_FIELDS.filter((f) => !mappedFields.has(f));

  const runImport = async () => {
    if (missingRequired.length > 0) {
      toast.error(`Map ${missingRequired.map((f) => (f === "first_name" ? "first name" : "last name")).join(" and ")} first`);
      return;
    }
    setImporting(true);
    setProgress(8);
    const tick = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + 7 : p));
    }, 400);
    const result = await importContacts({ rows: allRows, mapping });
    window.clearInterval(tick);
    setProgress(100);
    setImporting(false);
    if (!result.ok) {
      toast.error(
        result.error.startsWith("MAPPING_INCOMPLETE")
          ? result.error.replace("MAPPING_INCOMPLETE: ", "")
          : "The import failed.",
      );
      setProgress(0);
      return;
    }
    setSummary(result.data);
    setStep(3);
    if (result.data.imported > 0) {
      toast.success(`${result.data.imported} imported, ${result.data.skipped} skipped`);
    }
  };

  const reset = () => {
    setStep(1);
    setPreview(null);
    setAllRows([]);
    setMapping({});
    setSummary(null);
    setProgress(0);
    setFileName("");
  };

  return (
    <div className="max-w-3xl">
      <Toaster position="bottom-right" />
      <PageHeader
        title="Import contacts"
        description="Bring contacts over from a spreadsheet. Nothing imports silently — every skipped row is explained."
      />
      <Stepper step={step} />

      {step === 1 && (
        <Card>
          <CardContent className="p-6">
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload a CSV file"
              onClick={() => fileInput.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) readFile(file);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-[10px] border-2 border-dashed px-6 py-14 text-center transition-colors",
                dragging ? "border-primary bg-primary-subtle" : "border-border hover:border-primary/50",
              )}
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium">{parsing ? "Reading file…" : "Drop your CSV here"}</p>
                <p className="mt-1 text-sm text-muted-foreground">or click to browse — .csv files only</p>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) readFile(file);
                  e.target.value = "";
                }}
              />
            </div>
            <FieldHint>First row should be column headers. Up to 5,000 rows per import.</FieldHint>
          </CardContent>
        </Card>
      )}

      {step === 2 && preview && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileUp className="h-4 w-4" aria-hidden />
                {fileName}
                <span className="tnum text-sm font-normal text-muted-foreground">
                  {preview.totalRows} rows
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {missingRequired.length > 0 && (
                <p className="rounded-md bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning)]">
                  Required fields are unmapped:{" "}
                  {missingRequired.map((f) => (f === "first_name" ? "first name" : "last name")).join(", ")}
                </p>
              )}
              {preview.headers.map((header) => {
                const value = mapping[header] ?? "ignore";
                const isRequired = REQUIRED_FIELDS.includes(value);
                return (
                  <div key={header} className="flex flex-wrap items-center gap-3">
                    <div className="min-w-40 flex-1">
                      <p className="truncate font-mono text-sm">{header}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        e.g. {preview.rows[0]?.[header] ?? "—"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="flex items-center gap-2">
                      <SelectRoot
                        value={value}
                        onValueChange={(v) => {
                          setMapping((m) => ({ ...m, [header]: v as ContactField }));
                          setGuessed((g) => {
                            const next = new Set(g);
                            next.delete(header);
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-44",
                            isRequired && "border-[var(--warning)]",
                          )}
                          aria-label={`Map column ${header}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </SelectRoot>
                      {guessed.has(header) && value !== "ignore" && (
                        <Badge variant="secondary" className="whitespace-nowrap">
                          Guessed
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button disabled={missingRequired.length > 0} onClick={runImport}>
              Validate & import <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && summary && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-[var(--success)]" aria-hidden />
                <div>
                  <p className="tnum text-xl font-semibold">
                    {summary.imported} imported, {summary.skipped} skipped
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Only valid rows were imported — nothing was silently dropped.
                  </p>
                </div>
              </div>
              {(importing || progress > 0) && (
                <div className="mt-4">
                  <ProgressBar value={progress} />
                </div>
              )}
              {summary.warnings.length > 0 && (
                <div className="mt-4 rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Skipped duplicates</p>
                  <ul className="flex max-h-32 flex-col gap-1 overflow-auto text-xs text-muted-foreground">
                    {summary.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {summary.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Row errors</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {summary.errors.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 px-5 py-3">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                      <p className="text-sm">
                        <span className="tnum font-medium">Row {e.row}:</span>{" "}
                        <span className="text-muted-foreground">{e.errors.join("; ")}</span>
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={reset}>
              Import another file
            </Button>
            <Button asChild>
              <Link href="/contacts">View imported contacts</Link>
            </Button>
          </div>
        </div>
      )}

      {step === 2 && importing && (
        <Card className="mt-4">
          <CardContent className="p-6">
            <FieldLabel>Importing…</FieldLabel>
            <ProgressBar value={progress} className="mt-2" />
          </CardContent>
        </Card>
      )}

      {preview && step === 2 && allRows.length === 0 && (
        <EmptyState title="No data rows" description="The file has headers but no rows to import." />
      )}
    </div>
  );
}
