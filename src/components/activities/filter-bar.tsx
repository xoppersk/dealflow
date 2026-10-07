"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActivityKind } from "@/lib/types";

export interface ActivityFilters {
  type: ActivityKind | "all";
  ownerId: string | "all";
  q: string;
}

export interface FilterBarProps {
  filters: ActivityFilters;
  onChange: (filters: ActivityFilters) => void;
  team: { id: string; name: string }[];
}

const TYPE_OPTIONS: { value: ActivityKind | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "call", label: "Calls" },
  { value: "email", label: "Emails" },
  { value: "meeting", label: "Meetings" },
  { value: "note", label: "Notes" },
];

/** Slim filter row for the activities queue: type, owner, deal search. */
export function FilterBar({ filters, onChange, team }: FilterBarProps) {
  const hasActive = filters.type !== "all" || filters.ownerId !== "all" || filters.q.trim() !== "";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          placeholder="Search deals or subjects…"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          className="pl-9"
          aria-label="Search activities"
        />
      </div>
      <div className="flex gap-2">
        <Select
          value={filters.type}
          onValueChange={(v) => onChange({ ...filters, type: v as ActivityFilters["type"] })}
        >
          <SelectTrigger className="w-[130px]" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.ownerId}
          onValueChange={(v) => onChange({ ...filters, ownerId: v })}
        >
          <SelectTrigger className="w-[150px]" aria-label="Filter by owner">
            <SelectValue placeholder="All owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {team.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActive && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange({ type: "all", ownerId: "all", q: "" })}
            aria-label="Clear filters"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
