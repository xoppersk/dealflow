"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ActivityComposer } from "@/components/activities/activity-composer";
import { LogOutcomeDialog } from "@/components/activities/log-outcome-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { CloseDealDialog } from "@/components/pipeline/close-deal-dialog";
import { DealActionsMenu } from "@/components/deals/deal-actions-menu";
import { FieldGrid } from "@/components/deals/field-grid";
import { FileList } from "@/components/deals/file-list";
import { LinkedContacts } from "@/components/deals/linked-contacts";
import { UploadDropzone } from "@/components/deals/upload-dropzone";
import { moveDeal } from "@/lib/actions/pipeline";
import { checkStageMove } from "@/lib/domain/stage-rules";
import {
  daysInStage,
  formatCompactCurrency,
  formatLongDate,
  formatTimeOfDay,
  initials,
} from "@/lib/format";
import type { DealDetailData } from "@/lib/actions/deals";
import type { PipelineStageRow, UserRole } from "@/lib/supabase/types";
import type { TimelineEntry } from "@/lib/types";

interface DealDetailViewProps {
  data: DealDetailData;
  stages: PipelineStageRow[];
  currentUser: { id: string; name: string; avatarUrl: string | null; role: UserRole };
}

/** Forecast category from the effective probability (artifact: 78% → Commit). */
function forecastLabel(probability: number | null): string {
  if (probability == null) return "—";
  if (probability >= 70) return "Commit";
  if (probability >= 40) return "Best case";
  return "Pipeline";
}

