"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/shared/user-avatar";
import { addDealContact, removeDealContact, type DealContactLink } from "@/lib/actions/deals";
import { listContacts } from "@/lib/actions/contacts";
import { fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LinkedContactsProps {
  dealId: string;
  links: DealContactLink[];
}

/** Linked contacts manager (Details tab): add via search, remove inline. */
export function LinkedContacts({ dealId, links }: LinkedContactsProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; email: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const linkedIds = new Set(links.map((l) => l.contact.id));

  // Debounced contact search while the add-contact picker is open.
  useEffect(() => {
    if (!adding) return;
    if (debounce.current) clearTimeout(debounce.current);
    const term = query.trim();
    if (term.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      const res = await listContacts({ q: term });
      setSearching(false);
      if (res.ok) {
        setResults(
          res.data.items
            .filter((c) => !linkedIds.has(c.id))
            .slice(0, 8)
            .map((c) => ({ id: c.id, name: fullName(c.first_name, c.last_name), email: c.email })),
        );
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, adding]); // eslint-disable-line react-hooks/exhaustive-deps

  async function link(contactId: string) {
    setBusy(contactId);
    const res = await addDealContact({ dealId, contactId, role: role.trim() || null });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Contact linked.");
    setQuery("");
    setResults([]);
    router.refresh();
  }

  async function unlink(contactId: string) {
    setBusy(contactId);
    const res = await removeDealContact({ dealId, contactId });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Contact unlinked.");
    router.refresh();
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Linked contacts</h3>
        <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" />
          {adding ? "Done" : "Link contact"}
        </Button>
      </div>

      {adding && (
        <div className="grid gap-2 rounded-[2px] border p-3">
          <Label htmlFor="link-contact-search" className="text-xs">
            Search contacts
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="link-contact-search"
              className="pl-9"
              placeholder="Type at least 2 characters…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {searching && (
            <p className="text-xs text-muted-foreground">Searching…</p>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground">No unlinked contacts match.</p>
          )}
          <ul className="grid gap-1">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => link(r.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent cursor-pointer disabled:opacity-50"
                >
                  <UserAvatar userId={r.id} name={r.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.name}</span>
                    {r.email && <span className="block truncate text-xs text-muted-foreground">{r.email}</span>}
                  </span>
                  {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ul>
          <div className="grid gap-1.5">
            <Label htmlFor="link-role" className="text-xs">
              Role (optional)
            </Label>
            <Input
              id="link-role"
              placeholder="Decision maker, champion…"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts linked to this deal yet.</p>
      ) : (
        <ul className="grid gap-2">
          {links.map(({ contact, role: r }) => (
            <li
              key={contact.id}
              className="flex items-center gap-3 rounded-[2px] border px-3 py-2"
            >
              <UserAvatar userId={contact.id} name={fullName(contact.first_name, contact.last_name)} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {fullName(contact.first_name, contact.last_name)}
                </p>
                <p className={cn("truncate text-xs text-muted-foreground")}>
                  {[r, contact.title, contact.email].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`Unlink ${fullName(contact.first_name, contact.last_name)}`}
                disabled={busy === contact.id}
                onClick={() => unlink(contact.id)}
              >
                {busy === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
