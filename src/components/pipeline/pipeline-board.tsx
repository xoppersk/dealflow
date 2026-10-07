"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  BoardFilters,
  matchesValueRange,
} from "@/components/pipeline/board-filters";
import { CloseDealDialog } from "@/components/pipeline/close-deal-dialog";
import { DealCard } from "@/components/pipeline/deal-card";
import { StageColumn } from "@/components/pipeline/stage-column";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PresenceStack } from "@/components/shared/presence-stack";
import { Button } from "@/components/ui/button";
import {
  getBoardData,
  moveDeal,
  type MoveDealResult,
  type PipelineDatabase,
} from "@/lib/actions/pipeline";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkStageMove } from "@/lib/domain/stage-rules";
import { conflictToastMessage, mergeServerRow } from "@/lib/domain/conflict";
import { createClient } from "@/lib/supabase/client";
import {
  useDealsChannel,
  usePresence,
  useStagesChannel,
  type DealChangePayload,
  type PresenceUser,
} from "@/lib/realtime/channels";
import type { DealCardData, StageColumnData } from "@/lib/types";
import type { PipelineStageRow } from "@/lib/supabase/types";

const DRAG_STYLES = `
.drag-lift {
  box-shadow: 0 24px 48px -12px rgb(0 0 0 / 0.28);
  transform: scale(1.02) rotate(1deg);
}
.drop-glow {
  box-shadow: inset 0 0 0 2px var(--primary);
  background: color-mix(in srgb, var(--primary) 7%, transparent);
}
@keyframes dealflow-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
.remote-pulse {
  animation: dealflow-pulse 0.8s ease-in-out 2;
}
@media (prefers-reduced-motion: reduce) {
  .remote-pulse { animation: none; }
}
`;

/** Adapter for the shared domain rule (only id/closed flags are read). */
function asRow(stage: StageColumnData): PipelineStageRow {
  return {
    id: stage.id,
    name: stage.name,
    position: stage.position,
    color: stage.color,
    is_closed_won: stage.isClosedWon,
    is_closed_lost: stage.isClosedLost,
    default_probability: stage.defaultProbability,
    created_at: "",
    updated_at: "",
  };
}

interface PipelineBoardProps {
  initialStages: StageColumnData[];
  initialDeals: DealCardData[];
  totalCount: number;
  user: { id: string; name: string; avatarUrl: string | null };
}

/**
 * Kanban pipeline board (APP-FLOW.md Flow A + Flow F).
 *
 * DndContext with per-column SortableContexts, optimistic drags, and
 * realtime reconciliation: remote moves patch local state (mergeServerRow),
 * name the mover in a toast, and pulse the card. Version conflicts surface
 * the reconciliation toast with Retry + View history.
 */
