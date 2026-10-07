"use client";

import Link from "next/link";

import { formatCompactCurrency, formatDate, relativeTime } from "@/lib/format";
import type { StalledDeal } from "@/lib/actions/reports";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TooltipSimple } from "./ui";
import { EmptyState } from "./page-header";
import { UserAvatar } from "./user-avatar";

/** Downloads rows as a CSV file via a client-side Blob. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function urgencyVariant(days: number): "secondary" | "warning" | "destructive" {
  if (days > 14) return "destructive";
  if (days >= 7) return "warning";
  return "secondary";
}

/**
 * Stalled deals table: deal, owner, days in stage, last touch — every row
 * drills through to the deal page. Export CSV downloads the visible rows.
 */
export function StalledTable({
  deals,
  thresholdDays,
}: {
  deals: StalledDeal[];
  thresholdDays: number;
}) {
  if (deals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stalled deals</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No stalled deals"
            description={`No open deal has gone untouched for more than ${thresholdDays} days. The team is on it.`}
          />
        </CardContent>
      </Card>
    );
  }

  const exportRows = () =>
    downloadCsv(
      "stalled-deals.csv",
      ["Deal", "Company", "Owner", "Value", "Stage", "Days in stage", "Days since touch", "Last touch"],
      deals.map((d) => [
        d.name,
        d.companyName ?? "",
        d.ownerName,
        `${d.currency} ${d.value}`,
        d.stageName,
        d.daysInStage,
        d.daysSinceTouch,
        formatDate(d.lastTouchedAt),
      ]),
    );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Stalled deals</CardTitle>
        <Button variant="outline" size="sm" onClick={exportRows}>
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="tnum text-right">Value</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="tnum text-right">Days in stage</TableHead>
              <TableHead>Last touch</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.map((d) => (
              <TableRow key={d.dealId}>
                <TableCell>
                  <Link
                    href={`/deals/${d.dealId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {d.name}
                  </Link>
                  {d.companyName && (
                    <p className="text-xs text-muted-foreground">{d.companyName}</p>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <UserAvatar userId={d.ownerId} name={d.ownerName} size="sm" />
                    <span className="text-sm">{d.ownerName}</span>
                  </span>
                </TableCell>
                <TableCell className="tnum text-right">
                  {formatCompactCurrency(d.value, d.currency)}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: d.stageColor }}
                      aria-hidden
                    />
                    {d.stageName}
                  </span>
                </TableCell>
                <TableCell className="tnum text-right">
                  <TooltipSimple label={`${d.daysInStage} days in ${d.stageName}`}>
                    <Badge variant={urgencyVariant(d.daysInStage)}>{d.daysInStage}d</Badge>
                  </TooltipSimple>
                </TableCell>
                <TableCell className="tnum whitespace-nowrap text-sm text-muted-foreground">
                  {relativeTime(d.lastTouchedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
