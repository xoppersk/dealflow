"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUser, isManagerOrAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { daysInStage, fullName } from "@/lib/format";
import { isStaleDeal, wholeDaysBetween, DEFAULT_STALE_THRESHOLD_DAYS } from "@/lib/domain/stale-deals";
import type { ActionResult, TimelineEntry } from "@/lib/types";

/**
 * NOTE on `db()`: the checked-in Database type is incompatible with
 * supabase-js 2.117's GenericTable for two reasons — its tables lack
 * `Relationships`, and its row types are `interface`s (interfaces lack the
 * implicit index signature `Row: Record<string, unknown>` requires). Table
 * queries therefore infer `never`. This local shim restores the intended
 * shape. The durable fix is regenerating src/lib/supabase/types.ts (or
 * switching row types to `type` aliases and adding `Relationships: []`
 * per table) — that un-breaks every agent's action files at once.
 */
type Tables = Database["public"]["Tables"];
type FixedDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: {
      [K in keyof Tables]: {
        // Mapped (not interface): interfaces lack implicit index signatures,
        // which GenericTable's `Row: Record<string, unknown>` requires.
        Row: { [P in keyof Tables[K]["Row"]]: Tables[K]["Row"][P] };
        Insert: Tables[K]["Insert"];
        Update: Tables[K]["Update"];
        Relationships: [];
      };
    };
  };
};

async function db(): Promise<SupabaseClient<FixedDatabase>> {
  return (await createClient()) as unknown as SupabaseClient<FixedDatabase>;
}

/**
 * Dashboard data (APP-FLOW.md §3 /, UI-DESIGN.md §2.3 — "Today" view).
 *
 * Answers "what do I need to do today?": stat cards, a needs-attention list
 * (overdue activities + stalled deals), and the latest team activities.
 * Managers/admins additionally get the team rollup.
 */

export interface StageCount {
  stageId: string;
  stageName: string;
  color: string;
  count: number;
}

export interface AttentionItem {
  kind: "overdue-activity" | "scheduled-activity" | "stalled-deal";
  id: string;
  title: string;
  /** Artifact ledger anatomy: the company / account the task belongs to. */
  context: string;
  /** ISO due date for activity rows (drives the time cell). */
  dueAt?: string | null;
  daysOverdue?: number;
  daysInStage?: number;
  stageName?: string;
  dealId: string | null;
  contactId?: string | null;
  activityId?: string;
  ownerName?: string;
  /** Linked deal value, for the task-ledger money column. */
  dealValue?: number | null;
  dealCurrency?: string;
}

/** One meeting on today's rail (artifact "Today's meetings"). */
export interface MeetingItem {
  id: string;
  startsAt: string;
  title: string;
  detail: string;
  dealId: string | null;
}

export interface RepRollup {
  userId: string;
  name: string;
  openDeals: number;
  pipelineValue: number;
  overdue: number;
}

export interface TeamRollup {
  teamPipelineValue: number;
  currency: string;
  perRep: RepRollup[];
  stalledDeals: AttentionItem[];
}

export interface DashboardStats {
  openPipelineValue: number;
  openDealsCount: number;
  currency: string;
  dealsByStage: StageCount[];
  overdueCount: number;
  /** Overdue + scheduled for today (artifact "Due today"). */
  dueTodayCount: number;
  /** Sum of distinct deal values across the due-next-steps ledger. */
  valueInMotion: number;
  valueInMotionDeals: number;
  meetingsCount: number;
  /** ISO start of the next meeting today, for the "Next at …" note. */
  nextMeetingAt: string | null;
  activitiesThisWeek: number;
}

export interface DashboardData {
  greetingName: string;
  isManager: boolean;
  hasAnyDeals: boolean;
  stats: DashboardStats;
  needsAttention: AttentionItem[];
  meetingsToday: MeetingItem[];
  recentActivity: TimelineEntry[];
  team?: TeamRollup;
}

