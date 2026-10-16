/**
 * lib/api.ts — the data seam (HANDOVER §3).
 *
 * Typed JSON fixtures under /data are read through this module only. The data
 * source behind this seam is the single swappable piece: today it is the
 * fixture set below; a future backend (the v1 Supabase layer is parked,
 * untouched, pending Sheku's ruling) replaces the internals of this file —
 * never its callers.
 */
import activitiesJson from "../../../data/activities.json";
import closedJson from "../../../data/closed.json";
import companiesJson from "../../../data/companies.json";
import contactsJson from "../../../data/contacts.json";
import dealsJson from "../../../data/deals.json";
import settingsJson from "../../../data/settings.json";
import stagesJson from "../../../data/stages.json";
import teamJson from "../../../data/team.json";
import { forecastTotal } from "@/lib/domain/forecast";
import type {
  Activity,
  ClosedSummary,
  Company,
  Contact,
  Deal,
  Person,
  Stage,
  WorkspaceSettings,
} from "./types";

export const TODAY_LABEL = "Tue, Oct 6";
export const TODAY_LONG = "Tuesday, October 6, 2026";

export const team = teamJson as Person[];
export const stages = stagesJson as Stage[];
export const companies = companiesJson as Company[];
export const contacts = contactsJson as Contact[];
export const deals = dealsJson as Deal[];
export const activities = activitiesJson as Activity[];
export const closed = closedJson as ClosedSummary;
export const settings = settingsJson as WorkspaceSettings;

/** The four open stages shown on the board (Won/Lost are close targets). */
export const openStages = stages.filter((s) => s.id !== "won" && s.id !== "lost");

export function personById(id: string): Person {
  const p = team.find((t) => t.id === id);
  if (!p) throw new Error(`Unknown person ${id}`);
  return p;
}

export function companyById(id: string): Company {
  const c = companies.find((t) => t.id === id);
  if (!c) throw new Error(`Unknown company ${id}`);
  return c;
}

export function contactById(id: string): Contact {
  const c = contacts.find((t) => t.id === id);
  if (!c) throw new Error(`Unknown contact ${id}`);
  return c;
}

export function stageById(id: string): Stage {
  const s = stages.find((t) => t.id === id);
  if (!s) throw new Error(`Unknown stage ${id}`);
  return s;
}

export function dealById(id: string): Deal | undefined {
  return deals.find((d) => d.id === id);
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
export function weightedTotal(list: Deal[]): number {
  return forecastTotal(
    list.filter(isOpenDeal).map((d) => ({
      value: d.value,
      probability: null,
      stageDefaultProbability: stageById(d.stageId).winChance,
    })),
  );
}

export function weightedForDeal(deal: Deal): number {
  const stage = stageById(deal.stageId);
  return Math.round((deal.value * stage.winChance) / 100);
}
