/**
 * lib/df/db.ts — the server data layer (production).
 *
 * getContext(): the caller's Supabase client (RLS-enforced, never service
 * role), auth user and workspace (first membership; ensure_workspace() RPC
 * as belt-and-braces when a pre-provisioning user has none).
 * getDataset(): the caller's workspace rows mapped to the v2 screen types
 * (Dataset). ID contract: Deal/Company/Contact .id = DB uuid, Stage.id =
 * stage slug, Person.id = user uuid.
 *
 * Derivations (also logged in PRODUCTION-LOG.md, W3):
 * - Company.customer: the company has a closed-Won deal.
 * - Contact.customer: its company is a customer. Contact.newLead: created
 *   within 14 days AND linked to a deal in the new-lead stage (via
 *   deal_contacts or a same-company deal).
 * - Stage.valueSep: open total that sat in the stage at the end of last
 *   month, reconstructed from stage_history (deals without history count
 *   at their current stage when created before then) — a real figure,
 *   not the fixture artefact.
 * - Person.online: true only for the signed-in user (no presence source).
 * - NextStep.blocks: an OVERDUE next step blocks (due date passed) — the
 *   deals table carries no separate blocks flag; checkMove's Won gate
 *   reads this. NextStep.stale mirrors the deal's stale state.
 * - Avatar/monogram colours: users.avatar_bg/avatar_color and
 *   companies.mg_bg/mg_color (migration 00013) when set; otherwise a
 *   deterministic palette by id hash (lib/df/api).
 */
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isStaleDeal, wholeDaysBetween } from "@/lib/domain/stale-deals";
import { urgencyForDaysInStage } from "@/lib/domain/urgency";
import {
  avatarColorsFor,
  companyColorsFor,
  initialsOfName,
  isOpenDeal,
  weightedForDeal,
} from "./api";
import {
  dateLabel,
  dateLabelWithDay,
  dayGroupLabel,
  enteredStageLabel,
  moneyCompact,
  timeLabel,
  wholeDays,
} from "./format";
import type {
  Activity,
  AuditEntry,
  Company,
  Contact,
  Dataset,
  Deal,
  DealAttachment,
  PendingInvite,
  Person,
  Stage,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface DfContext {
  supabase: Supabase;
  user: { id: string; email: string };
  workspace: Row;
  workspaceId: string;
  role: string;
}

export const getContext = cache(async (): Promise<DfContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let membership: Row | null = null;
  {
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    membership = (data?.[0] as Row) ?? null;
  }
  if (!membership) {
    await supabase.rpc("ensure_workspace");
    const { data } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);
    membership = (data?.[0] as Row) ?? null;
  }
  if (!membership) throw new Error("No workspace for this user");

  const workspaceId = membership.workspace_id as string;
  const { data: ws } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();

  return {
    supabase,
    user: { id: user.id, email: user.email ?? "" },
    workspace: (ws as Row) ?? { id: workspaceId, name: "My workspace", scope: "Sales" },
    workspaceId,
    role: (membership.role as string) ?? "rep",
  };
});

