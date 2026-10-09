"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VALUE_RANGES = [
  { value: "all", label: "All values" },
  { value: "under-10k", label: "Under $10K" },
  { value: "10k-50k", label: "$10K – $50K" },
  { value: "50k-100k", label: "$50K – $100K" },
  { value: "over-100k", label: "Over $100K" },
] as const;

/** Client-side value filter (mirrors the URL `value` param). */
export function matchesValueRange(value: number, range: string): boolean {
  switch (range) {
    case "under-10k":
      return value < 10_000;
    case "10k-50k":
      return value >= 10_000 && value <= 50_000;
    case "50k-100k":
      return value > 50_000 && value <= 100_000;
    case "over-100k":
      return value > 100_000;
    default:
      return true;
  }
}

interface BoardFiltersProps {
  owners: { id: string; name: string }[];
}

/**
 * Filter bar above the board: owner select, board search, value range.
 * Synced to the URL (`?owner=&q=&value=`) so filtered views are shareable;
 * the board reads the same params to filter its cards.
 */
export function BoardFilters({ owners }: BoardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const owner = searchParams.get("owner") ?? "all";
  const value = searchParams.get("value") ?? "all";
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync when the URL changes elsewhere (clear filters).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  function updateParams(updater: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      updateParams((p) => {
        if (next.trim()) {
          p.set("q", next.trim());
        } else {
          p.delete("q");
        }
      });
    }, 250);
  }

  const hasFilters =
    owner !== "all" ||
    value !== "all" ||
    (searchParams.get("q") ?? "") !== "";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="board-owner">Owner</Label>
        <Select
          value={owner}
          onValueChange={(v) =>
            updateParams((p) => {
              if (v === "all") {
                p.delete("owner");
              } else {
                p.set("owner", v);
              }
            })
          }
        >
          <SelectTrigger id="board-owner" className="h-11 w-44">
            <SelectValue placeholder="Owner: All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Owner: All</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="board-search">Search</Label>
        <Input
          id="board-search"
          placeholder="Search deals or companies"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="h-11 w-56"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="board-value">Value</Label>
        <Select
          value={value}
          onValueChange={(v) =>
            updateParams((p) => {
              if (v === "all") {
                p.delete("value");
              } else {
                p.set("value", v);
              }
            })
          }
        >
          <SelectTrigger id="board-value" className="h-11 w-40">
            <SelectValue placeholder="All values" />
          </SelectTrigger>
          <SelectContent>
            {VALUE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
