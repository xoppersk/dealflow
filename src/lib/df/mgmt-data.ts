/**
 * Management-group screen data (M-01…M-05 + audit).
 *
 * Production split (W3): the COPY constants below are interface copy (ledes,
 * labels, rule text — the screens' own words, formerly in data/mgmt.json)
 * and stay static. Every FIGURE is computed from the real workspace
 * Dataset by the build* functions — no fixture numbers remain.
 */
import { isOpenDeal, openTotal, weightedTotal } from "./api";
import { dateLabel, moneyCompact } from "./format";
import type { AuditEntry, Dataset } from "./types";

export type { AuditEntry };

export interface ReportOwnerRow {
  personId: string;
  won: number;
  calls: number;
  stuck?: string;
}

export interface DuplicateRow {
  id: string;
  fromName: string;
  fromNote: string;
  matchVerb: string;
  matchName: string;
  matchNote: string;
  matchCompanyId: string;
  defaultChoice: "merge" | "keep";
}

/* ---------------- copy constants (interface copy, not user data) ---------------- */

export const reportsCopy = {
  periods: ["This month", "This quarter", "Last 12 months"],
  defaultPeriod: "This quarter",
};

export const workspaceCopy = {
  currency: "US dollar",
  currencyNote: "Card values round to the nearest $0.5K; detail shows the full amount.",
  quartersStart: "January",
  nextStepRuleNote: "With a date. Deals without one show “No next step” in red.",
  staleUnit: "days with no reply or stage change",
  wonRules: [
    "Blocked while a next step is marked “blocks the contract”",
    "Ask for the signed date and final value",
  ],
  exportLabel: "Download all deals, contacts and activity",
};

export const stagesScreenCopy = {
  lede: "Four open stages, then Won or Lost. What a deal needs to enter each one, and when it counts as stale.",
  closedLine: "Won needs a signed date and final value. Lost needs a reason from the list.",
  definition:
    "Win chance is the share of deals that reached Won after entering the stage, over the last 12 months. You can override it, and the forecast then says “manual”.",
};

export const teamScreenCopy = {
  roleOptions: ["Rep", "Manager", "Admin"],
  roles: [
    { name: "Rep", desc: "own deals, log activity, see the whole board" },
    { name: "Manager", desc: "also reassign deals and see Reports" },
    { name: "Admin", desc: "also stages, settings, team and imports" },
  ],
};

export const importCopy = {
  title: "Import contacts",
  steps: ["1 · Upload", "2 · Match columns", "3 · Check", "4 · Import"],
  duplicatesTitle: "Possible duplicates",
  cantImportTitle: "Can’t import",
  doneTitle: "Import complete",
};

/* ---------------- reports (M-01), computed ---------------- */

export type ReportPeriod = "This month" | "This quarter" | "Last 12 months";

export function periodWindow(period: string, now: Date = new Date()): { start: Date; label: string } {
  if (period === "This month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, label: `${dateLabel(start)} – ${dateLabel(now)}` };
  }
  if (period === "Last 12 months") {
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);
    return { start, label: `${dateLabel(start)} – ${dateLabel(now)}` };
  }
  const qMonth = Math.floor(now.getMonth() / 3) * 3;
  const start = new Date(now.getFullYear(), qMonth, 1);
  return { start, label: `Quarter to date, ${dateLabel(start)} – ${dateLabel(now)}` };
}

export interface ReportsData {
  lede: string;
  periods: string[];
  defaultPeriod: string;
  headline: { label: string; value: string; unit?: string; note: string; accent?: boolean }[];
  stageBarsNote: string;
  daysNote: string;
  daysBarHeightsPct: number[];
  byOwner: ReportOwnerRow[];
  teamTotal: { open: number; value: string; won: number; calls: number };
}

