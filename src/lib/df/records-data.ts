/**
 * Records-group data seam (R-01…R-05, X-05).
 *
 * The 12 canon contacts / 9 companies / 8 deals live in the foundation
 * fixtures and are read through lib/df/api.ts. Everything the Records
 * screens draw *beyond* that canon — list-row relationship words, last-touch
 * flags, per-deal activity, contact histories, company health words and
 * facts — lives in data/records.json (flagged screen-drawn) and is read
 * through this module only. Pages never read the JSON directly.
 */
import recordsJson from "../../../data/records.json";
import { companyById, contactById, contacts, dealById, deals, personById, stageById } from "./api";
import { moneyCompact } from "./format";
import type { Contact, Deal } from "./types";

/* ---------- shared shapes ---------- */

export type Tone = "strong" | "good" | "new" | "cooling" | "watch" | "act" | "on-track" | "neutral" | "ok";

export interface RichPart {
  kind: "text" | "mono" | "bold" | "link";
  text: string;
  href?: string;
}

export interface HistoryRow {
  date: string;
  ownerId: string;
  title: string;
  /** Contact-history suffix drawn right after the bold title (", 31 min"). */
  rest?: string;
  /** Deal-activity subject drawn after " · ". */
  subject?: string;
  detail: string;
  act?: boolean;
}

/* ---------- contacts list (R-02) ---------- */

export interface ContactListEntry {
  relationshipLabel: string;
  relationshipTone: Tone;
  relationshipNote: string;
  lastTouchDate: string;
  lastTouchFlag?: string;
  lastTouchFlagTone?: Tone;
  openValue: number | null;
  ownerId: string;
  cooling?: boolean;
  everyoneOnly?: boolean;
}

const records = recordsJson as unknown as {
  extraCompanies: Record<string, { name: string; initials: string; mgBg: string; mgColor: string }>;
  contactsList: Record<string, ContactListEntry>;
  contactsListOrder: string[];
  contactDetails: Record<string, ContactDetailEntry>;
  dealPages: Record<string, DealPageEntry>;
  staleNotice: Record<string, StaleNoticeEntry>;
  companiesList: Record<string, CompanyListEntry>;
  companiesListOrder: string[];
  companyDetails: Record<string, CompanyDetailEntry>;
  companyPeopleDates: Record<string, Record<string, string>>;
};

export function contactListEntry(contactId: string): ContactListEntry | undefined {
  return records.contactsList[contactId];
}

/** The 10 rows drawn on Contacts.html, in drawn order ("On open deals"). */
export function contactsOnOpenDeals(): Contact[] {
  return records.contactsListOrder.map((id) => contactById(id));
}

/** Everyone: the drawn 10 plus the canon contacts the screen holds back
 *  (Rachel Stone, Marcus Hale — flagged everyoneOnly in records.json). */
export function contactsEveryone(): Contact[] {
  const drawn = contactsOnOpenDeals();
  const extra = Object.keys(records.contactsList)
    .filter((id) => records.contactsList[id]?.everyoneOnly)
    .map((id) => contactById(id));
  // Keep the Bracken trio together: Jordan, Rachel, Marcus, then the rest.
  const bracken = [...drawn.filter((c) => c.companyId === "bracken-works"), ...extra];
  return [...bracken, ...drawn.filter((c) => c.companyId !== "bracken-works")];
}

export function contactsCustomers(): Contact[] {
  return contactsOnOpenDeals().filter((c) => c.customer);
}

/* ---------- contact detail (R-03) ---------- */

export interface ContactDetailEntry {
  phone?: string;
  roleOnDeal: string;
  dealRoleShort: string;
  prefers: string;
  metThrough: string;
  standingParts?: RichPart[];
  history: HistoryRow[];
}

export function contactDetail(contactId: string): ContactDetailEntry {
  const entry = records.contactDetails[contactId];
  if (entry) return entry;
  const contact = contactById(contactId);
  return {
    roleOnDeal: contact.title,
    dealRoleShort: contact.title,
    prefers: "Email",
    metThrough: "—",
    history: [],
  };
}

/** The open deal at a contact's company, if any (drives standings copy). */
export function dealForCompany(companyId: string): Deal | undefined {
  return deals.find((d) => d.companyId === companyId);
}