export function PipelineBoard({
  initialStages,
  initialDeals,
  totalCount: initialTotalCount,
  user,
}: PipelineBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [stages, setStages] = useState(initialStages);
  const [deals, setDeals] = useState(initialDeals);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [activeDeal, setActiveDeal] = useState<DealCardData | null>(null);
  const [closeDialog, setCloseDialog] = useState<{
    dealId: string;
    fromStageId: string;
    toStageId: string;
  } | null>(null);
  const [pulsingIds, setPulsingIds] = useState<ReadonlySet<string>>(new Set());

  // Refs so the realtime handler (captured once) always sees fresh state.
  const dealsRef = useRef(deals);
  dealsRef.current = deals;
  const stagesRef = useRef(stages);
  stagesRef.current = stages;
  const activeDealRef = useRef<DealCardData | null>(null);
  activeDealRef.current = activeDeal;
  const dragSnapshot = useRef<DealCardData[] | null>(null);
  /** In-flight moves: dealId -> the stage I moved it to (own echos aren't news). */
  const myMoves = useRef<Map<string, string>>(new Map());
  /** Realtime toast ids per deal, so a conflict toast can supersede them. */
  const realtimeToastIds = useRef<Map<string, string | number>>(new Map());
  /** dealId -> server version already explained via a conflict toast. */
  const conflictToasted = useRef<Map<string, number>>(new Map());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Board-level presence: teammates viewing the pipeline right now.
  const self: PresenceUser = useMemo(
    () => ({ userId: user.id, name: user.name, avatarUrl: user.avatarUrl }),
    [user.id, user.name, user.avatarUrl],
  );
  const viewingNow = usePresence("workspace:deals", self);
  useStagesChannel();

  // ---- filters (URL-synced) ---------------------------------------------
  const ownerFilter = searchParams.get("owner");
  const queryFilter = (searchParams.get("q") ?? "").toLowerCase();
  const valueFilter = searchParams.get("value") ?? "all";
  const hasFilters =
    ownerFilter !== null || queryFilter !== "" || valueFilter !== "all";

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of deals) {
      if (!map.has(d.ownerId)) map.set(d.ownerId, d.ownerName);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [deals]);

  const filteredDeals = useMemo(
    () =>
      deals.filter((d) => {
        if (ownerFilter && d.ownerId !== ownerFilter) return false;
        if (!matchesValueRange(d.value, valueFilter)) return false;
        if (
          queryFilter &&
          !`${d.name} ${d.companyName ?? ""}`.toLowerCase().includes(queryFilter)
        )
          return false;
        return true;
      }),
    [deals, ownerFilter, queryFilter, valueFilter],
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, DealCardData[]>();
    for (const s of stages) map.set(s.id, []);
    for (const d of filteredDeals) map.get(d.stageId)?.push(d);
    for (const list of map.values()) {
      list.sort((a, b) => a.boardPosition - b.boardPosition);
    }
    return map;
  }, [stages, filteredDeals]);

  function clearFilters() {
    router.replace(pathname, { scroll: false });
  }

  // ---- realtime -----------------------------------------------------------
  function pulse(dealId: string) {
    setPulsingIds((prev) => new Set(prev).add(dealId));
    setTimeout(() => {
      setPulsingIds((prev) => {
        const next = new Set(prev);
        next.delete(dealId);
        return next;
      });
    }, 1700);
  }

  async function fetchMoverName(dealId: string): Promise<string> {
    try {
      // Same Relationships inference gap as the server actions (see pipeline.ts).
      const supabase = createClient() as unknown as SupabaseClient<PipelineDatabase>;
      const { data: entry } = await supabase
        .from("stage_history")
        .select("changed_by")
        .eq("deal_id", dealId)
        .order("changed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!entry) return "A teammate";
      const { data: mover } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", entry.changed_by)
        .maybeSingle();
      return mover?.full_name ?? "A teammate";
    } catch {
      return "A teammate";
    }
  }

  /** Map a realtime row payload onto a card, keeping joined display fields. */
  function cardFromRow(
    local: DealCardData,
    row: Record<string, unknown>,
  ): DealCardData {
    return {
      ...local,
      stageId:
        typeof row.stage_id === "string" ? row.stage_id : local.stageId,
      version:
        typeof row.version === "number" ? row.version : local.version,
      stageEnteredAt:
        typeof row.stage_entered_at === "string"
          ? row.stage_entered_at
          : local.stageEnteredAt,
      lastTouchedAt:
        typeof row.last_touched_at === "string"
          ? row.last_touched_at
          : local.lastTouchedAt,
      boardPosition:
        typeof row.board_position === "number"
          ? row.board_position
          : local.boardPosition,
      value: Number(row.value ?? local.value),
      name: typeof row.name === "string" ? row.name : local.name,
      probability:
        row.probability == null ? null : Number(row.probability),
      closeDate:
        typeof row.close_date === "string" ? row.close_date : local.closeDate,
    };
  }

  async function handleRemoteChange(payload: DealChangePayload) {
    const eventType = payload.eventType;

    if (eventType === "INSERT") {
      // A teammate created a deal — refetch unless a drag is in flight.
      if (activeDealRef.current || myMoves.current.size > 0) return;
      const result = await getBoardData();
      if (result.ok) {
        setStages(result.data.stages);
        setDeals(result.data.deals);
        setTotalCount(result.data.totalCount);
      }
      return;
    }

    if (eventType === "DELETE") {
      const oldRow = payload.old as Record<string, unknown> | null;
      const id = typeof oldRow?.id === "string" ? oldRow.id : null;
      if (id) setDeals((prev) => prev.filter((d) => d.id !== id));
      return;
    }

    if (eventType !== "UPDATE") return;
    const row = payload.new as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : null;
    if (!id) return;

    const local = dealsRef.current.find((d) => d.id === id);
    if (!local) return;

    // Server row always wins when it is newer (TECHNICAL-REQUIREMENTS.md §6).
    const next = mergeServerRow(local, cardFromRow(local, row));
    if (next === local) return;
    setDeals((prev) => prev.map((d) => (d.id === id ? next : d)));

    if (next.stageId === local.stageId) return;

    const myTarget = myMoves.current.get(id);
    if (myTarget !== undefined) {
      myMoves.current.delete(id);
      // Our own move echoing back — not news. Anything else is a teammate
      // moving it again (possibly while our own move is still in flight).
      if (next.stageId === myTarget) return;
    }
    // Already explained via a conflict toast — don't double-notify.
    if (conflictToasted.current.get(id) === next.version) return;

    const mover = await fetchMoverName(id);
    const stageName =
      stagesRef.current.find((s) => s.id === next.stageId)?.name ??
      "another stage";
    const toastId = toast(`${mover} moved ${next.name} to ${stageName}.`);
    realtimeToastIds.current.set(id, toastId);
    pulse(id);
  }

  const remoteHandler = useRef((payload: DealChangePayload) => {
    void payload;
  });
  remoteHandler.current = (payload) => {
    void handleRemoteChange(payload);
  };
  useDealsChannel(
    useCallback((p: DealChangePayload) => remoteHandler.current(p), []),
  );

  // ---- moves ----------------------------------------------------------------
  function stageOfDeal(
    dealId: string,
    list: DealCardData[],
  ): string | undefined {
    return list.find((d) => d.id === dealId)?.stageId;
  }

  /**
   * Commit a stage move: optimistic UI, version-guarded Server Action, then
   * reconcile. `snapshot` restores the board on failure. `versionOverride`
   * pins the version for retries (state may not have flushed yet).
   */
  async function commitMove(
    dealId: string,
    fromStageId: string,
    toStageId: string,
    closeConfirmed: boolean,
    snapshot: DealCardData[] | null,
    versionOverride?: number,
  ) {
    const local = dealsRef.current.find((d) => d.id === dealId);
    const stagesNow = stagesRef.current;
    const toStage = stagesNow.find((s) => s.id === toStageId);
    const version = versionOverride ?? local?.version;
    if (local == null || toStage == null || version == null) {
      if (snapshot) setDeals(snapshot);
      return;
    }

    // Optimistic: the card is already there from the drag; no-op otherwise.
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, stageId: toStageId } : d,
      ),
    );

    myMoves.current.set(dealId, toStageId);
    setTimeout(() => myMoves.current.delete(dealId), 10_000);
    const result: MoveDealResult = await moveDeal({
      dealId,
      toStageId,
      version,
      closeConfirmed,
    });

    if (result.ok) {
      // A teammate may have moved it again while our request was in flight —
      // never clobber a newer server row with our older result.
      const cur = dealsRef.current.find((d) => d.id === dealId);
      const stale = cur != null && result.data.version < cur.version;
      if (!stale) {
        setDeals((prev) => prev.map((d) => (d.id === dealId ? result.data : d)));
      }
      dragSnapshot.current = null;
      if (!stale) {
        const isClose = toStage.isClosedWon || toStage.isClosedLost;
        toast.success(`Deal moved to ${toStage.name}.`, {
          duration: 5000,
          // Undo would leave a closed stage — blocked by design, so no Undo.
          action: isClose
            ? undefined
            : {
                label: "Undo",
                onClick: () => {
                  const snap = dealsRef.current;
                  void commitMove(dealId, toStageId, fromStageId, false, snap);
                },
              },
        });
      }
      return;
    }

    if (result.error === "VERSION_CONFLICT" && "data" in result) {
      const fresh = result.data;
      setDeals((prev) => prev.map((d) => (d.id === dealId ? fresh : d)));
      dragSnapshot.current = null;
      // Dismiss the plain realtime toast if it already announced this move —
      // the conflict toast below supersedes it (it carries Retry).
      const realtimeToastId = realtimeToastIds.current.get(dealId);
      if (realtimeToastId !== undefined) {
        toast.dismiss(realtimeToastId);
        realtimeToastIds.current.delete(dealId);
      }
      conflictToasted.current.set(dealId, fresh.version);
      const mover = await fetchMoverName(dealId);
      const stageName =
        stagesRef.current.find((s) => s.id === fresh.stageId)?.name ??
        "another stage";
      toast.warning(
        conflictToastMessage({
          moverName: mover,
          dealName: fresh.name,
          stageName,
        }),
        {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => {
              const snap = dealsRef.current;
              setDeals((prev) =>
                prev.map((d) =>
                  d.id === dealId
                    ? { ...d, stageId: toStageId, version: fresh.version }
                    : d,
                ),
              );
              void commitMove(
                dealId,
                fresh.stageId,
                toStageId,
                closeConfirmed,
                snap,
                fresh.version,
              );
            },
          },
          description: (
            <a
              href={`/deals/${dealId}`}
              className="underline underline-offset-2"
            >
              View history
            </a>
          ),
        },
      );
      return;
    }

    if (result.error === "CLOSE_CONFIRMATION_REQUIRED") {
      // The dialog gates this; recover defensively.
      setCloseDialog({ dealId, fromStageId, toStageId });
      return;
    }

    // Other failures: snap back, offer retry.
    if (snapshot) setDeals(snapshot);
    dragSnapshot.current = null;
    toast.error(result.error, {
      action: {
        label: "Retry",
        onClick: () => {
          const snap = dealsRef.current;
          setDeals((prev) =>
            prev.map((d) => (d.id === dealId ? { ...d, stageId: toStageId } : d)),
          );
          void commitMove(dealId, fromStageId, toStageId, closeConfirmed, snap);
        },
      },
    });
  }

  // ---- dnd-kit ---------------------------------------------------------------
  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      | { deal?: DealCardData }
      | undefined;
    if (data?.deal) {
      setActiveDeal(data.deal);
      dragSnapshot.current = dealsRef.current;
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const current = dealsRef.current;
    const fromStageId = stageOfDeal(activeId, current);
    const overStageId = stagesRef.current.some((s) => s.id === overId)
      ? overId
      : stageOfDeal(overId, current);
    if (!fromStageId || !overStageId || fromStageId === overStageId) return;

    // Optimistic cross-column move; the server commit happens on drop.
    setDeals((prev) => {
      const moving = prev.find((d) => d.id === activeId);
      if (!moving || moving.stageId === overStageId) return prev;
      return prev.map((d) =>
        d.id === activeId
          ? { ...d, stageId: overStageId, boardPosition: Number.MAX_SAFE_INTEGER }
          : d,
      );
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { over } = event;
    const data = event.active.data.current as
      | { deal?: DealCardData }
      | undefined;
    const deal = data?.deal;
    setActiveDeal(null);

    const snapshot = dragSnapshot.current;
    dragSnapshot.current = null;
    if (!deal) return;

    const fromStageId =
      snapshot?.find((d) => d.id === deal.id)?.stageId ?? deal.stageId;

    if (!over) {
      if (snapshot) setDeals(snapshot);
      return;
    }

    const overId = String(over.id);
    const toStageId = stagesRef.current.some((s) => s.id === overId)
      ? overId
      : stageOfDeal(overId, dealsRef.current);

    if (!toStageId || toStageId === fromStageId) {
      if (toStageId === fromStageId && overId !== deal.id) {
        // Same-column reorder: local only for now.
        setDeals((prev) => {
          const ids = prev
            .filter((d) => d.stageId === fromStageId)
            .sort((a, b) => a.boardPosition - b.boardPosition)
            .map((d) => d.id);
          const oldIndex = ids.indexOf(deal.id);
          const newIndex = ids.indexOf(overId);
          if (oldIndex < 0 || newIndex < 0) return prev;
          const order = new Map(
            arrayMove(ids, oldIndex, newIndex).map((id, i) => [id, i] as const),
          );
          return prev.map((d) =>
            d.stageId === fromStageId
              ? { ...d, boardPosition: order.get(d.id) ?? d.boardPosition }
              : d,
          );
        });
      } else if (snapshot) {
        setDeals(snapshot);
      }
      return;
    }

    const stagesNow = stagesRef.current;
    const fromStage = stagesNow.find((s) => s.id === fromStageId);
    const toStage = stagesNow.find((s) => s.id === toStageId);
    if (!fromStage || !toStage) {
      if (snapshot) setDeals(snapshot);
      return;
    }

    // Client-side mirror of the server rules (fast, friendly rejections).
    const verdict = checkStageMove({
      fromStage: asRow(fromStage),
      toStage: asRow(toStage),
      closeConfirmed: false,
    });
    if (!verdict.ok) {
      if (snapshot) setDeals(snapshot);
      toast.error(verdict.reason);
      return;
    }
    if (verdict.requiresCloseConfirmation) {
      // Keep the optimistic position; confirm won/lost first.
      setCloseDialog({ dealId: deal.id, fromStageId, toStageId });
      return;
    }

    void commitMove(deal.id, fromStageId, toStageId, false, snapshot);
  }

  function onDragCancel() {
    const snapshot = dragSnapshot.current;
    dragSnapshot.current = null;
    setActiveDeal(null);
    if (snapshot) setDeals(snapshot);
  }

  // ---- render ------------------------------------------------------------------
  const closeDeal =
    closeDialog != null
      ? deals.find((d) => d.id === closeDialog.dealId)
      : undefined;
  const closeStage =
    closeDialog != null
      ? stages.find((s) => s.id === closeDialog.toStageId)
      : undefined;

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      <style>{DRAG_STYLES}</style>

      <PageHeader
        title="Pipeline"
        description="Drag deals between stages. Changes sync live for the whole team."
        actions={<PresenceStack users={viewingNow} />}
      />

      <BoardFilters owners={owners} />

      {totalCount > deals.length && (
        <p
          role="status"
          className="rounded-lg border bg-muted/60 px-3 py-2 text-xs text-muted-foreground"
        >
          Showing {deals.length} of {totalCount.toLocaleString()} deals —
          refine filters to see more.
        </p>
      )}

      {stages.length === 0 ? (
        <EmptyState
          illustration="deal"
          title="No pipeline stages"
          description="Ask a manager to configure stages in settings before adding deals."
        />
      ) : deals.length === 0 && !hasFilters ? (
        <EmptyState
          illustration="deal"
          title="No deals yet"
          description="Deals you create will appear here as cards you can drag between stages."
        />
      ) : filteredDeals.length === 0 ? (
        <EmptyState
          illustration="search"
          title="No deals match these filters"
          description="Try widening the value range or clearing the search."
          action={
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage.get(stage.id) ?? []}
                pulsingDealIds={pulsingIds}
              />
            ))}
            <DragOverlay>
              {activeDeal ? <DealCard deal={activeDeal} overlay /> : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {closeDialog && closeDeal && closeStage && (
        <CloseDealDialog
          deal={closeDeal}
          stage={closeStage}
          open
          onOpenChange={(open) => {
            if (!open) {
              const snapshot = dragSnapshot.current;
              dragSnapshot.current = null;
              if (snapshot) setDeals(snapshot);
              setCloseDialog(null);
            }
          }}
          onConfirm={() => {
            const { dealId, fromStageId, toStageId } = closeDialog;
            const snapshot = dragSnapshot.current;
            dragSnapshot.current = null;
            setCloseDialog(null);
            void commitMove(dealId, fromStageId, toStageId, true, snapshot);
          }}
        />
      )}
    </div>
  );
}
