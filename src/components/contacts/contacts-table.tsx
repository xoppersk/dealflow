"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/shared/user-avatar";
import { NewContactDialog } from "@/components/contacts/new-contact-dialog";
import { listActiveUsers, listContacts, type ContactListItem } from "@/lib/actions/contacts";
import { listCompanies } from "@/lib/actions/companies";
import { fullName } from "@/lib/format";
import type { UserRow } from "@/lib/supabase/types";

interface ContactsTableProps {
  currentUserId: string;
}

/**
 * Contacts list: toolbar (search, owner/company filters, + New contact),
 * desktop table / mobile cards, keyset pagination footer.
 */
export function ContactsTable({ currentUserId }: ContactsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [owners, setOwners] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("create") === "1");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (cursor: string | null) => {
      setLoading(true);
      const res = await listContacts({
        q: q.trim() || undefined,
        ownerId: ownerId || undefined,
        companyId: companyId || undefined,
        cursor: cursor ?? undefined,
      });
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
    [q, ownerId, companyId, pageIndex],
  );

  // Debounced search / filter reload — resets to the first page.
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPageIndex(0);
      setCursors([null]);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, ownerId, companyId]);

  // Fetch-on-page-change: setState-in-effect is intentional here (loading/data states).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(cursors[pageIndex] ?? null);
  }, [load, pageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listActiveUsers().then((r) => r.ok && setOwners(r.data));
    listCompanies({}).then((r) => r.ok && setCompanies(r.data.items.map((c) => ({ id: c.id, name: c.name }))));
  }, []);

  function gotoPage(next: number) {
    setPageIndex(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contacts"
        description="Everyone you're selling to."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New contact
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All owners</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All companies</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Owner</TableHead>
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
                      title={`No contacts match "${q}"`}
                      description="Try a different search."
                      action={
                        <Button variant="outline" onClick={() => setQ("")}>
                          Clear search
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      title="No contacts yet"
                      description="Add your first contact to start building your pipeline."
                      action={
                        <Button onClick={() => setDialogOpen(true)}>
                          <Plus className="h-4 w-4" />
                          Add your first contact
                        </Button>
                      }
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/contacts/${c.id}`)}
                >
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <UserAvatar userId={c.id} name={fullName(c.first_name, c.last_name)} size="sm" />
                      {fullName(c.first_name, c.last_name)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.companyName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.ownerName ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-2 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState
            title={q ? `No contacts match "${q}"` : "No contacts yet"}
            description={q ? "Try a different search." : "Add your first contact to get started."}
            action={
              q ? (
                <Button variant="outline" onClick={() => setQ("")}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add your first contact
                </Button>
              )
            }
          />
        ) : (
          items.map((c) => (
            <Link
              key={c.id}
              href={`/contacts/${c.id}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <UserAvatar userId={c.id} name={fullName(c.first_name, c.last_name)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fullName(c.first_name, c.last_name)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[c.companyName, c.email].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))
        )}
      </div>

      {/* Pagination footer */}
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

      <NewContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentUserId={currentUserId}
        onCreated={(id) => router.push(`/contacts/${id}`)}
      />
    </div>
  );
}
