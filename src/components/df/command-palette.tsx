"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { companyByIdSafe, stageByIdSafe } from "@/lib/df/api";
import { useDatasetOptional } from "./dataset-context";
import { moneyCompact } from "@/lib/df/format";
import type { Deal } from "@/lib/df/types";

type Option =
  | { kind: "deal"; id: string; deal: Deal }
  | { kind: "contact"; id: string; contactId: string }
  | { kind: "company"; id: string; companyId: string }
  | { kind: "action"; id: string; action: "L" | "N" | "M"; deal: Deal };

function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return <>{text}</>;
  // The screens highlight the whole matched word, not the typed substring
  // (query "brack" highlights all of "Bracken").
  let start = i;
  let end = i + q.length;
  while (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1]!)) start--;
  while (end < text.length && /[\p{L}\p{N}]/u.test(text[end]!)) end++;
  return (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

const ACTION_LABELS = {
  L: "Log a call",
  N: "Set or change the next step",
  M: "Move to another stage…",
} as const;

function ActionIcon({ action }: { action: "L" | "N" | "M" }) {
  if (action === "L")
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M3 2.5h3l1.2 3-1.7 1.2a8 8 0 0 0 3.8 3.8l1.2-1.7 3 1.2v3a1 1 0 0 1-1 1A11.5 11.5 0 0 1 2 3.5a1 1 0 0 1 1-1Z" />
      </svg>
    );
  if (action === "N")
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M2.5 8h9M8.5 4.5 12 8l-3.5 3.5" />
      </svg>
    );
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="1.5" y="3" width="3.5" height="10" rx="1" />
      <rect x="6.25" y="3" width="3.5" height="10" rx="1" />
      <rect x="11" y="3" width="3.5" height="10" rx="1" />
    </svg>
  );
}

/**
 * CommandPalette (§7 / D-04), screen-exact from CommandPalette.html.
 * ⌘K from every app screen (wired in AppShell). Groups: Deals; People and
 * companies; actions on the highlighted deal (L log a call, N next step,
 * M move stage). Matches are marked; the highlighted option is the dark row.
 */
