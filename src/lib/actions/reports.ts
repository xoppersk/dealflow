"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { forecastByCloseMonth, forecastTotal, winRate } from "@/lib/domain/forecast";
import { isStaleDeal, wholeDaysBetween } from "@/lib/domain/stale-deals";

import { asManagerOrAdmin } from "./guards";
import { DEFAULT_SETTINGS } from "./settings-model";

/**
 * Manager reports data (APP-FLOW.md Flow C, UI-DESIGN.md 2.11).
 *
 * Every aggregate drills through: each bucket carries the deal ids behind it.
 * - pipelineByStage: current open pipeline grouped by stage (RLS hides deleted).
 * - forecastByMonth: weighted forecast grouped by close month (domain math).
 * - winRateTrend: won/lost per week over the trailing 90 days, from closed_at
 *   plus the stage closed-won / closed-lost flags.
 * - leaderboard: activities logged per user inside the selected range.
 * - stalled: open deals untouched longer than the workspace stale threshold.
 */

const ReportsInputSchema = z.object({
  /** Inclusive start, YYYY-MM-DD. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
  /** Inclusive end, YYYY-MM-DD. */
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
  /** Optional rep filter (user id). */
  ownerId: z.string().uuid().optional(),
});

export type ReportsInput = z.input<typeof ReportsInputSchema>;

export interface StageBucket {
  stageId: string;
  stageName: string;
  color: string;
  value: number;
  /** Approximation of the stage total one full range earlier (same set of
      deals, evaluated against their created_at/closed_at; values are current). */
  previousValue: number;
  count: number;
  dealIds: string[];
}

export interface ForecastBucket {
  month: string;
  /** "Oct 2026" label for the chart axis. */
  monthLabel: string;
  weighted: number;
  raw: number;
  count: number;
  dealIds: string[];
}

export interface WinRateWeek {
  weekStart: string;
  /** "Oct 5" label for the chart axis. */
  weekLabel: string;
  won: number;
  lost: number;
  /** 0–100. */
  rate: number;
  dealIds: string[];
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  count: number;
  /** Distinct deals touched by this user's activities in range. */
  dealIds: string[];
}

export interface StalledDeal {
  dealId: string;
  name: string;
  companyName: string | null;
  ownerId: string;
  ownerName: string;
  value: number;
  currency: string;
  stageId: string;
  stageName: string;
  stageColor: string;
  daysInStage: number;
  daysSinceTouch: number;
  lastTouchedAt: string;
}

export interface ReportsKpis {
  totalOpenValue: number;
  openDealCount: number;
  weightedForecast: number;
  /** Open value one full range earlier (approximation; see StageBucket). */
  previousOpenValue: number;
  winRate90d: number;
  won90d: number;
  lost90d: number;
  /** Average close-cycle days across won deals in range (null when none). */
  averageCycleDays: number | null;
  wonCycleCount: number;
  wonCycleTotalDays: number;
  activitiesInRange: number;
}

/** Highest-value open deal, for the "Bracken Works" calculation note. */
export interface TopDealNote {
  companyName: string;
  stageName: string;
  daysInStage: number;
  nextStepTitle: string | null;
  nextStepDue: string | null;
  value: number;
  currency: string;
}

export interface ReportsData {
  kpis: ReportsKpis;
  pipelineByStage: StageBucket[];
  forecastByMonth: ForecastBucket[];
  winRateTrend: WinRateWeek[];
  leaderboard: LeaderboardRow[];
  stalled: StalledDeal[];
  topDeal: TopDealNote | null;
  /** Active team members for the rep filter. */
  team: { id: string; name: string }[];
  staleThresholdDays: number;
  currency: string;
}

