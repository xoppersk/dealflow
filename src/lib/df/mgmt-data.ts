/**
 * Management-group screen data (M-01…M-05 + audit) — screen-drawn content
 * that is not part of the shared §9 canon fixtures, read from data/mgmt.json.
 * Pages must go through the api seam (src/lib/df/api.ts) for canon figures
 * (team, stages, deals, closed) and through this module for the copy and
 * figures only the Management screens draw.
 */
import mgmtJson from "../../../data/mgmt.json";

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

export interface AuditEntry {
  id: string;
  type: string;
  subject: string;
  detail?: string;
  timeLabel: string;
  dayLabel: string;
  ownerId: string;
}

interface MgmtData {
  reports: {
    lede: string;
    periods: string[];
    defaultPeriod: string;
    headline: { label: string; value: string; unit?: string; note: string; accent?: boolean }[];
    stageBarsNote: string;
    daysNote: string;
    daysBarHeightsPct: number[];
    byOwner: ReportOwnerRow[];
    teamTotal: { open: number; value: string; won: number; calls: number };
  };
  workspace: {
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
  };
  stagesScreen: {
    lede: string;
    staleDisplay: Record<string, string>;
    proposalStaleSavedDays: number;
    proposalStaleDraftDays: number;
    ifYouSave: string[];
    closedLine: string;
    definition: string;
  };
  teamScreen: {
    lede: string;
    emails: Record<string, string>;
    lastActive: Record<string, string>;
    invite: { email: string; note: string; role: string; status: string };
    roleOptions: string[];
    roles: { name: string; desc: string }[];
    seatsLabel: string;
    seatSegments: number;
    seatInviteIndex: number;
  };
  importScreen: {
    title: string;
    file: string;
    rowsRead: number;
    ledeSuffix: string;
    counts: { label: string; value: number; note: string; act?: boolean }[];
    steps: string[];
    currentStep: number;
    duplicatesTitle: string;
    duplicatesShowing: string;
    duplicates: DuplicateRow[];
    cantImportTitle: string;
    cantImportNote: string;
    whenYouImport: string[];
    commitLabel: string;
    doneTitle: string;
    doneNote: string;
  };
  auditExtra: AuditEntry[];
}

export const mgmt = mgmtJson as unknown as MgmtData;

export const reportsData = mgmt.reports;
export const workspaceData = mgmt.workspace;
export const stagesScreenData = mgmt.stagesScreen;
export const teamScreenData = mgmt.teamScreen;
export const importScreenData = mgmt.importScreen;
export const auditExtra = mgmt.auditExtra;
