/**
 * Global command palette (⌘K): fuzzy search across deals, contacts and
 * companies, plus quick actions. Recent selections persist in localStorage.
 *
 * Controlled by the Shell: `open` / `onOpenChange` and the Cmd+K listener
 * live there so any trigger (topbar button, bottom nav, keyboard) drives
 * this one palette.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Plus, Search } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchGlobal } from "@/lib/actions/search";
import type { SearchResultItem } from "@/lib/types";

const RECENT_KEY = "dealflow:recent-searches";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 200;
const MIN_CHARS = 3;

interface RecentEntry extends SearchResultItem {
  href: string;
}

function hrefFor(item: SearchResultItem): string {
  switch (item.kind) {
    case "deal":
      return `/deals/${item.id}`;
    case "contact":
      return `/contacts/${item.id}`;
    case "company":
      return `/companies/${item.id}`;
  }
}

function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function storeRecent(entry: RecentEntry) {
  try {
    const next = [
      entry,
      ...loadRecent().filter((r) => !(r.kind === entry.kind && r.id === entry.id)),
    ].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private browsing etc. — recent items are a nicety, not a requirement.
  }
}

const QUICK_ACTIONS = [
  { label: "Create deal", href: "/pipeline?create=1", hint: "New deal" },
  { label: "Log activity", href: "/activities?create=1", hint: "New activity" },
  { label: "Go to pipeline", href: "/pipeline", hint: "Navigate" },
] as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const requestId = useRef(0);

  // Refresh recents each time the palette opens (event handler, not an effect).
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) setRecent(loadRecent());
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const runSearch = useCallback(async (q: string) => {
    const id = ++requestId.current;
    setSearching(true);
    setSearchError(null);
    const result = await searchGlobal(q);
    if (requestId.current !== id) return; // stale response
    setSearching(false);
    if (result.ok) {
      setResults(result.data);
    } else {
      setResults([]);
      setSearchError("Search failed. Try again.");
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) return;
    const timer = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  // Clears stale results as the user types below the search threshold
  // (state updates in an event handler, not an effect).
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (value.trim().length < MIN_CHARS) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
    }
  }, []);

  const go = useCallback(
    (href: string, item?: SearchResultItem) => {
      if (item) storeRecent({ ...item, href: hrefFor(item) });
      onOpenChange(false);
      setQuery("");
      router.push(href);
    },
    [onOpenChange, router],
  );

  const deals = results.filter((r) => r.kind === "deal");
  const contacts = results.filter((r) => r.kind === "contact");
  const companies = results.filter((r) => r.kind === "company");
  const hasQuery = query.trim().length >= MIN_CHARS;

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <Command label="Search or run an action">
        <CommandInput
          placeholder="Search deals, contacts, companies…"
          value={query}
          onValueChange={handleQueryChange}
        />
        <CommandList>
          {searching && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          )}
          {!searching && searchError && (
            <div className="px-4 py-6 text-center text-sm text-destructive">
              {searchError}
            </div>
          )}
          {!searching && hasQuery && results.length === 0 && !searchError && (
            <CommandEmpty>No results for &lsquo;{query.trim()}&rsquo;</CommandEmpty>
          )}

          {!searching && !hasQuery && recent.length > 0 && (
            <CommandGroup heading="Recent">
              {recent.map((r) => (
                <CommandItem
                  key={`${r.kind}:${r.id}`}
                  value={`${r.title} ${r.subtitle ?? ""}`}
                  onSelect={() => go(r.href, r)}
                >
                  <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{r.title}</span>
                  {r.subtitle && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {r.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!searching && deals.length > 0 && (
            <CommandGroup heading="Deals">
              {deals.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.title} ${r.subtitle ?? ""}`}
                  onSelect={() => go(hrefFor(r), r)}
                >
                  <span className="truncate">{r.title}</span>
                  {r.subtitle && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {r.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!searching && contacts.length > 0 && (
            <CommandGroup heading="Contacts">
              {contacts.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.title} ${r.subtitle ?? ""}`}
                  onSelect={() => go(hrefFor(r), r)}
                >
                  <span className="truncate">{r.title}</span>
                  {r.subtitle && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {r.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!searching && companies.length > 0 && (
            <CommandGroup heading="Companies">
              {companies.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`${r.title} ${r.subtitle ?? ""}`}
                  onSelect={() => go(hrefFor(r), r)}
                >
                  <span className="truncate">{r.title}</span>
                  {r.subtitle && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {r.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!searching && (!hasQuery || results.length === 0) && (
            <CommandGroup heading="Actions">
              {QUICK_ACTIONS.map((action) => (
                <CommandItem
                  key={action.label}
                  value={action.label}
                  onSelect={() => go(action.href)}
                >
                  <Plus className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  {action.label}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {action.hint}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>

        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border px-1">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border px-1">
              <CornerDownLeft className="h-3 w-3" />
            </kbd>{" "}
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border px-1">esc</kbd> close
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
