"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewCompanyDialog } from "@/components/companies/new-company-dialog";
import { listCompanies, type CompanyListItem } from "@/lib/actions/companies";
import { formatCompactCurrency } from "@/lib/format";

interface CompaniesTableProps {
  currentUserId: string;
}

/** Companies list: toolbar + table (desktop) / cards (mobile) + keyset pagination. */
export function CompaniesTable({ currentUserId }: CompaniesTableProps) {
  void currentUserId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<CompanyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("create") === "1");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (cursor: string | null) => {
      setLoading(true);
      const res = await listCompanies({ q: q.trim() || undefined, cursor: cursor ?? undefined });
      setLoading(false);
      if (res.ok) {
        setItems(res.data.items);
        setHasMore(res.data.nextCursor !== null);
        setCursors((prev) => {
          const next = [...prev];
          next[pageIndex + 1] = res.data.nextCursor;
          return next.slice(0, pageIndex + 2);
        });
      }
    },
    [q, pageIndex],
  );

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPageIndex(0);
      setCursors([null]);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  // Fetch-on-page-change: setState-in-effect is intentional here (loading/data states).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(cursors[pageIndex] ?? null);
  }, [load, pageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function gotoPage(next: number) {
    setPageIndex(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Companies"
        description="Your accounts, ranked by open pipeline."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New company
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name or industry…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Open deal value</TableHead>
              <TableHead className="text-right">Contacts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  {q ? (
                    <EmptyState
                      title={`No companies match "${q}"`}
                      description="Try a different search."
                      action={
                        <Button variant="outline" onClick={() => setQ("")}>
                          Clear search
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      title="No companies yet"
                      description="Add your first company to start tracking accounts."
                      action={
                        <Button onClick={() => setDialogOpen(true)}>
                          <Plus className="h-4 w-4" />
                          Add your first company
                        </Button>
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/companies/${c.id}`)}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                      </span>
                      {c.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.industry ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.size ?? "—"}</TableCell>
                  <TableCell className="text-right tnum font-medium">
                    {c.openDealValue > 0 ? formatCompactCurrency(c.openDealValue) : "—"}
                  </TableCell>
                  <TableCell className="text-right tnum">{c.contactCount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-2 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState
            title={q ? `No companies match "${q}"` : "No companies yet"}
            description={q ? "Try a different search." : "Add your first company to get started."}
            action={
              q ? (
                <Button variant="outline" onClick={() => setQ("")}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add your first company
                </Button>
              )
            }
          />
        ) : (
          items.map((c) => (
            <Link key={c.id} href={`/companies/${c.id}`} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[c.industry, `${c.contactCount} contacts`].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="tnum text-sm font-medium">
                {c.openDealValue > 0 ? formatCompactCurrency(c.openDealValue) : "—"}
              </span>
            </Link>
          ))
        )}
      </div>

      {(items.length > 0 || pageIndex > 0) && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tnum">Page {pageIndex + 1}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pageIndex === 0 || loading} onClick={() => gotoPage(pageIndex - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => gotoPage(pageIndex + 1)}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <NewCompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(company) => router.push(`/companies/${company.id}`)}
      />
    </div>
  );
}
