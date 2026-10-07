"use client";

import { useState } from "react";

import { Button, Input, FieldLabel, SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "./ui";

/**
 * Reports filter bar: date range + rep selector + apply/clear.
 * `team` comes from getReportsData (active users only).
 */
export interface ReportFilters {
  from: string;
  to: string;
  ownerId: string | null;
}

export function ReportFilterBar({
  initial,
  team,
  onApply,
}: {
  initial: ReportFilters;
  team: { id: string; name: string }[];
  onApply: (filters: ReportFilters) => void;
}) {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [ownerId, setOwnerId] = useState<string | null>(initial.ownerId);

  const dirty = from !== initial.from || to !== initial.to || ownerId !== initial.ownerId;

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="reports-from">From</FieldLabel>
        <Input
          id="reports-from"
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="reports-to">To</FieldLabel>
        <Input
          id="reports-to"
          type="date"
          value={to}
          min={from}
          onChange={(e) => setTo(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor="reports-rep">Rep</FieldLabel>
        <SelectRoot
          value={ownerId ?? "all"}
          onValueChange={(v) => setOwnerId(v === "all" ? null : v)}
        >
          <SelectTrigger id="reports-rep" className="w-48">
            <SelectValue placeholder="All reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reps</SelectItem>
            {team.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </div>
      <div className="flex gap-2">
        <Button disabled={!dirty} onClick={() => onApply({ from, to, ownerId })}>
          Apply
        </Button>
        <Button
          variant="outline"
          disabled={!dirty}
          onClick={() => {
            setFrom(initial.from);
            setTo(initial.to);
            setOwnerId(initial.ownerId);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
