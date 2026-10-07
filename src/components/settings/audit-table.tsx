"use client";

import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";

import { formatDate } from "@/lib/format";
import { listAuditLog, type AuditList } from "@/lib/actions/audit";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FieldLabel,
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/reports/ui";
import { EmptyState, PageHeader } from "@/components/reports/page-header";

function DiffSummary({ diff }: { diff: Record<string, unknown> }) {
  const entries = Object.entries(diff).slice(0, 3);
  if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-xs text-muted-foreground">
      {entries
        .map(([k, v]) => {
          const val = typeof v === "object" ? JSON.stringify(v) : String(v);
          return `${k}: ${val.length > 28 ? `${val.slice(0, 28)}…` : val}`;
        })
        .join(" · ")}
    </span>
  );
}

/** Filterable audit log table (admin only). */
export function AuditTable() {
  const [data, setData] = useState<AuditList | null>(null);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [page, setPage] = useState(1);

  const load = async (p: number, et: string, a: string) => {
    setLoading(true);
    const result = await listAuditLog({
      page: p,
      ...(et !== "all" ? { entityType: et } : {}),
      ...(a !== "all" ? { action: a } : {}),
    });
    if (result.ok) setData(result.data);
    else toast.error("Couldn't load the audit log");
    setLoading(false);
  };

  // Fetch-on-page-change: setState-in-effect is intentional here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(page, entityType, action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const applyFilters = () => {
    setPage(1);
    void load(1, entityType, action);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <Toaster position="bottom-right" />
      <PageHeader
        title="Audit log"
        description="Who changed what, and when. Append-only — entries are never edited or deleted."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="audit-entity">Entity</FieldLabel>
          <SelectRoot value={entityType} onValueChange={setEntityType}>
            <SelectTrigger id="audit-entity" className="w-48">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {(data?.entityTypes ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="audit-action">Action</FieldLabel>
          <SelectRoot value={action} onValueChange={setAction}>
            <SelectTrigger id="audit-action" className="w-56">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {(data?.actions ?? []).map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </div>
        <Button onClick={applyFilters}>Apply</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="tnum text-base">
            {data ? `${data.total} ${data.total === 1 ? "entry" : "entries"}` : "Audit log"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading || !data ? (
            <div className="flex flex-col gap-2 p-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.entries.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No audit entries"
                description="Nothing matches these filters yet."
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="tnum whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(e.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{e.actorName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[11px]">
                          {e.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {e.entityType}
                      </TableCell>
                      <TableCell>
                        <DiffSummary diff={e.diff} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-5 py-3">
                <p className="tnum text-xs text-muted-foreground">
                  Page {data.page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