/** "Where things stand" for contacts without a screen-drawn override. */
export function standingPartsFor(contactId: string): RichPart[] {
  const detail = contactDetail(contactId);
  if (detail.standingParts) return detail.standingParts;
  const contact = contactById(contactId);
  const company = safeCompany(contact.companyId);
  const deal = dealForCompany(contact.companyId);
  const list = contactListEntry(contactId);
  const first = contact.name.split(" ")[0] ?? contact.name;
  if (!deal) {
    return [
      { kind: "text", text: `${first} is at ${company.name}. ` },
      { kind: "text", text: list ? `${list.relationshipNote}.` : "No open deal right now." },
    ];
  }
  const stage = stageById(deal.stageId);
  const parts: RichPart[] = [
    { kind: "text", text: `${first} is the ${detail.dealRoleShort.toLowerCase() === "decides" ? "decision maker" : detail.roleOnDeal.toLowerCase()} on ` },
    { kind: "link", text: `${company.name} · ${deal.name}`, href: `/app/deals/${deal.companyId}` },
    { kind: "text", text: " (" },
    { kind: "mono", text: moneyCompact(deal.value) },
    { kind: "text", text: `, ${stage.name}).` },
  ];
  if (list) parts.push({ kind: "text", text: ` Last touch ${list.lastTouchDate} — ${list.relationshipNote.charAt(0).toLowerCase()}${list.relationshipNote.slice(1)}.` });
  if (deal.nextStep) {
    parts.push({ kind: "text", text: ` Next: ${deal.nextStep.text.charAt(0).toLowerCase()}${deal.nextStep.text.slice(1)}, ` });
    parts.push({ kind: "bold", text: deal.nextStep.dueLabel });
    parts.push({ kind: "text", text: "." });
  }
  return parts;
}

/** Colleagues at the same company (R-03 "Also at …" / R-05 people rows).
 *  Foundation contacts order is the canon order (Jordan, Rachel, Marcus…). */
export function colleaguesOf(contactId: string): Contact[] {
  const contact = contactById(contactId);
  return contacts.filter((c) => c.companyId === contact.companyId && c.id !== contactId);
}

/* ---------- deal pages (R-01 + X-05) ---------- */

export interface DealPageEntry {
  nextStepSentence?: string;
  nextStepDueHeader?: string;
  nextStepWhy?: string;
  compositionNote?: string;
  activities: HistoryRow[];
  peopleSub?: Record<string, { sub: string; chipLabel?: string; chipTone?: Tone }>;
}

export function dealPage(dealId: string): DealPageEntry {
  return records.dealPages[dealId] ?? { activities: [] };
}

export interface DealPersonRow {
  contactId: string;
  role: string;
  sub: string;
  chipLabel?: string;
  chipTone?: Tone;
}

/** People rows on a deal page: fixture detail.people roles ("Decides"…)
 *  win; otherwise the company's contacts with their records role words. */
export function dealPeople(deal: Deal): DealPersonRow[] {
  const page = dealPage(deal.id);
  if (deal.detail?.people?.length) {
    return deal.detail.people.map((p) => {
      const sub = page.peopleSub?.[p.contactId];
      return {
        contactId: p.contactId,
        role: p.role,
        sub: sub?.sub ?? contactDetail(p.contactId).roleOnDeal,
        chipLabel: sub?.chipLabel,
        chipTone: sub?.chipTone,
      };
    });
  }
  return colleaguesOfCompany(deal.companyId).map((c) => ({
    contactId: c.id,
    role: contactDetail(c.id).dealRoleShort,
    sub: contactDetail(c.id).roleOnDeal,
  }));
}

export function colleaguesOfCompany(companyId: string): Contact[] {
  return contacts.filter((c) => c.companyId === companyId);
}

/* ---------- stale notice (X-05) ---------- */

export interface StaleNoticeEntry {
  label: string;
  headline: string;
  body: string;
  daysNoReply: number;
  meterFilled: number;
  meterTotal: number;
  draftLabel: string;
  askLabel: string;
  /** Drawn header suffix on the stale deal's page, e.g. "Proposal since Sep 20". */
  headerSuffix?: string;
}

export function staleHeaderSuffix(dealId: string): string | undefined {
  return records.staleNotice[dealId]?.headerSuffix;
}

export function staleNoticeFor(deal: Deal): StaleNoticeEntry {
  const entry = records.staleNotice[deal.id];
  if (entry) return entry;
  // Generic form for the ?state=stale dev toggle on a non-stale deal.
  const primary = dealPeople(deal)[0];
  const name = primary ? contactById(primary.contactId).name : "The contact";
  const owner = personById(deal.ownerId);
  return {
    label: `Stale · ${deal.daysInStage} days with no reply`,
    headline: `${name} hasn’t replied in ${deal.daysInStage} days.`,
    body: "This deal has passed its stage’s stale limit with no reply and no stage change. The follow-up task is overdue.",
    daysNoReply: deal.daysInStage,
    meterFilled: Math.min(deal.daysInStage, 21),
    meterTotal: 21,
    draftLabel: `Draft a follow-up to ${name.split(" ")[0] ?? name}`,
    askLabel: `Ask ${owner.firstName} for an update`,
  };
}