interface OpenDeal {
  id: string;
  name: string;
  value: number;
  currency: string;
  stage_id: string;
  owner_id: string;
  company_id: string | null;
  stage_entered_at: string;
  last_touched_at: string;
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

export async function getDashboardData(): Promise<ActionResult<DashboardData>> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "Not signed in" };
  const supabase = await db();
  const isManager = isManagerOrAdmin(session.profile.role);
  const greetingName = session.profile.full_name.split(" ")[0] || session.profile.full_name;
  const now = new Date();
  const nowIso = now.toISOString();
  const weekAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("id,name,position,color")
    .order("position");
  const stageById = new Map((stages ?? []).map((s) => [s.id, s]));

  // ---- My open deals -------------------------------------------------------
  const { data: myDealRows } = await supabase
    .from("deals")
    .select("id,name,value,currency,stage_id,owner_id,company_id,stage_entered_at,last_touched_at")
    .eq("owner_id", session.id)
    .is("deleted_at", null)
    .is("closed_at", null)
    .order("last_touched_at", { ascending: false });
  const myDeals: OpenDeal[] = myDealRows ?? [];

  const openPipelineValue = myDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0);
  const currency = mostCommon(myDeals.map((d) => d.currency)) ?? "USD";
  const dealsByStage: StageCount[] = (stages ?? []).map((s) => ({
    stageId: s.id,
    stageName: s.name,
    color: s.color,
    count: myDeals.filter((d) => d.stage_id === s.id).length,
  }));

  const companyIds = [...new Set(myDeals.map((d) => d.company_id).filter((id): id is string => id !== null))];
  const { data: companyRows } = companyIds.length > 0
    ? await supabase.from("companies").select("id,name").in("id", companyIds)
    : { data: [] as { id: string; name: string }[] };
  const companyById = new Map((companyRows ?? []).map((c) => [c.id, c.name]));

  // ---- Overdue follow-ups (mine) -------------------------------------------
  const { data: overdueRows } = await supabase
    .from("activities")
    .select("id,type,subject,body,due_at,deal_id,contact_id")
    .eq("owner_id", session.id)
    .eq("is_follow_up", true)
    .lt("due_at", nowIso)
    .is("completed_at", null)
    .order("due_at", { ascending: true })
    .limit(12);

  // ---- Scheduled follow-ups (mine): today and upcoming ----------------------
  const { data: scheduledRows } = await supabase
    .from("activities")
    .select("id,type,subject,body,due_at,deal_id,contact_id")
    .eq("owner_id", session.id)
    .eq("is_follow_up", true)
    .gte("due_at", nowIso)
    .is("completed_at", null)
    .order("due_at", { ascending: true })
    .limit(12);

  // ---- Today's meetings (mine) ----------------------------------------------
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const { data: meetingRows } = await supabase
    .from("activities")
    .select("id,subject,body,due_at,occurred_at,deal_id,contact_id")
    .eq("owner_id", session.id)
    .eq("type", "meeting")
    .is("completed_at", null)
    .gte("due_at", startOfToday.toISOString())
    .lt("due_at", endOfToday.toISOString())
    .order("due_at", { ascending: true })
    .limit(10);

  const linkedDealIds = [
    ...new Set(
      [...(overdueRows ?? []), ...(scheduledRows ?? []), ...(meetingRows ?? [])]
        .map((r) => r.deal_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const { data: linkedDealRows } = linkedDealIds.length > 0
    ? await supabase.from("deals").select("id,name,value,currency,company_id").in("id", linkedDealIds)
    : { data: [] as { id: string; name: string; value: number; currency: string; company_id: string | null }[] };
  const linkedDealById = new Map((linkedDealRows ?? []).map((d) => [d.id, d]));

  const linkedContactIds = [
    ...new Set(
      [...(overdueRows ?? []), ...(scheduledRows ?? []), ...(meetingRows ?? [])]
        .map((r) => r.contact_id)
        .filter((id): id is string => id !== null),
    ),
  ];
  const { data: linkedContactRows } = linkedContactIds.length > 0
    ? await supabase.from("contacts").select("id,first_name,last_name").in("id", linkedContactIds)
    : { data: [] as { id: string; first_name: string; last_name: string }[] };
  const linkedContactById = new Map((linkedContactRows ?? []).map((c) => [c.id, c]));

  const linkedCompanyIds = [
    ...new Set(
      (linkedDealRows ?? []).map((d) => d.company_id).filter((id): id is string => id !== null),
    ),
  ];
  const { data: linkedCompanyRows } = linkedCompanyIds.length > 0
    ? await supabase.from("companies").select("id,name").in("id", linkedCompanyIds)
    : { data: [] as { id: string; name: string }[] };
  const linkedCompanyById = new Map((linkedCompanyRows ?? []).map((c) => [c.id, c.name]));

  /** Artifact ledger: the small line under the task is the account name. */
  function accountLabel(dealId: string | null, contactId: string | null): string {
    const deal = dealId ? linkedDealById.get(dealId) : undefined;
    if (deal) {
      const company = deal.company_id ? linkedCompanyById.get(deal.company_id) : undefined;
      return company ?? deal.name;
    }
    const contact = contactId ? linkedContactById.get(contactId) : undefined;
    return contact ? fullName(contact.first_name, contact.last_name) : "Untitled";
  }

  // ---- Activities this week (mine) -----------------------------------------
  const { count: activitiesThisWeek } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", session.id)
    .gte("occurred_at", weekAgoIso);

  // ---- Needs attention: overdue → scheduled → stalled -------------------------
  const attention: AttentionItem[] = [];

  for (const r of overdueRows ?? []) {
    const deal = r.deal_id ? linkedDealById.get(r.deal_id) : undefined;
    const daysOverdue = Math.max(0, wholeDaysBetween(r.due_at ?? nowIso, nowIso));
    attention.push({
      kind: "overdue-activity",
      id: r.id,
      title: r.subject || "Follow up",
      context: accountLabel(r.deal_id, r.contact_id),
      dueAt: r.due_at,
      daysOverdue,
      dealId: r.deal_id,
      contactId: r.contact_id,
      activityId: r.id,
      dealValue: deal?.value ?? null,
      dealCurrency: deal?.currency,
    });
  }

  for (const r of scheduledRows ?? []) {
    const deal = r.deal_id ? linkedDealById.get(r.deal_id) : undefined;
    attention.push({
      kind: "scheduled-activity",
      id: r.id,
      title: r.subject || "Follow up",
      context: accountLabel(r.deal_id, r.contact_id),
      dueAt: r.due_at,
      dealId: r.deal_id,
      contactId: r.contact_id,
      activityId: r.id,
      dealValue: deal?.value ?? null,
      dealCurrency: deal?.currency,
    });
  }

  const stalledDeals = myDeals
    .filter((d) => isStaleDeal({ lastTouchedAt: d.last_touched_at, now, thresholdDays: DEFAULT_STALE_THRESHOLD_DAYS }))
    .sort((a, b) => a.last_touched_at.localeCompare(b.last_touched_at))
    .slice(0, 5);

  for (const d of stalledDeals) {
    const stage = stageById.get(d.stage_id);
    const daysQuiet = wholeDaysBetween(d.last_touched_at, nowIso);
    const company = d.company_id ? companyById.get(d.company_id) : undefined;
    attention.push({
      kind: "stalled-deal",
      id: d.id,
      title: d.name,
      context: `${company ?? "No company"} · no touch in ${daysQuiet} ${daysQuiet === 1 ? "day" : "days"}`,
      daysInStage: daysInStage(d.stage_entered_at, now),
      stageName: stage?.name,
      dealId: d.id,
      dealValue: d.value,
      dealCurrency: d.currency,
    });
  }

  // ---- Today's meetings ------------------------------------------------------
  const meetingsToday: MeetingItem[] = (meetingRows ?? []).map((r) => {
    const contact = r.contact_id ? linkedContactById.get(r.contact_id) : undefined;
    const contactName = contact ? fullName(contact.first_name, contact.last_name) : null;
    const deal = r.deal_id ? linkedDealById.get(r.deal_id) : undefined;
    const detail = [contactName, deal?.name].filter(Boolean).join(" · ") || "Scheduled";
    return {
      id: r.id,
      startsAt: r.due_at ?? r.occurred_at,
      title: r.subject || "Meeting",
      detail,
      dealId: r.deal_id,
    };
  });

  // ---- KPI inputs ------------------------------------------------------------
  const taskItems = attention.filter(
    (a) => a.kind === "overdue-activity" || a.kind === "scheduled-activity",
  );
  const dueTodayCount =
    taskItems.filter(
      (a) =>
        a.kind === "overdue-activity" ||
        (a.dueAt != null && new Date(a.dueAt) < endOfToday),
    ).length;
  const motionDealIds = new Set(
    taskItems.map((a) => a.dealId).filter((id): id is string => id !== null),
  );
  const valueInMotion = [...motionDealIds].reduce(
    (sum, id) => sum + Number(linkedDealById.get(id)?.value ?? 0),
    0,
  );
  const nextMeetingAt = meetingsToday.length > 0 ? meetingsToday[0]!.startsAt : null;

  // ---- Recent activity (latest 10, RLS-filtered) ----------------------------
  const { data: recentRows } = await supabase
    .from("activities")
    .select("id,type,subject,body,occurred_at,deal_id,contact_id,owner_id")
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(10);

  const recentOwnerIds = [...new Set((recentRows ?? []).map((r) => r.owner_id))];
  const { data: recentOwners } = recentOwnerIds.length > 0
    ? await supabase.from("users").select("id,full_name,avatar_url").in("id", recentOwnerIds)
    : { data: [] as { id: string; full_name: string; avatar_url: string | null }[] };
  const recentOwnerById = new Map((recentOwners ?? []).map((u) => [u.id, u]));

  const recentActivity: TimelineEntry[] = (recentRows ?? []).map((r) => {
    const owner = recentOwnerById.get(r.owner_id);
    return {
      id: r.id,
      kind: r.type,
      subject: r.subject,
      body: r.body,
      occurredAt: r.occurred_at,
      actorName: owner?.full_name ?? "Unknown",
      actorAvatarUrl: owner?.avatar_url ?? null,
      dealId: r.deal_id,
      contactId: r.contact_id,
    };
  });

  // ---- Manager variant -------------------------------------------------------
  let team: TeamRollup | undefined;
  let hasAnyDeals = myDeals.length > 0;

  if (isManager) {
    const { data: teamDealRows } = await supabase
      .from("deals")
      .select("id,name,value,currency,stage_id,owner_id,company_id,stage_entered_at,last_touched_at")
      .is("deleted_at", null)
      .is("closed_at", null)
      .order("last_touched_at", { ascending: false });
    const teamDeals: OpenDeal[] = teamDealRows ?? [];
    hasAnyDeals = teamDeals.length > 0;

    const { data: teamOverdueRows } = await supabase
      .from("activities")
      .select("owner_id")
      .eq("is_follow_up", true)
      .lt("due_at", nowIso)
      .is("completed_at", null)
      .limit(1000);
    const overdueByOwner = new Map<string, number>();
    for (const r of teamOverdueRows ?? []) {
      overdueByOwner.set(r.owner_id, (overdueByOwner.get(r.owner_id) ?? 0) + 1);
    }

    const teamOwnerIds = [...new Set(teamDeals.map((d) => d.owner_id))];
    const { data: teamOwners } = teamOwnerIds.length > 0
      ? await supabase.from("users").select("id,full_name").in("id", teamOwnerIds)
      : { data: [] as { id: string; full_name: string }[] };
    const teamOwnerById = new Map((teamOwners ?? []).map((u) => [u.id, u.full_name]));

    const teamCurrency = mostCommon(teamDeals.map((d) => d.currency)) ?? currency;
    const perRep: RepRollup[] = teamOwnerIds.map((ownerId) => {
      const deals = teamDeals.filter((d) => d.owner_id === ownerId);
      return {
        userId: ownerId,
        name: teamOwnerById.get(ownerId) ?? "Unknown",
        openDeals: deals.length,
        pipelineValue: deals.reduce((sum, d) => sum + Number(d.value ?? 0), 0),
        overdue: overdueByOwner.get(ownerId) ?? 0,
      };
    }).sort((a, b) => b.pipelineValue - a.pipelineValue);

    const stalledAcrossTeam: AttentionItem[] = teamDeals
      .filter((d) => isStaleDeal({ lastTouchedAt: d.last_touched_at, now, thresholdDays: DEFAULT_STALE_THRESHOLD_DAYS }))
      .sort((a, b) => a.last_touched_at.localeCompare(b.last_touched_at))
      .slice(0, 10)
      .map((d) => {
        const stage = stageById.get(d.stage_id);
        const daysQuiet = wholeDaysBetween(d.last_touched_at, nowIso);
        const company = d.company_id ? companyById.get(d.company_id) : undefined;
        return {
          kind: "stalled-deal" as const,
          id: d.id,
          title: d.name,
          context: `${company ?? "No company"} · ${teamOwnerById.get(d.owner_id) ?? "Unknown"} · quiet ${daysQuiet}d`,
          daysInStage: daysInStage(d.stage_entered_at, now),
          stageName: stage?.name,
          dealId: d.id,
          ownerName: teamOwnerById.get(d.owner_id) ?? "Unknown",
        };
      });

    team = {
      teamPipelineValue: teamDeals.reduce((sum, d) => sum + Number(d.value ?? 0), 0),
      currency: teamCurrency,
      perRep,
      stalledDeals: stalledAcrossTeam,
    };
  }

  const { count: overdueCount } = await supabase
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", session.id)
    .eq("is_follow_up", true)
    .lt("due_at", nowIso)
    .is("completed_at", null);

  return {
    ok: true,
    data: {
      greetingName,
      isManager,
      hasAnyDeals,
      stats: {
        openPipelineValue,
        openDealsCount: myDeals.length,
        currency,
        dealsByStage,
        overdueCount: overdueCount ?? 0,
        dueTodayCount,
        valueInMotion,
        valueInMotionDeals: motionDealIds.size,
        meetingsCount: meetingsToday.length,
        nextMeetingAt,
        activitiesThisWeek: activitiesThisWeek ?? 0,
      },
      needsAttention: attention,
      meetingsToday,
      recentActivity,
      team,
    },
  };
}
