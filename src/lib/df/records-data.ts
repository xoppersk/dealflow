/**
 * Records-group view models (R-01…R-05, X-05) — COMPUTED from the real
 * workspace Dataset (src/lib/df/db.ts). The fixture era read these words
 * from data/records.json; production computes the same formulaic copy from
 * real rows: relationship/health/standing derive from open value, last
 * touch (activities), stage names and stale state, using the fixtures'
 * own words. Every function takes the dataset as its first argument.
 */
import {
  companyByIdSafe,
  contactByIdSafe,
  dealById,
  isOpenDeal,
  personByIdSafe,
  stageByIdSafe,
} from "./api";
import { dateLabel, moneyCompact, wholeDays } from "./format";
import type { Activity, Contact, Dataset, Deal } from "./types";

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

/* ---------- shared computations ---------- */

function openDealsAtCompany(ds: Dataset, companyId: string): Deal[] {
  return ds.deals.filter((d) => d.companyId === companyId && isOpenDeal(d));
}

function dealsLinkedToContact(ds: Dataset, contact: Contact): Deal[] {
  return ds.deals.filter(
    (d) =>
      d.detail?.people.some((p) => p.contactId === contact.id) ||
      (d.companyId === contact.companyId && Boolean(contact.companyId)),
  );
}

/** Activities that touch a contact: directly, or on a deal they're on. */
function activitiesForContact(ds: Dataset, contact: Contact): Activity[] {
  const dealIds = new Set(dealsLinkedToContact(ds, contact).map((d) => d.id));
  return ds.activities.filter(
    (a) => a.contactId === contact.id || (a.dealId ? dealIds.has(a.dealId) : false),
  );
}

function activitiesForDeal(ds: Dataset, dealId: string): Activity[] {
  return ds.activities.filter((a) => a.dealId === dealId);
}

function lastTouchForContact(ds: Dataset, contact: Contact): Activity | undefined {
  return activitiesForContact(ds, contact)[0];
}