const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Manager", rep: "Rep" };
const ACTIVITY_LABEL: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export const getDataset = cache(async (): Promise<Dataset> => {
  const { supabase, user, workspace, workspaceId, role } = await getContext();
  const now = new Date();

  const q = (table: string) => supabase.from(table).select("*").eq("workspace_id", workspaceId);

  const [
    stagesRes,
    membersRes,
    companiesRes,
    contactsRes,
    dealsRes,
    dealContactsRes,
    activitiesRes,
    historyRes,
    invitesRes,
    settingsRes,
    auditRes,
    attachmentsRes,
  ] = await Promise.all([
    q("pipeline_stages").order("position", { ascending: true }),
    q("workspace_members").order("created_at", { ascending: true }),
    q("companies").is("deleted_at", null).order("name", { ascending: true }),
    q("contacts").is("deleted_at", null).order("first_name", { ascending: true }),
    q("deals").is("deleted_at", null).order("board_position", { ascending: true }),
    q("deal_contacts"),
    q("activities").order("occurred_at", { ascending: false }).limit(500),
    q("stage_history").order("changed_at", { ascending: false }).limit(500),
    q("invites").is("accepted_at", null).order("created_at", { ascending: true }),
    q("app_settings"),
    q("audit_log").order("created_at", { ascending: false }).limit(200),
    q("deal_attachments").order("created_at", { ascending: false }),
  ]);

  const stageRows = (stagesRes.data ?? []) as Row[];
  const memberRows = (membersRes.data ?? []) as Row[];
  const companyRows = (companiesRes.data ?? []) as Row[];
  const contactRows = (contactsRes.data ?? []) as Row[];
  const dealRows = (dealsRes.data ?? []) as Row[];
  const dealContactRows = (dealContactsRes.data ?? []) as Row[];
  const activityRows = (activitiesRes.data ?? []) as Row[];
  const historyRows = (historyRes.data ?? []) as Row[];
  const inviteRows = (invitesRes.data ?? []) as Row[];
  const settingRows = (settingsRes.data ?? []) as Row[];
  const auditRows = (auditRes.data ?? []) as Row[];
  const attachmentRows = (attachmentsRes.data ?? []) as Row[];

  /* ----- team ----- */
  const memberIds = memberRows.map((m) => m.user_id as string);
  let userRows: Row[] = [];
  if (memberIds.length) {
    const { data } = await supabase.from("users").select("*").in("id", memberIds);
    userRows = (data ?? []) as Row[];
  }
  const userById = new Map(userRows.map((u) => [u.id as string, u]));
  const memberRole = new Map(memberRows.map((m) => [m.user_id as string, m.role as string]));

  /* ----- stages ----- */
  const stageSlugByUuid = new Map<string, string>();
  const stages: Stage[] = stageRows.map((r) => {
    const slug =
      (r.slug as string) ??
      (r.is_closed_won ? "won" : r.is_closed_lost ? "lost" : slugify(r.name as string));
    stageSlugByUuid.set(r.id as string, slug);
    const requires = Array.isArray(r.requires)
      ? (r.requires as unknown[]).map(String)
      : typeof r.requires === "string"
        ? [r.requires as string]
        : [];
    return {
      id: slug,
      uuid: r.id as string,
      name: r.name as string,
      winChance: Number(r.default_probability ?? 0),
      valueSep: 0, // computed after deals/history are mapped (below)
      staleLimitDays: Number(r.stale_limit_days ?? 14),
      requires,
    };
  });
  const stageBySlug = new Map(stages.map((s) => [s.id, s]));
  const stageByUuid = new Map<string, Stage>();
  for (const r of stageRows) {
    const slug = stageSlugByUuid.get(r.id as string);
    const s = slug ? stageBySlug.get(slug) : undefined;
    if (s) stageByUuid.set(r.id as string, s);
  }

  /* ----- deals (first pass: values needed by companies/contacts) ----- */
  const wonCompanyIds = new Set<string>();
  for (const r of dealRows) {
    const slug = stageSlugByUuid.get(r.stage_id as string);
    if (slug === "won" && r.company_id) wonCompanyIds.add(r.company_id as string);
  }

  /* ----- companies ----- */
  const companies: Company[] = companyRows.map((r) => {
    const colors = companyColorsFor(r.id as string);
    return {
      id: r.id as string,
      name: r.name as string,
      initials: initialsOfName(r.name as string),
      mgBg: (r.mg_bg as string) ?? colors.bg,
      mgColor: (r.mg_color as string) ?? colors.color,
      customer: wonCompanyIds.has(r.id as string),
      industry: (r.industry as string) ?? undefined,
      website: (r.website as string) ?? undefined,
      sizeLabel: (r.size_label as string) ?? (r.size as string) ?? undefined,
      city: (r.city as string) ?? undefined,
      ownerId: (r.owner_id as string) ?? undefined,
      createdAt: r.created_at as string,
    };
  });
  const companyByIdMap = new Map(companies.map((c) => [c.id, c]));

  /* ----- deal_contacts grouped ----- */
  const peopleByDeal = new Map<string, { contactId: string; role: string }[]>();
  for (const dc of dealContactRows) {
    const list = peopleByDeal.get(dc.deal_id as string) ?? [];
    list.push({ contactId: dc.contact_id as string, role: (dc.role as string) ?? "" });
    peopleByDeal.set(dc.deal_id as string, list);
  }

  /* ----- contacts ----- */
  const fourteenDaysAgo = now.getTime() - 14 * 86_400_000;
  const contacts: Contact[] = contactRows.map((r) => {
    const companyId = (r.company_id as string) ?? "";
    const linkedDealIds = new Set(
      dealContactRows.filter((dc) => dc.contact_id === r.id).map((dc) => dc.deal_id as string),
    );
    const hasNewLeadDeal = dealRows.some((d) => {
      const inNewLead = stageSlugByUuid.get(d.stage_id as string) === "new-lead";
      if (!inNewLead) return false;
      return linkedDealIds.has(d.id as string) || (companyId !== "" && d.company_id === companyId);
    });
    const createdRecent = new Date(r.created_at as string).getTime() >= fourteenDaysAgo;
    return {
      id: r.id as string,
      name: `${(r.first_name as string) ?? ""} ${(r.last_name as string) ?? ""}`.trim(),
      title: (r.title as string) ?? "",
      companyId,
      email: (r.email as string) ?? "",
      customer: companyId !== "" ? wonCompanyIds.has(companyId) : false,
      newLead: createdRecent && hasNewLeadDeal,
      phone: (r.phone as string) ?? undefined,
      prefers: (r.prefers as string) ?? undefined,
      metThrough: (r.met_through as string) ?? undefined,
      ownerId: (r.owner_id as string) ?? undefined,
      createdAt: r.created_at as string,
    };
  });

  /* ----- attachments grouped ----- */
  const attachmentsByDeal = new Map<string, DealAttachment[]>();
  for (const a of attachmentRows) {
    const item: DealAttachment = {
      id: a.id as string,
      dealId: a.deal_id as string,
      fileName: a.file_name as string,
      mimeType: a.mime_type as string,
      sizeBytes: Number(a.size_bytes ?? 0),
      uploadedBy: a.uploaded_by as string,
      createdAt: a.created_at as string,
    };
    const list = attachmentsByDeal.get(item.dealId) ?? [];
    list.push(item);
    attachmentsByDeal.set(item.dealId, list);
  }

  /* ----- history grouped (chronological per deal) ----- */
  const historyByDeal = new Map<string, Row[]>();
  for (const h of [...historyRows].reverse()) {
    const list = historyByDeal.get(h.deal_id as string) ?? [];
    list.push(h);
    historyByDeal.set(h.deal_id as string, list);
  }

  /* ----- deals ----- */
  const deals: Deal[] = dealRows.map((r) => {
    const stageSlug = stageSlugByUuid.get(r.stage_id as string) ?? slugify((r.stage_id as string) ?? "");
    const stage = stageBySlug.get(stageSlug);
    const enteredAt = (r.stage_entered_at as string) ?? (r.created_at as string);
    const daysInStage = wholeDaysBetween(enteredAt, now);
    const isClosed = stageSlug === "won" || stageSlug === "lost";
    const stale = isStaleDeal({
      lastTouchedAt: r.last_touched_at as string,
      now,
      thresholdDays: stage?.staleLimitDays ?? Number(workspace.stale_limit_days ?? 14),
      isClosed,
    });

    let nextStep: Deal["nextStep"] = null;
    const stepText = (r.next_step_text as string) ?? "";
    if (stepText) {
      const dueIso = (r.next_step_due as string) ?? "";
      const due = dueIso ? new Date(`${dueIso}T12:00:00`) : null;
      const overdue = due ? due.getTime() < new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T00:00:00`).getTime() : false;
      const daysToDue = due ? Math.round((due.getTime() - now.getTime()) / 86_400_000) : 99;
      nextStep = {
        text: stepText,
        dueDate: dueIso,
        dueLabel: stale && overdue ? `Stale · no reply in ${daysInStage} days` : due ? dateLabelWithDay(due) : "",
        urgency: overdue ? "act" : daysToDue <= 3 ? "watch" : "on-track",
        blocks: overdue || undefined,
        stale: stale || undefined,
      };
    }

    const compositionRaw = r.composition as unknown;
    const composition: { label: string; value: number }[] = Array.isArray(compositionRaw)
      ? (compositionRaw as Row[]).map((c) => ({ label: String(c.label ?? ""), value: Number(c.value ?? 0) }))
      : compositionRaw && typeof compositionRaw === "object"
        ? Object.entries(compositionRaw as Record<string, unknown>).map(([label, v]) => ({
            label,
            value: Number(v ?? 0),
          }))
        : [];

    const history = (historyByDeal.get(r.id as string) ?? []).map((h) => ({
      stageId: stageSlugByUuid.get(h.to_stage_id as string) ?? "",
      dateLabel: dateLabel(h.changed_at as string),
    }));

    // Just-moved: the latest history entry, if it landed within the hour.
    let justMoved: Deal["justMoved"];
    const mine = historyByDeal.get(r.id as string) ?? [];
    const latest = mine[mine.length - 1];
    if (latest && !isClosed) {
      const mins = Math.floor((now.getTime() - new Date(latest.changed_at as string).getTime()) / 60_000);
      if (mins >= 0 && mins < 60) {
        justMoved = {
          byId: latest.changed_by as string,
          fromStageId: latest.from_stage_id ? (stageSlugByUuid.get(latest.from_stage_id as string) ?? "") : "",
          toStageId: stageSlugByUuid.get(latest.to_stage_id as string) ?? stageSlug,
          agoLabel: mins <= 1 ? "just now" : `${mins} min ago`,
        };
      }
    }

    const deal: Deal = {
      id: r.id as string,
      companyId: (r.company_id as string) ?? "",
      name: r.name as string,
      value: Number(r.value ?? 0),
      stageId: stageSlug,
      daysInStage,
      enteredStageLabel: justMoved
        ? `In ${stage?.name ?? stageSlug} ${justMoved.agoLabel === "just now" ? "just now" : justMoved.agoLabel}`
        : enteredStageLabel(daysInStage),
      ownerId: r.owner_id as string,
      nextStep,
      lastTouchLabel: dateLabel(r.last_touched_at as string),
      lastTouchedAt: r.last_touched_at as string,
      createdAt: r.created_at as string,
      closedAt: (r.closed_at as string) ?? undefined,
      stale: stale || undefined,
      justMoved,
      closeDate: (r.close_date as string) ?? undefined,
      attachments: attachmentsByDeal.get(r.id as string) ?? [],
    };
    deal.detail = {
      composition,
      source: (r.source as string) ?? "",
      weighted: 0,
      stageHistory: history,
      people: peopleByDeal.get(r.id as string) ?? [],
    };
    deal.detail.weighted = weightedForDeal(deal, stages);
    return deal;
  });

  /* ----- Stage.valueSep: stage totals at end of last month, from history ----- */
  {
    const eolm = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const totals = new Map<string, number>();
    for (const r of dealRows) {
      if (new Date(r.created_at as string).getTime() > eolm.getTime()) continue;
      const hist = (historyByDeal.get(r.id as string) ?? []).filter(
        (h) => new Date(h.changed_at as string).getTime() <= eolm.getTime(),
      );
      const slugAt = hist.length
        ? stageSlugByUuid.get(hist[hist.length - 1]!.to_stage_id as string)
        : stageSlugByUuid.get(r.stage_id as string);
      if (slugAt) totals.set(slugAt, (totals.get(slugAt) ?? 0) + Number(r.value ?? 0));
    }
    for (const s of stages) s.valueSep = totals.get(s.id) ?? 0;
  }

  /* ----- team (computed open figures) ----- */
  const team: Person[] = memberRows.map((m) => {
    const uid = m.user_id as string;
    const u = userById.get(uid);
    const name = ((u?.full_name as string) ?? (u?.email as string) ?? "Team member").trim();
    const mine = deals.filter((d) => d.ownerId === uid && isOpenDeal(d));
    const openValue = mine.reduce((s, d) => s + d.value, 0);
    const colors = avatarColorsFor(uid);
    return {
      id: uid,
      name,
      firstName: name.split(/\s+/)[0] ?? name,
      initials: initialsOfName(name),
      email: (u?.email as string) ?? "",
      role: ROLE_LABEL[memberRole.get(uid) ?? "rep"] ?? "Rep",
      openDeals: mine.length,
      openValue,
      openValueLabel: moneyCompact(openValue),
      avatarBg: (u?.avatar_bg as string) ?? colors.bg,
      avatarColor: (u?.avatar_color as string) ?? colors.color,
      online: uid === user.id,
      you: uid === user.id,
    };
  });

  /* ----- activities + merged stage moves ----- */
  const moveActivities: Activity[] = historyRows.map((h) => {
    const deal = deals.find((d) => d.id === (h.deal_id as string));
    const fromStage = h.from_stage_id ? stageByUuid.get(h.from_stage_id as string) : undefined;
    const toStage = stageByUuid.get(h.to_stage_id as string);
    const fromChance = fromStage?.winChance ?? 0;
    const toChance = toStage?.winChance ?? 0;
    const delta = deal ? Math.round((deal.value * (toChance - fromChance)) / 100) : 0;
    return {
      id: `move-${h.id as string}`,
      type: "Move",
      subject: deal ? (companyByIdMap.get(deal.companyId)?.name ?? deal.name) : "Deal",
      detail: `Win chance ${fromChance}% → ${toChance}% · weighted ${delta >= 0 ? "+" : "−"}${moneyCompact(Math.abs(delta)).slice(0)}`,
      timeLabel: timeLabel(h.changed_at as string),
      dayLabel: dayGroupLabel(h.changed_at as string, now),
      ownerId: h.changed_by as string,
      dealId: h.deal_id as string,
      fromStage: fromStage?.name,
      toStage: toStage?.name,
      occurredAt: h.changed_at as string,
    } satisfies Activity;
  });

  const realActivities: Activity[] = activityRows.map((r) => {
    const occurred = r.occurred_at as string;
    const isFollowUp = Boolean(r.is_follow_up);
    const completed = Boolean(r.completed_at);
    const dueAt = (r.due_at as string) ?? undefined;
    const overdueDays =
      isFollowUp && !completed && dueAt && new Date(dueAt).getTime() < now.getTime()
        ? wholeDays(dueAt, now)
        : undefined;
    const label =
      (r.type_label as string) ?? (isFollowUp && !completed ? "Task" : (ACTIVITY_LABEL[r.type as string] ?? "Note"));
    const deal = r.deal_id ? deals.find((d) => d.id === (r.deal_id as string)) : undefined;
    return {
      id: r.id as string,
      type: label,
      subject:
        (r.subject as string) ??
        (deal ? (companyByIdMap.get(deal.companyId)?.name ?? deal.name) : ""),
      detail: (r.body as string) ?? undefined,
      timeLabel: timeLabel(occurred),
      dayLabel: overdueDays !== undefined ? "Overdue tasks" : dayGroupLabel(occurred, now),
      ownerId: r.owner_id as string,
      dealId: (r.deal_id as string) ?? undefined,
      contactId: (r.contact_id as string) ?? undefined,
      overdueDays,
      isFollowUp,
      completed,
      dueAt,
      occurredAt: occurred,
    } satisfies Activity;
  });

  const activities = [...realActivities, ...moveActivities].sort((a, b) =>
    (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""),
  );
  /* ----- closed summary ----- */
  const wonDeals = deals.filter((d) => d.stageId === "won");
  const lostDeals = deals.filter((d) => d.stageId === "lost");
  const daysToClose = wonDeals
    .map((d) => (d.closedAt && d.createdAt ? wholeDays(d.createdAt, d.closedAt) : 0))
    .sort((a, b) => a - b);
  const closed = {
    won: wonDeals.length,
    lost: lostDeals.length,
    winRate:
      wonDeals.length + lostDeals.length > 0
        ? Math.round((wonDeals.length / (wonDeals.length + lostDeals.length)) * 100)
        : 0,
    daysToClose,
    averageDaysToClose: daysToClose.length
      ? Math.round(daysToClose.reduce((s, n) => s + n, 0) / daysToClose.length)
      : 0,
  };

  /* ----- settings ----- */
  const settingMap = new Map(settingRows.map((s) => [s.key as string, s.value as unknown]));
  const staleFromSettings = settingMap.get("stale_threshold_days");
  const settings = {
    workspaceName: (workspace.name as string) ?? "My workspace",
    workspaceScope: (workspace.scope as string) ?? "Sales",
    staleLimitDays:
      Number(workspace.stale_limit_days ?? (typeof staleFromSettings === "number" ? staleFromSettings : 14)) || 14,
    staleLimitPendingDays:
      Number(workspace.stale_limit_pending_days ?? workspace.stale_limit_days ?? 14) || 14,
    pendingInviteEmail: (inviteRows[0]?.email as string) ?? "",
  };

  /* ----- audit + invites ----- */
  const audit: AuditEntry[] = auditRows.map((r) => {
    const diff = (r.diff as Row) ?? {};
    return {
      id: r.id as string,
      type: (r.action as string) ?? "Change",
      subject: (diff.subject as string) ?? (r.entity_type as string) ?? "",
      detail:
        (diff.detail as string) ??
        (diff.reason as string) ??
        (diff.fromStage && diff.toStage ? `From ${diff.fromStage} to ${diff.toStage}` : undefined),
      timeLabel: dayGroupLabel(r.created_at as string, now) === "Today" ? timeLabel(r.created_at as string) : dateLabel(r.created_at as string),
      dayLabel: dayGroupLabel(r.created_at as string, now),
      ownerId: r.actor_id as string,
    };
  });

  const invites: PendingInvite[] = inviteRows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
    role: ROLE_LABEL[r.role as string] ?? (r.role as string),
    createdAt: r.created_at as string,
    expiresAt: r.expires_at as string,
  }));

  void urgencyForDaysInStage; // (domain urgency used for days-in-stage badges elsewhere)

  return {
    team,
    stages,
    companies,
    contacts,
    deals,
    activities,
    closed,
    settings,
    currentUserId: user.id,
    workspaceId,
    workspaceRole: role,
    audit,
    invites,
  };
});
