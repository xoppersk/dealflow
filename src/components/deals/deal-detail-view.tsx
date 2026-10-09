"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { ActivityComposer } from "@/components/activities/activity-composer";
import { Timeline } from "@/components/activities/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DaysInStageBadge } from "@/components/shared/days-in-stage-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { MoveStageMenu } from "@/components/pipeline/move-stage-menu";
import { DealActionsMenu } from "@/components/deals/deal-actions-menu";
import { FieldGrid } from "@/components/deals/field-grid";
import { FileList } from "@/components/deals/file-list";
import { LinkedContacts } from "@/components/deals/linked-contacts";
import { PresenceStack } from "@/components/deals/presence-stack";
import { UploadDropzone } from "@/components/deals/upload-dropzone";
import { usePresence } from "@/lib/realtime/channels";
import { daysInStage, formatCurrency, formatCompactCurrency, formatDate, initials } from "@/lib/format";
import type { DealDetailData } from "@/lib/actions/deals";
import type { PipelineStageRow, UserRole } from "@/lib/supabase/types";
import type { TimelineEntry } from "@/lib/types";

interface DealDetailViewProps {
  data: DealDetailData;
  stages: PipelineStageRow[];
  currentUser: { id: string; name: string; avatarUrl: string | null; role: UserRole };
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  new_business: "New business",
  renewal: "Renewal",
  expansion: "Expansion",
  other: "Other",
};

export function DealDetailView({ data, stages, currentUser }: DealDetailViewProps) {
  const { deal, company, owner, stage, contacts, attachments, stageHistory, activities } = data;
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("timeline");

  const others = usePresence(`deal:${deal.id}`, {
    userId: currentUser.id,
    name: currentUser.name,
    avatarUrl: currentUser.avatarUrl,
  });

  const entries: TimelineEntry[] = useMemo(() => {
    const activityEntries: TimelineEntry[] = activities.map((a) => ({
      id: a.id,
      kind: a.type,
      subject: a.subject,
      body: a.body,
      occurredAt: a.occurred_at,
      actorName: a.ownerName,
      actorAvatarUrl: null,
      dealId: a.deal_id,
      contactId: a.contact_id,
    }));
    const stageEntries: TimelineEntry[] = stageHistory.map((h) => ({
      id: h.id,
      kind: "stage-change",
      subject:
        h.fromStageName != null
          ? `${h.fromStageName} → ${h.toStageName}`
          : `Entered ${h.toStageName}`,
      body: null,
      occurredAt: h.changedAt,
      actorName: h.changedByName,
      actorAvatarUrl: null,
      dealId: deal.id,
      contactId: null,
    }));
    return [...activityEntries, ...stageEntries].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  }, [activities, stageHistory, deal.id]);

  const stageColor = stage?.color ?? "#78716c";
  const canDeleteFiles = deal.owner_id === currentUser.id || currentUser.role === "admin";
  const probability = deal.probability ?? stage?.default_probability ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Header — deal ledger */}
      <header>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="df-kicker">
              Deal · {company ? company.name : "No company"}
            </p>
            <h1 className="df-page-title mt-1">{deal.name}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {DEAL_TYPE_LABELS[deal.deal_type] ?? "Deal"}
              {company ? (
                <>
                  {" · "}
                  <Link href={`/companies/${company.id}`} className="font-medium text-foreground hover:underline">
                    {company.name}
                  </Link>
                </>
              ) : null}
              {owner ? ` · owned by ${owner.full_name}` : null}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Badge variant="secondary" className="gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor }} />
                {stage?.name ?? "No stage"}
              </Badge>
              <DaysInStageBadge days={daysInStage(deal.stage_entered_at)} />
              {deal.closed_at && (
                <span className="text-xs text-muted-foreground">
                  Closed {formatDate(deal.closed_at)}
                </span>
              )}
              <PresenceStack users={others} />
            </div>
          </div>
          <div className="shrink-0 border border-border bg-card px-5 py-3 text-right">
            <span className="block text-[11px] text-muted-foreground">Ticket value</span>
            <strong className="df-money mt-1 block text-2xl">
              {formatCompactCurrency(deal.value, deal.currency)}
            </strong>
            <small className="tnum mt-1 block text-[11px] text-muted-foreground">
              {daysInStage(deal.stage_entered_at)} days in {stage?.name ?? "—"}
            </small>
          </div>
        </div>

        {/* Action bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <MoveStageMenu
            dealId={deal.id}
            currentStageId={deal.stage_id}
            version={deal.version}
            stages={stages.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
          />
          <ActivityComposer dealId={deal.id} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTab("details");
              setEditing(true);
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <DealActionsMenu deal={deal} stages={stages} role={currentUser.role} currentUserId={currentUser.id} />
        </div>
      </header>

      {/* Body: tabs + decision rail */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="files">Files ({attachments.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="mt-4">
              <div className="grid gap-4">
                <div className="border border-border bg-card p-4">
                  <ActivityComposer dealId={deal.id} />
                </div>
                <Timeline entries={entries} />
              </div>
            </TabsContent>

            <TabsContent value="details" className="mt-4">
              <div className="grid gap-6">
                <div className="border border-border bg-card p-4 sm:p-6">
                  <FieldGrid deal={deal} editing={editing} onDone={() => setEditing(false)} />
                </div>
                <div className="border border-border bg-card p-4 sm:p-6">
                  <LinkedContacts dealId={deal.id} links={contacts} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <div className="grid gap-4">
                <UploadDropzone dealId={deal.id} />
                <FileList attachments={attachments} canDelete={canDeleteFiles} />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Decision rail */}
        <aside className="min-w-0 space-y-6">
          <section className="border border-border bg-card p-4" aria-label="Stakeholders">
            <div className="df-section-rule">
              <h4>Stakeholders</h4>
              <span>{contacts.length}</span>
            </div>
            {contacts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No contacts linked yet.
              </p>
            ) : (
              <div className="mt-1">
                {contacts.map(({ contact, role }) => (
                  <div key={contact.id} className="df-stakeholder">
                    <span className="flex h-[25px] w-[25px] items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground">
                      {initials(`${contact.first_name} ${contact.last_name}`)}
                    </span>
                    <p className="min-w-0">
                      <Link href={`/contacts/${contact.id}`} className="block truncate text-[13px] font-semibold hover:underline">
                        {contact.first_name} {contact.last_name}
                      </Link>
                      <small className="block truncate text-[11px] text-muted-foreground">
                        {contact.title ?? "No title"}
                      </small>
                    </p>
                    <em>{role ?? "—"}</em>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="df-facts" aria-label="Deal facts">
            <div>
              <span>Stage</span>
              <b>{stage?.name ?? "—"}</b>
            </div>
            <div>
              <span>Close target</span>
              <b className="tnum">{deal.close_date ? formatDate(`${deal.close_date}T12:00:00`) : "—"}</b>
            </div>
            <div>
              <span>Probability</span>
              <b className="tnum">{probability != null ? `${probability}%` : "—"}</b>
            </div>
            <div>
              <span>Value</span>
              <b className="tnum">{formatCurrency(deal.value, deal.currency)}</b>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function DealDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-md bg-muted" />
      <div className="h-64 animate-pulse rounded-md bg-muted" />
    </div>
  );
}

export function DealNotFound() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <EmptyState
        title="Deal not found"
        description="It may have been deleted, or you don't have access to it."
        illustration="search"
        action={
          <Button asChild>
            <Link href="/pipeline">Back to pipeline</Link>
          </Button>
        }
      />
    </div>
  );
}