function ownerIdForContact(ds: Dataset, contact: Contact): string {
  const deal = dealsLinkedToContact(ds, contact).find((d) => isOpenDeal(d)) ?? dealsLinkedToContact(ds, contact)[0];
  return contact.ownerId ?? deal?.ownerId ?? ds.currentUserId;
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

export function contactListEntry(ds: Dataset, contactId: string): ContactListEntry | undefined {
  const contact = contactByIdSafe(ds.contacts, contactId);
  if (!contact) return undefined;
  const company = contact.companyId ? companyByIdSafe(ds.companies, contact.companyId) : undefined;
  const linked = dealsLinkedToContact(ds, contact);
  const openLinked = linked.filter(isOpenDeal);
  const openValue = openLinked.length
    ? openLinked.reduce((s, d) => s + d.value, 0)
    : null;
  const touches = activitiesForContact(ds, contact);
  const last = touches[0];
  const lastTouchDate = last ? last.dayLabel : "";
  const deal = openLinked[0];
  const staleDeal = openLinked.find((d) => d.stale);
  const noStepDeal = openLinked.find((d) => !d.nextStep);

  let relationshipLabel: string;
  let relationshipTone: Tone;
  let relationshipNote: string;
  if (contact.customer || company?.customer) {
    relationshipLabel = "Strong";
    relationshipTone = "strong";
    relationshipNote = "Customer";
  } else if (staleDeal) {
    relationshipLabel = "Cooling";
    relationshipTone = "cooling";
    relationshipNote = `No reply in ${staleDeal.daysInStage} days`;
  } else if (contact.newLead) {
    relationshipLabel = "New";
    relationshipTone = "new";
    relationshipNote = contact.metThrough ? `Via ${contact.metThrough}` : "New lead";
  } else if (touches.length >= 5) {
    relationshipLabel = "Strong";
    relationshipTone = "strong";
    relationshipNote = `${touches.length} touches in 30 days`;
  } else if (noStepDeal && touches.length === 0) {
    relationshipLabel = "Cooling";
    relationshipTone = "cooling";
    relationshipNote = "No contact yet";
  } else {
    relationshipLabel = "Good";
    relationshipTone = "good";
    relationshipNote = last?.detail ?? deal?.nextStep?.text ?? "In touch";
  }

  let lastTouchFlag: string | undefined;
  let lastTouchFlagTone: Tone | undefined;
  if (staleDeal) {
    lastTouchFlag = "Stale";
    lastTouchFlagTone = "watch";
  } else if (noStepDeal && deal) {
    lastTouchFlag = "No next step";
    lastTouchFlagTone = "act";
  } else if (contact.newLead) {
    lastTouchFlag = "New lead";
    lastTouchFlagTone = "ok";
  } else if (deal?.nextStep) {
    lastTouchFlag = `Follow-up ${deal.nextStep.dueLabel.split(", ")[0] ?? ""}`.trim();
    lastTouchFlagTone = "watch";
  }

  return {
    relationshipLabel,
    relationshipTone,
    relationshipNote,
    lastTouchDate: lastTouchDate || (contact.createdAt ? dateLabel(contact.createdAt) : ""),
    lastTouchFlag,
    lastTouchFlagTone,
    openValue,
    ownerId: ownerIdForContact(ds, contact),
    cooling: relationshipTone === "cooling",
  };
}

/** Contacts on open deals (linked via deal_contacts or their company). */
export function contactsOnOpenDeals(ds: Dataset): Contact[] {
  return ds.contacts.filter((c) => dealsLinkedToContact(ds, c).some(isOpenDeal));
}

export function contactsEveryone(ds: Dataset): Contact[] {
  return [...ds.contacts];
}

export function contactsCustomers(ds: Dataset): Contact[] {
  return ds.contacts.filter((c) => c.customer);
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

function historyRows(_ds: Dataset, acts: Activity[]): HistoryRow[] {
  return acts.map((a) => ({
    date: a.dayLabel === "Today" || a.dayLabel === "Yesterday" ? a.dayLabel : a.dayLabel,
    ownerId: a.ownerId,
    title: a.type,
    subject: a.subject,
    detail: a.detail ?? "",
    act: a.overdueDays !== undefined,
  }));
}

export function contactDetail(ds: Dataset, contactId: string): ContactDetailEntry {
  const contact = contactByIdSafe(ds.contacts, contactId);
  if (!contact) {
    return { roleOnDeal: "", dealRoleShort: "", prefers: "Email", metThrough: "—", history: [] };
  }
  const deal = dealsLinkedToContact(ds, contact).find((d) => isOpenDeal(d)) ?? dealsLinkedToContact(ds, contact)[0];
  const roleOnDeal =
    deal?.detail?.people.find((p) => p.contactId === contactId)?.role ?? contact.title ?? "";
  return {
    phone: contact.phone || undefined,
    roleOnDeal,
    dealRoleShort: roleOnDeal,
    prefers: contact.prefers ?? "Email",
    metThrough: contact.metThrough ?? "—",
    history: historyRows(ds, activitiesForContact(ds, contact)),
  };
}

/** The open deal at a contact's company, if any (drives standings copy). */
export function dealForCompany(ds: Dataset, companyId: string): Deal | undefined {
  return openDealsAtCompany(ds, companyId)[0] ?? ds.deals.find((d) => d.companyId === companyId);
}

/** "Where things stand" — computed standing copy. */
export function standingPartsFor(ds: Dataset, contactId: string): RichPart[] {
  const contact = contactByIdSafe(ds.contacts, contactId);
  if (!contact) return [];
  const detail = contactDetail(ds, contactId);
  const company = safeCompany(ds, contact.companyId);
  const deal = dealForCompany(ds, contact.companyId);
  const list = contactListEntry(ds, contactId);
  const first = contact.name.split(" ")[0] ?? contact.name;
  if (!deal) {
    return [
      { kind: "text", text: `${first} is at ${company.name}. ` },
      { kind: "text", text: list ? `${list.relationshipNote}.` : "No open deal right now." },
    ];
  }
  const stage = stageByIdSafe(ds.stages, deal.stageId);
  const parts: RichPart[] = [
    {
      kind: "text",
      text: `${first} is the ${/decid/i.test(detail.dealRoleShort) ? "decision maker" : detail.roleOnDeal.toLowerCase()} on `,
    },
    { kind: "link", text: `${company.name} · ${deal.name}`, href: `/app/deals/${deal.companyId}` },
    { kind: "text", text: " (" },
    { kind: "mono", text: moneyCompact(deal.value) },
    { kind: "text", text: `, ${stage?.name ?? deal.stageId}).` },
  ];
  if (list) {
    parts.push({
      kind: "text",
      text: ` Last touch ${list.lastTouchDate} — ${list.relationshipNote.charAt(0).toLowerCase()}${list.relationshipNote.slice(1)}.`,
    });
  }
  if (deal.nextStep) {
    parts.push({ kind: "text", text: ` Next: ${deal.nextStep.text.charAt(0).toLowerCase()}${deal.nextStep.text.slice(1)}, ` });
    parts.push({ kind: "bold", text: deal.nextStep.dueLabel });
    parts.push({ kind: "text", text: "." });
  }
  return parts;
}

/** Colleagues at the same company (R-03 "Also at …" / R-05 people rows). */
export function colleaguesOf(ds: Dataset, contactId: string): Contact[] {
  const contact = contactByIdSafe(ds.contacts, contactId);
  if (!contact) return [];
  return ds.contacts.filter((c) => c.companyId === contact.companyId && c.id !== contactId);
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

export function dealPage(ds: Dataset, dealId: string): DealPageEntry {
  const deal = dealById(ds.deals, dealId);
  const acts = activitiesForDeal(ds, dealId);
  const entry: DealPageEntry = {
    activities: acts.map((a) => ({
      date: a.dayLabel,
      ownerId: a.ownerId,
      title: a.type,
      subject: a.subject,
      detail: a.detail ?? "",
      act: a.overdueDays !== undefined,
    })),
  };
  if (deal?.nextStep) {
    entry.nextStepSentence = deal.nextStep.text;
    entry.nextStepDueHeader = deal.nextStep.dueLabel.startsWith("Due")
      ? deal.nextStep.dueLabel
      : `Due ${deal.nextStep.dueLabel}`;
  }
  return entry;
}

export interface DealPersonRow {
  contactId: string;
  role: string;
  sub: string;
  chipLabel?: string;
  chipTone?: Tone;
}

/** People rows on a deal page: deal_contacts roles win; otherwise the
 *  company's contacts with their title as the role word. */
export function dealPeople(ds: Dataset, deal: Deal): DealPersonRow[] {
  if (deal.detail?.people?.length) {
    return deal.detail.people.map((p) => ({
      contactId: p.contactId,
      role: p.role,
      sub: contactDetail(ds, p.contactId).roleOnDeal,
    }));
  }
  return colleaguesOfCompany(ds, deal.companyId).map((c) => ({
    contactId: c.id,
    role: c.title,
    sub: c.title,
  }));
}

export function colleaguesOfCompany(ds: Dataset, companyId: string): Contact[] {
  return ds.contacts.filter((c) => c.companyId === companyId);
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

export function staleHeaderSuffix(ds: Dataset, dealId: string): string | undefined {
  const deal = dealById(ds.deals, dealId);
  if (!deal?.stale) return undefined;
  const stage = stageByIdSafe(ds.stages, deal.stageId);
  return stage ? `${stage.name} · stale ${deal.daysInStage} days` : undefined;
}

export function staleNoticeFor(ds: Dataset, deal: Deal): StaleNoticeEntry {
  const primary = dealPeople(ds, deal)[0];
  const name = primary ? (contactByIdSafe(ds.contacts, primary.contactId)?.name ?? "The contact") : "The contact";
  const owner = personByIdSafe(ds.team, deal.ownerId);
  const stage = stageByIdSafe(ds.stages, deal.stageId);
  const limit = stage?.staleLimitDays ?? 21;
  return {
    label: `Stale · ${deal.daysInStage} days with no reply`,
    headline: `${name} hasn’t replied in ${deal.daysInStage} days.`,
    body: "This deal has passed its stage’s stale limit with no reply and no stage change. The follow-up task is overdue.",
    daysNoReply: deal.daysInStage,
    meterFilled: Math.min(deal.daysInStage, limit),
    meterTotal: limit,
    draftLabel: `Draft a follow-up to ${name.split(" ")[0] ?? name}`,
    askLabel: `Ask ${owner?.firstName ?? "the owner"} for an update`,
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

function healthForCompany(ds: Dataset, companyId: string): { label: string; tone: Tone } {
  const company = companyByIdSafe(ds.companies, companyId);
  const open = openDealsAtCompany(ds, companyId);
  if (open.length === 0) {
    if (company?.customer) return { label: "Customer", tone: "neutral" };
    return { label: "On track", tone: "on-track" };
  }
  if (open.some((d) => !d.nextStep)) return { label: "At risk · no next step", tone: "act" };
  const stale = open.find((d) => d.stale);
  if (stale) return { label: `Watch · stale ${stale.daysInStage} days`, tone: "watch" };
  const blocking = open.find((d) => d.nextStep?.blocks);
  if (blocking) return { label: "Watch · next step blocks the contract", tone: "watch" };
  return { label: "On track", tone: "on-track" };
}

export function companyListEntry(ds: Dataset, companyId: string): CompanyListEntry {
  const company = companyByIdSafe(ds.companies, companyId);
  const health = healthForCompany(ds, companyId);
  const industryLine = [company?.industry, company?.sizeLabel].filter(Boolean).join(" · ");
  return { industryLine, healthLabel: health.label, healthTone: health.tone };
}

/** Companies in list order: open value desc, customers (no open deals) last. */
export function companiesDrawnOrder(ds: Dataset): string[] {
  return [...ds.companies]
    .sort((a, b) => {
      const av = openValueForCompany(ds, a.id);
      const bv = openValueForCompany(ds, b.id);
      if (av !== bv) return bv - av;
      if (Boolean(a.customer) !== Boolean(b.customer)) return a.customer ? 1 : -1;
      return a.name.localeCompare(b.name);
    })
    .map((c) => c.id);
}

export function openValueForCompany(ds: Dataset, companyId: string): number {
  return openDealsAtCompany(ds, companyId).reduce((s, d) => s + d.value, 0);
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

const HEALTH_NOTE =
  "Health is “On track” when the open deal has a next step with a future date and a reply inside the stage limit, “Watch” when it is stale or blocked, and “At risk” when it has no next step.";

export function companyDetail(ds: Dataset, companyId: string): CompanyDetailEntry {
  const company = companyByIdSafe(ds.companies, companyId);
  const list = companyListEntry(ds, companyId);
  const firstDeal = [...ds.deals]
    .filter((d) => d.companyId === companyId)
    .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))[0];
  return {
    website: company?.website ?? "—",
    industryFull: company?.industry ?? list.industryLine,
    sizeShort: company?.sizeLabel ?? "",
    sizeLong: company?.sizeLabel ?? "",
    city: company?.city,
    firstContact: firstDeal?.createdAt ? dateLabel(firstDeal.createdAt) : "—",
    healthKv: list.healthLabel,
    healthKvTone: list.healthTone,
    healthNote: HEALTH_NOTE,
    oneLineTone: list.healthTone,
  };
}

/** One-line account summary — computed from the company's real deals. */
export function companyOneLineParts(ds: Dataset, companyId: string): RichPart[] {
  const company = companyByIdSafe(ds.companies, companyId);
  if (!company) return [];
  const detail = companyDetail(ds, companyId);
  const companyDealsAll = ds.deals.filter((d) => d.companyId === companyId);
  const open = companyDealsAll.filter(isOpenDeal);
  const people = colleaguesOfCompany(ds, companyId);
  if (open.length === 0) {
    return [
      {
        kind: "text",
        text: company.customer
          ? `${company.name} is a customer with no open deal. `
          : `${company.name} has no open deal right now. `,
      },
      { kind: "text", text: detail.healthKv.replace(/ · .*/, "") + "." },
    ];
  }
  const deal = open[0]!;
  const stage = stageByIdSafe(ds.stages, deal.stageId);
  const decider =
    people.find((p) => deal.detail?.people.some((dp) => dp.contactId === p.id && /decid/i.test(dp.role))) ??
    people[0];
  const parts: RichPart[] = [
    { kind: "text", text: `${open.length === 1 ? "One open deal" : `${open.length} open deals`} worth ` },
    { kind: "mono", text: moneyCompact(openValueForCompany(ds, companyId)) },
    { kind: "text", text: ` in ${stage?.name ?? deal.stageId}` },
  ];
  if (deal.stale) parts.push({ kind: "text", text: `, stale for ${deal.daysInStage} days with no reply` });
  else if (!deal.nextStep) parts.push({ kind: "text", text: ", with no next step set" });
  else parts.push({ kind: "text", text: `, next step ${deal.nextStep.dueLabel}` });
  parts.push({ kind: "text", text: "." });
  if (decider) {
    parts.push({
      kind: "text",
      text: ` ${people.length} ${people.length === 1 ? "person" : "people"} involved, ${decider.name} decides.`,
    });
  }
  return parts;
}

/** Last-touch date for a person row on R-05. */
export function companyPersonDate(ds: Dataset, _companyId: string, contactId: string): string {
  const contact = contactByIdSafe(ds.contacts, contactId);
  if (!contact) return "";
  const last = lastTouchForContact(ds, contact);
  return last ? last.dayLabel : contactListEntry(ds, contactId)?.lastTouchDate ?? "";
}

/** Company display data that never throws (a contact may reference a
 *  company outside the workspace list — e.g. a null company_id). */
export interface SafeCompany {
  id: string;
  name: string;
  initials: string;
  mgBg: string;
  mgColor: string;
  exists: boolean;
}

export function safeCompany(ds: Dataset, companyId: string): SafeCompany {
  const c = companyByIdSafe(ds.companies, companyId);
  if (c) return { id: c.id, name: c.name, initials: c.initials, mgBg: c.mgBg, mgColor: c.mgColor, exists: true };
  return { id: companyId, name: companyId || "No company", initials: "??", mgBg: "#F1EEE6", mgColor: "#17201E", exists: false };
}

export function dealByCompanySlug(ds: Dataset, slug: string): Deal | undefined {
  return (
    ds.deals.find((d) => d.id === slug) ??
    ds.deals.find((d) => d.companyId === slug && isOpenDeal(d)) ??
    ds.deals.find((d) => d.companyId === slug)
  );
}

export function contactBySlug(ds: Dataset, slug: string): Contact | undefined {
  return contactByIdSafe(ds.contacts, slug);
}

export function companyBySlug(ds: Dataset, slug: string) {
  return companyByIdSafe(ds.companies, slug);
}

export { dealById };
export { wholeDays };