export function buildReports(ds: Dataset, period: string = reportsCopy.defaultPeriod): ReportsData {
  const now = new Date();
  const { start, label } = periodWindow(period, now);
  const inWindow = (iso?: string) => (iso ? new Date(iso).getTime() >= start.getTime() : false);

  const open = ds.deals.filter(isOpenDeal);
  const closedInWindow = ds.deals.filter(
    (d) => (d.stageId === "won" || d.stageId === "lost") && inWindow(d.closedAt ?? d.createdAt),
  );
  const wonInWindow = closedInWindow.filter((d) => d.stageId === "won");
  const daysToClose = wonInWindow
    .map((d) =>
      d.closedAt && d.createdAt
        ? Math.max(0, Math.round((new Date(d.closedAt).getTime() - new Date(d.createdAt).getTime()) / 86_400_000))
        : 0,
    )
    .sort((a, b) => a - b);
  const avgDays = daysToClose.length
    ? Math.round(daysToClose.reduce((s, n) => s + n, 0) / daysToClose.length)
    : 0;
  const winRate = closedInWindow.length
    ? Math.round((wonInWindow.length / closedInWindow.length) * 100)
    : 0;
  const callsInWindow = ds.activities.filter((a) => a.type === "Call" && inWindow(a.occurredAt));

  const byOwner: ReportOwnerRow[] = ds.team.map((p) => {
    const stuckCount = open.filter((d) => d.ownerId === p.id && d.stale).length;
    return {
      personId: p.id,
      won: wonInWindow.filter((d) => d.ownerId === p.id).length,
      calls: ds.activities.filter((a) => a.type === "Call" && a.ownerId === p.id && inWindow(a.occurredAt)).length,
      stuck: stuckCount > 0 ? `${stuckCount} stuck` : undefined,
    };
  });

  const maxDays = daysToClose.length ? Math.max(...daysToClose) : 0;

  return {
    lede: `${label}. Every number says how it’s counted.`,
    periods: reportsCopy.periods,
    defaultPeriod: reportsCopy.defaultPeriod,
    headline: [
      {
        label: "Open pipeline",
        value: moneyCompact(openTotal(ds.deals)),
        note: `${open.length} deals, any stage before Won`,
      },
      {
        label: "Weighted forecast",
        value: moneyCompact(Math.round(weightedTotal(ds.deals, ds.stages))),
        note: "Each deal × its stage’s win chance",
        accent: true,
      },
      {
        label: "Win rate",
        value: `${winRate}%`,
        note: `${wonInWindow.length} won of ${closedInWindow.length} closed in this period`,
      },
      {
        label: "Time to win",
        value: daysToClose.length ? String(avgDays) : "—",
        unit: daysToClose.length ? " days" : undefined,
        note: `Average for the ${wonInWindow.length} won, first touch to signed`,
      },
    ],
    stageBarsNote:
      open.length === 0
        ? "No open deals yet — the stage bars fill in as deals are added."
        : "Bars show open value per stage right now; win chances come from each stage’s setting.",
    daysNote: daysToClose.length
      ? `Fastest ${daysToClose[0]} days, slowest ${daysToClose[daysToClose.length - 1]}.`
      : "No won deals in this period yet.",
    daysBarHeightsPct: daysToClose.map((d) => (maxDays > 0 ? Math.round((d / maxDays) * 100) : 0)),
    byOwner,
    teamTotal: {
      open: open.length,
      value: moneyCompact(openTotal(ds.deals)),
      won: wonInWindow.length,
      calls: callsInWindow.length,
    },
  };
}

/* ---------------- workspace settings (M-02), computed ---------------- */

export interface WorkspaceScreenData {
  lede: string;
  name: string;
  currency: string;
  currencyNote: string;
  quartersStart: string;
  nextStepRuleNote: string;
  nextStepRuleState: string;
  staleSavedDays: number;
  staleDraftDays: number;
  staleUnit: string;
  staleConsequence: string;
  wonRules: string[];
  connected: { kind: string; name: string; note?: string; noteBefore?: string; noteWatch?: string }[];
  exportLabel: string;
}

export function buildWorkspace(ds: Dataset): WorkspaceScreenData {
  const noStep = ds.deals.filter((d) => isOpenDeal(d) && !d.nextStep);
  const stale = ds.deals.find((d) => d.stale);
  const staleCompany = stale ? ds.companies.find((c) => c.id === stale.companyId) : undefined;
  return {
    lede: `Rules every deal in ${ds.settings.workspaceName} · ${ds.settings.workspaceScope} follows.`,
    name: `${ds.settings.workspaceName} · ${ds.settings.workspaceScope}`,
    currency: workspaceCopy.currency,
    currencyNote: workspaceCopy.currencyNote,
    quartersStart: workspaceCopy.quartersStart,
    nextStepRuleNote: workspaceCopy.nextStepRuleNote,
    nextStepRuleState:
      noStep.length === 0
        ? "On · every open deal has a next step today"
        : `On · ${noStep.length} deal${noStep.length === 1 ? " breaks" : "s break"} this today`,
    staleSavedDays: ds.settings.staleLimitDays,
    staleDraftDays: ds.settings.staleLimitPendingDays,
    staleUnit: workspaceCopy.staleUnit,
    staleConsequence: stale
      ? `After saving, ${staleCompany?.name ?? "a deal"} (${stale.daysInStage} days) shows as stale. Stage-level limits in Pipeline stages still win.`
      : "Stage-level limits in Pipeline stages still win.",
    wonRules: workspaceCopy.wonRules,
    connected: [
      {
        kind: "calendar",
        name: "Google Calendar",
        note: `Connected for ${ds.team.length} ${ds.team.length === 1 ? "person" : "people"} · meetings with contacts log themselves`,
      },
      {
        kind: "mail",
        name: "Gmail",
        note: `Connected for ${ds.team.length} ${ds.team.length === 1 ? "person" : "people"}`,
      },
    ],
    exportLabel: workspaceCopy.exportLabel,
  };
}