/* ---------- companies (R-04 / R-05) ---------- */

export interface CompanyListEntry {
  industryLine: string;
  healthLabel: string;
  healthTone: Tone;
  mgBg?: string;
  mgColor?: string;
}

export function companyListEntry(companyId: string): CompanyListEntry {
  return (
    records.companiesList[companyId] ?? {
      industryLine: "",
      healthLabel: "On track",
      healthTone: "on-track",
    }
  );
}

/** Companies in the drawn R-04 order (open value desc, customer last). */
export function companiesDrawnOrder(): string[] {
  return records.companiesListOrder;
}

export function openValueForCompany(companyId: string): number {
  return deals.filter((d) => d.companyId === companyId).reduce((s, d) => s + d.value, 0);
}

export interface CompanyDetailEntry {
  website: string;
  industryFull: string;
  sizeShort: string;
  sizeLong: string;
  city?: string;
  firstContact: string;
  healthKv: string;
  healthKvTone: Tone;
  healthNote: string;
  oneLineTone: Tone;
  oneLineParts?: RichPart[];
}

export function companyDetail(companyId: string): CompanyDetailEntry {
  const entry = records.companyDetails[companyId];
  if (entry) return entry;
  const list = companyListEntry(companyId);
  return {
    website: "—",
    industryFull: list.industryLine,
    sizeShort: "",
    sizeLong: "",
    firstContact: "—",
    healthKv: list.healthLabel,
    healthKvTone: list.healthTone,
    healthNote: "",
    oneLineTone: list.healthTone,
  };
}

/** One-line account summary for companies without a drawn override. */
export function companyOneLineParts(companyId: string): RichPart[] {
  const detail = companyDetail(companyId);
  if (detail.oneLineParts) return detail.oneLineParts;
  const company = companyById(companyId);
  const companyDeals = deals.filter((d) => d.companyId === companyId);
  const people = colleaguesOfCompany(companyId);
  if (companyDeals.length === 0) {
    return [
      { kind: "text", text: `${company.name} is a customer with no open deal. ` },
      { kind: "text", text: detail.healthKv.replace(/ · .*/, "") + "." },
    ];
  }
  const deal = companyDeals[0]!;
  const stage = stageById(deal.stageId);
  const decider = people[0];
  const parts: RichPart[] = [
    { kind: "text", text: `${companyDeals.length === 1 ? "One open deal" : `${companyDeals.length} open deals`} worth ` },
    { kind: "mono", text: moneyCompact(openValueForCompany(companyId)) },
    { kind: "text", text: ` in ${stage.name}` },
  ];
  if (deal.stale) parts.push({ kind: "text", text: `, stale for ${deal.daysInStage} days with no reply` });
  else if (!deal.nextStep) parts.push({ kind: "text", text: ", with no next step set" });
  else parts.push({ kind: "text", text: `, next step ${deal.nextStep.dueLabel}` });
  parts.push({ kind: "text", text: "." });
  if (decider) {
    parts.push({ kind: "text", text: ` ${people.length} ${people.length === 1 ? "person" : "people"} involved, ${decider.name} decides.` });
  }
  return parts;
}

/** Last-touch date for a person row on R-05 (screen-drawn for Bracken). */
export function companyPersonDate(companyId: string, contactId: string): string {
  return (
    records.companyPeopleDates[companyId]?.[contactId] ??
    contactListEntry(contactId)?.lastTouchDate ??
    ""
  );
}

/** Company display data that never throws: the canon 12th contact (Ines
 *  Moreau) sits at Halden Outdoor, which has no foundation company row —
 *  its name/monogram are drawn on Contacts.html and kept in records.json. */
export interface SafeCompany {
  id: string;
  name: string;
  initials: string;
  mgBg: string;
  mgColor: string;
  exists: boolean;
}

export function safeCompany(companyId: string): SafeCompany {
  try {
    const c = companyById(companyId);
    return { id: c.id, name: c.name, initials: c.initials, mgBg: c.mgBg, mgColor: c.mgColor, exists: true };
  } catch {
    const extra = records.extraCompanies[companyId];
    return {
      id: companyId,
      name: extra?.name ?? companyId,
      initials: extra?.initials ?? "??",
      mgBg: extra?.mgBg ?? "#F1EEE6",
      mgColor: extra?.mgColor ?? "#17201E",
      exists: false,
    };
  }
}

export function dealByCompanySlug(slug: string): Deal | undefined {
  return deals.find((d) => d.companyId === slug);
}

export function contactBySlug(slug: string): Contact | undefined {
  try {
    return contactById(slug);
  } catch {
    return undefined;
  }
}

export function companyBySlug(slug: string) {
  try {
    return companyById(slug);
  } catch {
    return undefined;
  }
}

export { dealById };
