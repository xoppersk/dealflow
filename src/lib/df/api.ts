/**
 * lib/df/api.ts — pure dataset helpers (HANDOVER §3).
 *
 * Production data comes from src/lib/df/db.ts (Supabase) as a Dataset; this
 * module only holds PURE functions over a dataset's lists — no fixture
 * imports, no globals. Every lookup takes the list it searches, so the
 * same helper works for server pages, client components and the board's
 * optimistic local state.
 */
import { forecastTotal } from "@/lib/domain/forecast";
import { dateLabelWithDay, todayLong } from "./format";
import type { Company, Contact, Deal, Person, Stage } from "./types";

/** Real-clock labels (the fixture era's fixed "Tue, Oct 6" is gone). */
export const TODAY_LABEL = dateLabelWithDay(new Date());
export const TODAY_LONG = todayLong(new Date());

/** The open stages shown on the board (Won/Lost are close targets). */
export function openStagesOf(stages: Stage[]): Stage[] {
  return stages.filter((s) => s.id !== "won" && s.id !== "lost");
}

export function personById(list: Person[], id: string): Person {
  const p = list.find((t) => t.id === id);
  if (!p) throw new Error(`Unknown person ${id}`);
  return p;
}

export function personByIdSafe(list: Person[], id: string): Person | undefined {
  return list.find((t) => t.id === id);
}

export function companyById(list: Company[], id: string): Company {
  const c = list.find((t) => t.id === id);
  if (!c) throw new Error(`Unknown company ${id}`);
  return c;
}

export function companyByIdSafe(list: Company[], id: string): Company | undefined {
  return list.find((t) => t.id === id);
}

export function contactById(list: Contact[], id: string): Contact {
  const c = list.find((t) => t.id === id);
  if (!c) throw new Error(`Unknown contact ${id}`);
  return c;
}

export function contactByIdSafe(list: Contact[], id: string): Contact | undefined {
  return list.find((t) => t.id === id);
}

export function stageById(list: Stage[], id: string): Stage {
  const s = list.find((t) => t.id === id);
  if (!s) throw new Error(`Unknown stage ${id}`);
  return s;
}

export function stageByIdSafe(list: Stage[], id: string): Stage | undefined {
  return list.find((t) => t.id === id);
}

export function dealById(list: Deal[], id: string): Deal | undefined {
  return list.find((d) => d.id === id);
}

/** Deal-page route param resolution: a deal uuid first, then the company
 *  id (the v2 screens link to /app/deals/<companyId> throughout). Returns
 *  the company's first open deal, else its first deal. */
export function resolveDeal(list: Deal[], param: string): Deal | undefined {
  return (
    list.find((d) => d.id === param) ??
    list.find((d) => d.companyId === param && isOpenDeal(d)) ??
    list.find((d) => d.companyId === param)
  );
}

export function dealsInStage(list: Deal[], stageId: string): Deal[] {
  return list.filter((d) => d.stageId === stageId);
}

export function stageTotal(list: Deal[], stageId: string): number {
  return dealsInStage(list, stageId).reduce((sum, d) => sum + d.value, 0);
}

/** A deal still in the open pipeline (not closed Won/Lost). */
export function isOpenDeal(deal: Deal): boolean {
  return deal.stageId !== "won" && deal.stageId !== "lost";
}

export function openTotal(list: Deal[]): number {
  return list.filter(isOpenDeal).reduce((sum, d) => sum + d.value, 0);
}

/**
 * Weighted forecast via the salvaged v1 domain module (Σ value × stage win
 * chance). Closed deals are excluded entirely: a won deal leaves the open
 * forecast rather than counting at 100%, a lost one rather than at 0%.
 */
export function weightedTotal(list: Deal[], stages: Stage[]): number {
  return forecastTotal(
    list.filter(isOpenDeal).map((d) => ({
      value: d.value,
      probability: null,
      stageDefaultProbability: stageByIdSafe(stages, d.stageId)?.winChance ?? 0,
    })),
  );
}

export function weightedForDeal(deal: Deal, stages: Stage[]): number {
  const stage = stageByIdSafe(stages, deal.stageId);
  return Math.round((deal.value * (stage?.winChance ?? 0)) / 100);
}

/** Initials from a display name ("Sheku Koroma" → "SK"). */
export function initialsOfName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Deterministic avatar palette (users table has no avatar colour columns
 *  in 00012 — colours derive from a stable hash of the user id). */
const AVATAR_PALETTE: { bg: string; color: string }[] = [
  { bg: "#17201E", color: "#FFFFFF" },
  { bg: "#E7E0F2", color: "#17201E" },
  { bg: "#D9ECE9", color: "#17201E" },
  { bg: "#F1E1D9", color: "#17201E" },
  { bg: "#E3EAF6", color: "#23407A" },
  { bg: "#E6F0E4", color: "#2F5B2A" },
  { bg: "#F6E9D3", color: "#7A4A06" },
  { bg: "#F3E3E8", color: "#7A2B45" },
];

export function avatarColorsFor(id: string): { bg: string; color: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
}

/** Deterministic company monogram colours (companies have no colour
 *  columns either — same hash approach, company palette). */
const COMPANY_PALETTE: { bg: string; color: string }[] = [
  { bg: "#E3EAF6", color: "#23407A" },
  { bg: "#EFE7DA", color: "#6B4A1F" },
  { bg: "#E6F0E4", color: "#2F5B2A" },
  { bg: "#ECE8F3", color: "#4B3B78" },
  { bg: "#F6E9D3", color: "#7A4A06" },
  { bg: "#FCEFD9", color: "#8A5300" },
  { bg: "#17201E", color: "#FFFFFF" },
  { bg: "#F3E3E8", color: "#7A2B45" },
  { bg: "#E8E5DD", color: "#17201E" },
];

export function companyColorsFor(id: string): { bg: string; color: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return COMPANY_PALETTE[hash % COMPANY_PALETTE.length]!;
}