/* ---------------- stages screen (M-03), computed ---------------- */

export interface StagesScreenData {
  lede: string;
  staleDisplay: Record<string, string>;
  proposalStaleSavedDays: number;
  proposalStaleDraftDays: number;
  ifYouSave: string[];
  closedLine: string;
  definition: string;
}

export function buildStagesScreen(ds: Dataset): StagesScreenData {
  const proposal = ds.stages.find((s) => s.id === "proposal");
  const staleDisplay: Record<string, string> = {};
  for (const s of ds.stages) staleDisplay[s.id] = `${s.staleLimitDays} days`;
  const staleDeal = ds.deals.find((d) => d.stale);
  const staleCompany = staleDeal ? ds.companies.find((c) => c.id === staleDeal.companyId) : undefined;
  return {
    lede: stagesScreenCopy.lede,
    staleDisplay,
    proposalStaleSavedDays: proposal?.staleLimitDays ?? 10,
    proposalStaleDraftDays: proposal?.staleLimitDays ?? 10,
    ifYouSave: [
      `Proposal deals go stale after ${proposal?.staleLimitDays ?? 10} days.`,
      staleDeal
        ? `${staleCompany?.name ?? "A deal"} stays stale (${staleDeal.daysInStage} days).`
        : "No deal is stale right now.",
      "Owners get one email when a deal turns stale.",
    ],
    closedLine: stagesScreenCopy.closedLine,
    definition: stagesScreenCopy.definition,
  };
}

/* ---------------- team screen (M-04), computed ---------------- */

export interface TeamScreenData {
  lede: string;
  emails: Record<string, string>;
  lastActive: Record<string, string>;
  invite: { email: string; note: string; role: string; status: string };
  roleOptions: string[];
  roles: { name: string; desc: string }[];
  seatsLabel: string;
  seatSegments: number;
  seatInviteIndex: number;
}

export function buildTeamScreen(ds: Dataset): TeamScreenData {
  const emails: Record<string, string> = {};
  const lastActive: Record<string, string> = {};
  for (const p of ds.team) {
    emails[p.id] = p.email;
    // No presence/last-active source in the DB — only the signed-in user
    // is honestly "Now"; everyone else shows no claim.
    lastActive[p.id] = p.you ? "Now" : "—";
  }
  const invite = ds.invites[0];
  return {
    lede: `${ds.team.length} ${ds.team.length === 1 ? "person" : "people"}, ${ds.invites.length} invite${ds.invites.length === 1 ? "" : "s"}. Removing someone asks who takes their deals first.`,
    emails,
    lastActive,
    invite: invite
      ? {
          email: invite.email,
          note: `Invited ${dateLabel(invite.createdAt)} · expires ${dateLabel(invite.expiresAt)}`,
          role: invite.role,
          status: "Not joined",
        }
      : { email: "", note: "", role: "Rep", status: "" },
    roleOptions: teamScreenCopy.roleOptions,
    roles: teamScreenCopy.roles,
    seatsLabel: `Seats: ${ds.team.length + ds.invites.length} used, counting ${ds.invites.length} invite${ds.invites.length === 1 ? "" : "s"}.`,
    seatSegments: Math.max(ds.team.length + ds.invites.length, 1),
    seatInviteIndex: ds.invites.length ? ds.team.length : -1,
  };
}

/* ---------------- audit (computed from audit_log rows) ---------------- */

export function buildAuditEntries(ds: Dataset): AuditEntry[] {
  return ds.audit;
}