export function CommandPalette({
  open,
  onClose,
  initialQuery = "",
}: {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const router = useRouter();
  const ds = useDatasetOptional();
  const deals = ds?.deals ?? [];
  const contacts = ds?.contacts ?? [];
  const companies = ds?.companies ?? [];
  const stages = ds?.stages ?? [];
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset the search when the palette (re)opens — adjusted during render
  // (React's recommended pattern) instead of in an effect.
  const [prevOpenKey, setPrevOpenKey] = useState<string | null>(null);
  const openKey = open ? `open:${initialQuery}` : null;
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    if (openKey !== null) {
      setQuery(initialQuery);
      setActive(0);
    }
  }

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const q = query.trim().toLowerCase();

  const { groups, flat, topDeal } = useMemo(() => {
    const matches = (text: string) => !q || text.toLowerCase().includes(q);
    const matchedDeals = deals.filter((d) => matches(`${companyByIdSafe(companies, d.companyId)?.name ?? ""} ${d.name}`));
    const dealOpts: Option[] = matchedDeals.map((d) => ({ kind: "deal" as const, id: `deal-${d.id}`, deal: d }));
    const peopleOpts: Option[] = [
      ...contacts
        .filter((c) => {
          // A person matches on their own name or title…
          if (matches(`${c.name} ${c.title}`)) return true;
          // …or through their company — but then the design draws only the
          // matched deal's primary contact (the first person named on the
          // deal), not every colleague at that company: for "brack" the
          // People group is Jordan Bell alone (D-04).
          const company = companies.find((x) => x.id === c.companyId);
          if (!company || !matches(company.name)) return false;
          const deal = matchedDeals.find((d) => d.companyId === c.companyId);
          const primaryId = deal?.detail?.people?.[0]?.contactId;
          return primaryId ? primaryId === c.id : true;
        })
        .map((c) => ({ kind: "contact" as const, id: `contact-${c.id}`, contactId: c.id })),
      ...companies
        .filter((c) => matches(c.name))
        .map((c) => ({ kind: "company" as const, id: `company-${c.id}`, companyId: c.id })),
    ];
    const top = dealOpts[0]?.kind === "deal" ? dealOpts[0].deal : undefined;
    const actionOpts: Option[] = top
      ? (["L", "N", "M"] as const).map((a) => ({ kind: "action" as const, id: `action-${a}`, action: a, deal: top }))
      : [];
    const groups: { label: string; options: Option[] }[] = [];
    if (dealOpts.length) groups.push({ label: "Deals", options: dealOpts });
    if (peopleOpts.length) groups.push({ label: "People and companies", options: peopleOpts });
    if (top) {
      groups.push({ label: `Do something on ${companyByIdSafe(companies, top.companyId)?.name ?? top.name}`, options: actionOpts });
    }
    return { groups, flat: groups.flatMap((g) => g.options), topDeal: top };
  }, [q, deals, contacts, companies]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  function runAction(deal: Deal, action: "L" | "N" | "M") {
    onClose();
    if (action === "L") router.push(`/app/activities?deal=${deal.id}&log=call`);
    else if (action === "N") router.push(`/app/deals/${deal.companyId}?focus=next-step`);
    else router.push(`/app/pipeline?deal=${deal.id}&move=1`);
  }

  function activate(opt: Option | undefined) {
    if (!opt) return;
    if (opt.kind === "deal") {
      onClose();
      router.push(`/app/deals/${opt.deal.companyId}`);
    } else if (opt.kind === "contact") {
      onClose();
      router.push(`/app/contacts/${opt.contactId}`);
    } else if (opt.kind === "company") {
      onClose();
      router.push(`/app/companies/${opt.companyId}`);
    } else {
      runAction(opt.deal, opt.action);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(flat[active]);
    } else if (
      topDeal &&
      query.trim() === "" &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      (e.key === "l" || e.key === "n" || e.key === "m" || e.key === "L" || e.key === "N" || e.key === "M")
    ) {
      // §10: L / N / M act on the highlighted deal (from a fresh palette, so
      // the keys never fight with typing a search — see BUILD-LOG note).
      e.preventDefault();
      runAction(topDeal, e.key.toUpperCase() as "L" | "N" | "M");
    }
  }

  return (
    <div className="scrim" style={{ padding: "0 16px", alignItems: "flex-start" }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="palette"
        style={{ marginTop: 96 }}
        onKeyDown={onKeyDown}
      >
        <div className="input-row">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#66716E" strokeWidth="1.6" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" />
            <path d="M12 12l4 4" />
          </svg>
          <label htmlFor="df-palette-input" className="sr-only">
            Search deals, people, companies or commands
          </label>
          <input
            id="df-palette-input"
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls="df-palette-list"
            aria-activedescendant={flat[active] ? `df-opt-${flat[active].id}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            autoComplete="off"
          />
          <span className="kb">esc</span>
        </div>

        <ul id="df-palette-list" role="listbox" aria-label="Results" className="list" ref={listRef} style={{ margin: 0, listStyle: "none" }}>
          {groups.map((g) => (
            <li key={g.label} role="presentation">
              <div className="gl" role="presentation">
                {g.label}
              </div>
              <ul role="group" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {g.options.map((opt) => {
                  const idx = flat.indexOf(opt);
                  const selected = idx === active;
                  return (
                    <li
                      key={opt.id}
                      id={`df-opt-${opt.id}`}
                      role="option"
                      aria-selected={selected}
                      className="opt"
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => activate(opt)}
                    >
                      {renderOption(opt, query, topDeal, { deals, contacts, companies, stages })}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {flat.length === 0 ? (
            <li className="opt" role="option" aria-selected={false} aria-disabled="true">
              <span>No matches for “{query}”</span>
            </li>
          ) : null}
        </ul>

        <div className="foot">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="kb">↑↓</span> choose
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="kb">↵</span> open
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="kb">L N M</span> act on the highlighted deal
          </span>
        </div>
      </div>
    </div>
  );
}

function renderOption(
  opt: Option,
  query: string,
  topDeal: Deal | undefined,
  lists: { deals: Deal[]; contacts: import("@/lib/df/types").Contact[]; companies: import("@/lib/df/types").Company[]; stages: import("@/lib/df/types").Stage[] },
) {
  const { deals, contacts, companies, stages } = lists;
  if (opt.kind === "deal") {
    const company = companyByIdSafe(companies, opt.deal.companyId) ?? {
      id: opt.deal.companyId, name: opt.deal.name, initials: "??", mgBg: "#F1EEE6", mgColor: "#17201E",
    };
    return (
      <>
        <span>
          <span className="mg" style={{ width: 28, height: 28, background: company.mgBg, color: company.mgColor, fontSize: 11 }} aria-hidden="true">
            {company.initials}
          </span>
          <span>
            <Highlighted text={company.name} query={query} /> · {opt.deal.name}
          </span>
        </span>
        <span className="mono" style={{ fontSize: 13 }}>
          {moneyCompact(opt.deal.value)} · {stageByIdSafe(stages, opt.deal.stageId)?.name ?? opt.deal.stageId}
        </span>
      </>
    );
  }
  if (opt.kind === "contact") {
    const c = contacts.find((x) => x.id === opt.contactId)!;
    const comp = companies.find((x) => x.id === c.companyId);
    const compDeal = deals.find((d) => d.companyId === c.companyId);
    const due =
      topDeal && compDeal && compDeal.id === topDeal.id && compDeal.nextStep
        ? compDeal.nextStep.dueLabel.match(/(\w{3}),/)?.[1]
        : undefined;
    return (
      <>
        <span>
          <span className="av" style={{ width: 28, height: 28 }} aria-hidden="true">
            {c.name.split(" ").map((w) => w[0]).join("")}
          </span>
          <span>
            {c.name} · {c.title}, <Highlighted text={comp?.name ?? ""} query={query} />
          </span>
        </span>
        {due ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--watch)", fontSize: 12, fontWeight: 600 }}>
            <i style={{ width: 6, height: 6, borderRadius: 3, background: "var(--watch)" }} />
            Follow-up due {due}
          </span>
        ) : null}
      </>
    );
  }
  if (opt.kind === "company") {
    const comp = companyByIdSafe(companies, opt.companyId)!;
    const open = deals.filter((d) => d.companyId === comp.id).reduce((s, d) => s + d.value, 0);
    return (
      <>
        <span>
          <span className="mg" style={{ width: 28, height: 28, background: comp.mgBg, color: comp.mgColor, fontSize: 11 }} aria-hidden="true">
            {comp.initials}
          </span>
          <span>
            <Highlighted text={comp.name} query={query} /> · company
          </span>
        </span>
        <span className="mono" style={{ fontSize: 13 }}>
          {moneyCompact(open)} open
        </span>
      </>
    );
  }
  return (
    <>
      <span>
        <span className="ic" aria-hidden="true">
          <ActionIcon action={opt.action} />
        </span>
        <span>{ACTION_LABELS[opt.action]}</span>
      </span>
      <span className="kb">{opt.action}</span>
    </>
  );
}