export function DealDetailView({ data, stages, currentUser }: DealDetailViewProps) {
  const router = useRouter();
  const { deal, company, owner, stage, contacts, attachments, stageHistory, activities } = data;
  const [editing, setEditing] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [closeStage, setCloseStage] = useState<PipelineStageRow | null>(null);
  const [advancing, setAdvancing] = useState(false);

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

  /** Hero next step: the nearest open follow-up (signature: Bracken Works). */
  const nextStep = useMemo(
    () =>
      activities
        .filter((a) => a.is_follow_up && !a.completed_at && a.due_at)
        .sort((a, b) =>
          (a.due_at as string).localeCompare(b.due_at as string),
        )[0] ?? null,
    [activities],
  );

  const days = daysInStage(deal.stage_entered_at);
  const probability = deal.probability ?? stage?.default_probability ?? null;
  const canDeleteFiles = deal.owner_id === currentUser.id || currentUser.role === "admin";

  // ---- Advance to contract --------------------------------------------------
  const openStages = useMemo(
    () =>
      stages
        .filter((s) => !s.is_closed_won && !s.is_closed_lost)
        .sort((a, b) => a.position - b.position),
    [stages],
  );
  const advanceTarget = useMemo(() => {
    const currentPos = stage?.position ?? -1;
    return (
      openStages.find((s) => s.position > currentPos) ??
      stages.find((s) => s.is_closed_won) ??
      null
    );
  }, [openStages, stages, stage]);

  async function commitAdvance(toStageId: string, closeConfirmed: boolean) {
    setAdvancing(true);
    try {
      const result = await moveDeal({
        dealId: deal.id,
        toStageId,
        version: deal.version,
        closeConfirmed,
      });
      if (result.ok) {
        const name = stages.find((s) => s.id === toStageId)?.name ?? "the new stage";
        toast.success(`Deal moved to ${name}.`);
        router.refresh();
        return;
      }
      if (result.error === "VERSION_CONFLICT") {
        toast.warning("This deal was just moved by a teammate — your change wasn't applied.");
        router.refresh();
        return;
      }
      if (result.error === "CLOSE_CONFIRMATION_REQUIRED") {
        const target = stages.find((s) => s.id === toStageId);
        if (target) setCloseStage(target);
        return;
      }
      toast.error(result.error);
    } finally {
      setAdvancing(false);
    }
  }

  function handleAdvance() {
    if (!advanceTarget || !stage) return;
    const verdict = checkStageMove({
      fromStage: stage,
      toStage: advanceTarget,
      closeConfirmed: false,
    });
    if (!verdict.ok) {
      toast.error(verdict.reason);
      return;
    }
    if (verdict.requiresCloseConfirmation) {
      setCloseStage(advanceTarget);
      return;
    }
    void commitAdvance(advanceTarget.id, false);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Header — deal ledger (flagship-ui-designs, Dealflow / Screens) */}
      <header className="df-deal-head">
        <div className="min-w-0">
          <p className="df-kicker">
            Deal · {company ? company.name : "No company"}
          </p>
          <h3>{deal.name}</h3>
          <p className="deal-sub">
            {deal.description ? `${deal.description} · ` : ""}
            owned by {owner?.full_name ?? "Unknown"}
          </p>
        </div>
        <div className="df-ticket-value shrink-0">
          <span>Ticket value</span>
          <strong>{formatCompactCurrency(Number(deal.value), deal.currency)}</strong>
          <small>
            {days} {days === 1 ? "day" : "days"} in {stage?.name ?? "—"}
          </small>
        </div>
      </header>

      {/* Action bar — sentence-case deal actions */}
      <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Deal actions">
        <ActivityComposer
          dealId={deal.id}
          defaultType="note"
          trigger={
            <Button variant="outline" size="sm" className="h-11 min-h-11 px-4">
              Log note
            </Button>
          }
        />
        <ActivityComposer
          dealId={deal.id}
          trigger={
            <Button variant="outline" size="sm" className="h-11 min-h-11 px-4">
              Add activity
            </Button>
          }
        />
        {advanceTarget && (
          <Button
            size="sm"
            className="h-11 min-h-11 px-4"
            disabled={advancing}
            onClick={handleAdvance}
          >
            Advance to contract
          </Button>
        )}
        <DealActionsMenu deal={deal} stages={stages} role={currentUser.role} currentUserId={currentUser.id} />
      </nav>

      {/* Body: next step + timeline | stakeholders + facts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <main className="grid min-w-0 content-start gap-6 lg:col-span-2">
          {nextStep && (
            <section className="df-next-step" aria-label="Next step">
              <span>
                Next step ·{" "}
                {new Date(nextStep.due_at as string).getTime() <
                new Date(new Date().toDateString()).getTime()
                  ? `overdue ${formatLongDate(nextStep.due_at as string)}`
                  : `due ${formatLongDate(nextStep.due_at as string)}`}
              </span>
              <h4>{nextStep.subject ?? "Follow up"}</h4>
              {nextStep.body && <p>{nextStep.body}</p>}
              <Button size="sm" className="h-11 min-h-11 px-4" onClick={() => setOutcomeOpen(true)}>
                Mark ready for review
              </Button>
            </section>
          )}

          <section className="border border-border bg-card p-4 sm:p-5" aria-label="Activity timeline">
            <div className="df-section-rule">
              <h4>Activity timeline</h4>
              <span>{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
            </div>
            {entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No activity yet — log the first call to start this timeline.
              </p>
            ) : (
              <div className="df-timeline">
                {entries.map((entry) => (
                  <article key={entry.id}>
                    <time>
                      {formatLongDate(entry.occurredAt)} · {formatTimeOfDay(entry.occurredAt)}
                    </time>
                    <div className="min-w-0">
                      <b className="block">{entry.subject ?? "Activity"}</b>
                      {entry.body && <p>{entry.body}</p>}
                    </div>
                    <span className="timeline-actor" title={entry.actorName}>
                      {initials(entry.actorName)}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </main>

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
              <b className="tnum">
                {deal.close_date ? formatLongDate(`${deal.close_date}T12:00:00`) : "—"}
              </b>
            </div>
            <div>
              <span>Probability</span>
              <b className="tnum">{probability != null ? `${probability}%` : "—"}</b>
            </div>
            <div>
              <span>Forecast</span>
              <b>{forecastLabel(probability)}</b>
            </div>
          </section>
        </aside>
      </div>

      {/* Records: editable fields + files (kept below the ledger) */}
      <section aria-label="Deal records">
        <div className="df-section-rule">
          <h4>Records</h4>
          <span>Fields and files</span>
        </div>
        <Tabs defaultValue="details" className="mt-4">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="files">Files ({attachments.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4">
            <div className="border border-border bg-card p-4 sm:p-6">
              <div className="mb-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
                  {editing ? "Done" : "Edit"}
                </Button>
              </div>
              <FieldGrid deal={deal} editing={editing} onDone={() => setEditing(false)} />
            </div>
            <div className="mt-4 border border-border bg-card p-4 sm:p-6">
              <LinkedContacts dealId={deal.id} links={contacts} />
            </div>
          </TabsContent>
          <TabsContent value="files" className="mt-4">
            <div className="grid gap-4">
              <UploadDropzone dealId={deal.id} />
              <FileList attachments={attachments} canDelete={canDeleteFiles} />
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {nextStep && (
        <LogOutcomeDialog
          activityId={nextStep.id}
          open={outcomeOpen}
          onOpenChange={setOutcomeOpen}
          onDone={() => router.refresh()}
        />
      )}

      {closeStage && (
        <CloseDealDialog
          deal={{
            id: deal.id,
            name: deal.name,
            value: Number(deal.value),
            currency: deal.currency,
          }}
          stage={{
            id: closeStage.id,
            name: closeStage.name,
            isClosedWon: closeStage.is_closed_won,
            isClosedLost: closeStage.is_closed_lost,
          }}
          open
          onOpenChange={(open) => {
            if (!open) setCloseStage(null);
          }}
          onConfirm={() => {
            setCloseStage(null);
            void commitAdvance(closeStage.id, true);
          }}
        />
      )}
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
