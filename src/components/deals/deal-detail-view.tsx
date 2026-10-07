"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { ActivityComposer } from "@/components/activities/activity-composer";
import { Timeline } from "@/components/activities/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DaysInStageBadge } from "@/components/shared/days-in-stage-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { MoveStageMenu } from "@/components/pipeline/move-stage-menu";
import { DealActionsMenu } from "@/components/deals/deal-actions-menu";
import { FieldGrid } from "@/components/deals/field-grid";
import { FileList } from "@/components/deals/file-list";
import { LinkedContacts } from "@/components/deals/linked-contacts";
import { PresenceStack } from "@/components/deals/presence-stack";
import { UploadDropzone } from "@/components/deals/upload-dropzone";
import { usePresence } from "@/lib/realtime/channels";
import { daysInStage, formatCurrency, formatDate, relativeTime } from "@/lib/format";
import type { DealDetailData } from "@/lib/actions/deals";
import type { PipelineStageRow, UserRole } from "@/lib/supabase/types";
import type { TimelineEntry } from "@/lib/types";

interface DealDetailViewProps {
  data: DealDetailData;
  stages: PipelineStageRow[];
  currentUser: { id: string; name: string; avatarUrl: string | null; role: UserRole };
}

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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{deal.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {company ? (
                <Link href={`/companies/${company.id}`} className="font-medium text-foreground hover:underline">
                  {company.name}
                </Link>
              ) : (
                <span>No company linked</span>
              )}
              <Badge variant="secondary" className="gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor }} />
                {stage?.name ?? "No stage"}
              </Badge>
              <span className="tnum text-base font-semibold text-foreground">
                {formatCurrency(deal.value, deal.currency)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {owner && (
                <span className="flex items-center gap-1.5">
                  <UserAvatar userId={owner.id} name={owner.full_name} avatarUrl={owner.avatar_url} size="sm" />
                  {owner.full_name}
                </span>
              )}
              <span>
                Closes {deal.close_date ? formatDate(`${deal.close_date}T12:00:00`) : "—"}
              </span>
              <DaysInStageBadge days={daysInStage(deal.stage_entered_at)} />
              {deal.closed_at && (
                <Badge variant="outline">Closed {relativeTime(deal.closed_at)}</Badge>
              )}
            </div>
          </div>
          <PresenceStack users={others} />
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2">
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

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="files">Files ({attachments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <div className="grid gap-4">
            <Card className="p-4">
              <ActivityComposer dealId={deal.id} />
            </Card>
            <Timeline entries={entries} />
          </div>
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <div className="grid gap-6">
            <Card className="p-4 sm:p-6">
              <FieldGrid deal={deal} editing={editing} onDone={() => setEditing(false)} />
            </Card>
            <Card className="p-4 sm:p-6">
              <LinkedContacts dealId={deal.id} links={contacts} />
            </Card>
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
  );
}

export function DealDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-lg bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

export function DealNotFound() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
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
