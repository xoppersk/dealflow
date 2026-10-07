"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Loader2, Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NewCompanyDialog } from "@/components/companies/new-company-dialog";
import { listCompanies } from "@/lib/actions/companies";
import type { CompanyRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export interface CompanyOption {
  id: string;
  name: string;
}

interface CompanyPickerProps {
  label?: string;
  value: CompanyOption | null;
  onChange: (company: CompanyOption | null) => void;
  placeholder?: string;
}

/**
 * Company typeahead with an inline "＋ New company" path: typing a name
 * with no match offers "Create …", which opens the mini-form; the new
 * company is selected on creation.
 */
export function CompanyPicker({ label = "Company", value, onChange, placeholder = "Search companies…" }: CompanyPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounce.current) clearTimeout(debounce.current);
    const term = query.trim();
    debounce.current = setTimeout(async () => {
      setSearching(true);
      const res = await listCompanies({ q: term || undefined });
      setSearching(false);
      if (res.ok) {
        setResults(res.data.items.slice(0, 8).map((c) => ({ id: c.id, name: c.name })));
      }
    }, 200);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, open]);

  const showCreate = query.trim().length > 1 && !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());

  function created(company: CompanyRow) {
    onChange({ id: company.id, name: company.name });
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="grid gap-1.5" ref={wrapRef}>
      <Label>{label}</Label>
      <div className="relative">
        {value ? (
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{value.name}</span>
            <button
              type="button"
              className="text-xs text-muted-foreground underline cursor-pointer"
              onClick={() => {
                onChange(null);
                setQuery("");
                setOpen(true);
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={placeholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
              />
            </div>
            {open && (
              <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                {searching ? (
                  <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </p>
                ) : (
                  <>
                    {results.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent cursor-pointer",
                        )}
                        onClick={() => {
                          onChange(r);
                          setQuery("");
                          setOpen(false);
                        }}
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {r.name}
                      </button>
                    ))}
                    {showCreate && (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent cursor-pointer"
                        onClick={() => {
                          setOpen(false);
                          setCreateOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Create “{query.trim()}”
                      </button>
                    )}
                    {results.length === 0 && !showCreate && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No companies found.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <NewCompanyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultName={query.trim()}
        onCreated={created}
      />
    </div>
  );
}