function mondayOf(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = (day + 6) % 7; // days since Monday
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

function weekLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export async function getReportsData(input: ReportsInput): Promise<ActionResult<ReportsData>> {
  const guard = await asManagerOrAdmin();
  if (!guard.ok) return guard;

  const parsed = ReportsInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "INVALID_INPUT" };
  }
  const { from, to, ownerId } = parsed.data;
  if (from > to) return { ok: false, error: "INVALID_RANGE" };

  const supabase = await createClient();
  const now = new Date();

  // Workspace knobs: stale threshold + default currency.
  const { data: settingsRows } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["stale_threshold_days", "default_currency"]);
  let staleThresholdDays = DEFAULT_SETTINGS.staleThresholdDays;
  let currency = DEFAULT_SETTINGS.defaultCurrency;
  for (const row of settingsRows ?? []) {
    if (row.key === "stale_threshold_days") {
      const n = Number(row.value);
      if (Number.isInteger(n) && n >= 1 && n <= 90) staleThresholdDays = n;
    }
    if (row.key === "default_currency" && typeof row.value === "string") {
      currency = row.value;
    }
  }

  // Reference data (small tables, full scans are fine at this scale).
  const [{ data: stages }, { data: users }, { data: companies }] = await Promise.all([
    supabase.from("pipeline_stages").select("*").order("position"),
    supabase.from("users").select("id, full_name, avatar_url, is_active").order("full_name"),
    supabase.from("companies").select("id, name"),
  ]);
  if (!stages || !users || !companies) return { ok: false, error: "LOAD_FAILED" };

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const companyById = new Map(companies.map((c) => [c.id, c]));

  // Deals in scope: RLS hides deleted rows; managers/admins see everything.
  let dealQuery = supabase
    .from("deals")
    .select(
      "id, name, value, currency, probability, close_date, owner_id, stage_id, stage_entered_at, last_touched_at, closed_at, company_id, created_at",
    );
  if (ownerId) dealQuery = dealQuery.eq("owner_id", ownerId);
  const { data: deals, error: dealsError } = await dealQuery;
  if (dealsError || !deals) return { ok: false, error: "LOAD_FAILED" };

  const openDeals = deals.filter((d) => !d.closed_at);
  const closedDeals = deals.filter((d) => d.closed_at);

  // --- Previous-period approximation -----------------------------------------
  // The deals table keeps no value history, so "last period" is derived from
  // the same rows: a deal counted as open at prevTo when it was created on or
  // before prevTo and not yet closed. Current values are used throughout.
  const prevToIso = new Date(new Date(`${from}T00:00:00Z`).getTime()).toISOString();
  const openAtPrevTo = (d: (typeof deals)[number]) =>
    d.created_at <= prevToIso && (d.closed_at == null || d.closed_at > prevToIso);

  // --- Pipeline value by stage (open deals only) ---
  const pipelineByStage: StageBucket[] = stages.map((stage) => {
    const inStage = openDeals.filter((d) => d.stage_id === stage.id);
    return {
      stageId: stage.id,
      stageName: stage.name,
      color: stage.color,
      value: inStage.reduce((sum, d) => sum + Math.max(0, d.value), 0),
      previousValue: openDeals
        .filter((d) => d.stage_id === stage.id && openAtPrevTo(d))
        .reduce((sum, d) => sum + Math.max(0, d.value), 0),
      count: inStage.length,
      dealIds: inStage.map((d) => d.id),
    };
  });
  const previousOpenValue = pipelineByStage.reduce((sum, s) => sum + s.previousValue, 0);

  // --- Average close-cycle length (won deals in range) ------------------------
  const rangeStart = new Date(`${from}T00:00:00Z`).getTime();
  const rangeEnd = new Date(`${to}T23:59:59Z`).getTime();
  const wonInRange = closedDeals.filter((d) => {
    if (!d.closed_at) return false;
    const closedAt = new Date(d.closed_at).getTime();
    if (closedAt < rangeStart || closedAt > rangeEnd) return false;
    return stageById.get(d.stage_id)?.is_closed_won === true;
  });
  const wonCycleTotalDays = wonInRange.reduce(
    (sum, d) =>
      sum + Math.max(0, Math.round((new Date(d.closed_at as string).getTime() - new Date(d.created_at).getTime()) / 86_400_000)),
    0,
  );
  const wonCycleCount = wonInRange.length;
  const averageCycleDays =
    wonCycleCount > 0 ? Math.round(wonCycleTotalDays / wonCycleCount) : null;

  // --- Top open deal (the "Bracken Works" calculation note) --------------------
  const topOpen = [...openDeals].sort((a, b) => Number(b.value) - Number(a.value))[0];
  let topDeal: TopDealNote | null = null;
  if (topOpen) {
    const { data: nextStep } = await supabase
      .from("activities")
      .select("subject, due_at")
      .eq("deal_id", topOpen.id)
      .eq("is_follow_up", true)
      .is("completed_at", null)
      .not("due_at", "is", null)
      .order("due_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const company = topOpen.company_id ? companyById.get(topOpen.company_id) : undefined;
    topDeal = {
      companyName: company?.name ?? topOpen.name,
      stageName: stageById.get(topOpen.stage_id)?.name ?? "Unknown",
      daysInStage: wholeDaysBetween(topOpen.stage_entered_at, now),
      nextStepTitle: nextStep?.subject ?? null,
      nextStepDue: nextStep?.due_at ?? null,
      value: Number(topOpen.value),
      currency: topOpen.currency,
    };
  }

  // --- Forecast by close month (domain math; deal ids per bucket) ---
  const idsByMonth = new Map<string, string[]>();
  for (const d of openDeals) {
    if (!d.close_date) continue;
    const month = d.close_date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const list = idsByMonth.get(month) ?? [];
    list.push(d.id);
    idsByMonth.set(month, list);
  }
  const forecastByMonth: ForecastBucket[] = forecastByCloseMonth(
    openDeals.map((d) => ({
      value: d.value,
      probability: d.probability,
      stageDefaultProbability: stageById.get(d.stage_id)?.default_probability ?? 0,
      closeDate: d.close_date,
    })),
  ).map((b) => ({
    month: b.month,
    monthLabel: monthLabel(b.month),
    weighted: b.weighted,
    raw: b.raw,
    count: b.count,
    dealIds: idsByMonth.get(b.month) ?? [],
  }));

  // --- Win rate trend: trailing 90 days, won/lost per week ---
  const windowStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const weeks = new Map<string, { won: number; lost: number; dealIds: string[] }>();
  // Seed 13 weekly buckets so the line never has gaps.
  for (let i = 12; i >= 0; i--) {
    const weekMonday = mondayOf(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000));
    weeks.set(weekMonday.toISOString().slice(0, 10), { won: 0, lost: 0, dealIds: [] });
  }
  let won90d = 0;
  let lost90d = 0;
  for (const d of closedDeals) {
    if (!d.closed_at) continue;
    const closedAt = new Date(d.closed_at);
    if (closedAt < windowStart || closedAt > now) continue;
    const stage = stageById.get(d.stage_id);
    const isWon = stage?.is_closed_won === true;
    const isLost = stage?.is_closed_lost === true;
    if (!isWon && !isLost) continue;
    const weekKey = mondayOf(closedAt).toISOString().slice(0, 10);
    const bucket = weeks.get(weekKey);
    if (!bucket) continue;
    if (isWon) {
      bucket.won += 1;
      won90d += 1;
    } else {
      bucket.lost += 1;
      lost90d += 1;
    }
    bucket.dealIds.push(d.id);
  }
  const winRateTrend: WinRateWeek[] = [...weeks.entries()].map(([weekStart, b]) => ({
    weekStart,
    weekLabel: weekLabel(weekStart),
    won: b.won,
    lost: b.lost,
    rate: Math.round(winRate(b.won, b.lost) * 1000) / 10,
    dealIds: b.dealIds,
  }));

  // --- Activity leaderboard (range from the filter bar) ---
  let activityQuery = supabase
    .from("activities")
    .select("id, owner_id, deal_id")
    .gte("created_at", `${from}T00:00:00Z`)
    .lte("created_at", `${to}T23:59:59Z`);
  if (ownerId) activityQuery = activityQuery.eq("owner_id", ownerId);
  const { data: activities, error: activitiesError } = await activityQuery;
  if (activitiesError || !activities) return { ok: false, error: "LOAD_FAILED" };

  const perUser = new Map<string, { count: number; dealIds: Set<string> }>();
  for (const a of activities) {
    const entry = perUser.get(a.owner_id) ?? { count: 0, dealIds: new Set<string>() };
    entry.count += 1;
    if (a.deal_id) entry.dealIds.add(a.deal_id);
    perUser.set(a.owner_id, entry);
  }
  const leaderboard: LeaderboardRow[] = [...perUser.entries()]
    .map(([userId, v]) => {
      const user = userById.get(userId);
      return {
        userId,
        name: user?.full_name ?? "Unknown",
        avatarUrl: user?.avatar_url ?? null,
        count: v.count,
        dealIds: [...v.dealIds],
      };
    })
    .sort((a, b) => b.count - a.count);

  // --- Stalled deals (open, untouched past the workspace threshold) ---
  const stalled: StalledDeal[] = openDeals
    .filter((d) =>
      isStaleDeal({ lastTouchedAt: d.last_touched_at, now, thresholdDays: staleThresholdDays }),
    )
    .map((d) => {
      const stage = stageById.get(d.stage_id);
      const owner = userById.get(d.owner_id);
      const company = d.company_id ? companyById.get(d.company_id) : undefined;
      return {
        dealId: d.id,
        name: d.name,
        companyName: company?.name ?? null,
        ownerId: d.owner_id,
        ownerName: owner?.full_name ?? "Unknown",
        value: d.value,
        currency: d.currency,
        stageId: d.stage_id,
        stageName: stage?.name ?? "Unknown",
        stageColor: stage?.color ?? "#78716C",
        daysInStage: wholeDaysBetween(d.stage_entered_at, now),
        daysSinceTouch: wholeDaysBetween(d.last_touched_at, now),
        lastTouchedAt: d.last_touched_at,
      };
    })
    .sort((a, b) => b.daysSinceTouch - a.daysSinceTouch);

  const forecastDeals = openDeals.map((d) => ({
    value: d.value,
    probability: d.probability,
    stageDefaultProbability: stageById.get(d.stage_id)?.default_probability ?? 0,
  }));

  return {
    ok: true,
    data: {
      kpis: {
        totalOpenValue: openDeals.reduce((sum, d) => sum + Math.max(0, d.value), 0),
        openDealCount: openDeals.length,
        weightedForecast: forecastTotal(forecastDeals),
        previousOpenValue,
        winRate90d: Math.round(winRate(won90d, lost90d) * 1000) / 10,
        won90d,
        lost90d,
        averageCycleDays,
        wonCycleCount,
        wonCycleTotalDays,
        activitiesInRange: activities.length,
      },
      pipelineByStage,
      forecastByMonth,
      winRateTrend,
      leaderboard,
      stalled,
      topDeal,
      team: users
        .filter((u) => u.is_active)
        .map((u) => ({ id: u.id, name: u.full_name })),
      staleThresholdDays,
      currency,
    },
  };
}
