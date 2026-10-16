"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  closed,
  companyById,
  deals as fixtureDeals,
  isOpenDeal,
  openStages,
  openTotal,
  personById,
  stageById,
  stageTotal,
  weightedTotal,
} from "@/lib/df/api";
import { emitEvent, seedMoveEvent } from "@/lib/df/events";
import { moneyCompact } from "@/lib/df/format";
import { checkMove, missingRequirements } from "@/lib/df/rules";
import type { Deal, Stage } from "@/lib/df/types";
import { CommandPalette } from "../command-palette";
import { ConfirmLost } from "../confirm-lost";
import { DealCard, StageHeader } from "../deal-card";
import { AlertIcon, ClockWatchIcon, PlusIcon, PulseIcon } from "../icons";
import { OwnerAvatar, Segmented } from "../primitives";
import { StageErrorCard } from "../system/stage-error";
import { DealPanel } from "./deal-panel";
import { MoveMenu } from "./move-menu";

type OwnerFilter = "everyone" | "mine";
type ViewMode = "board" | "list";

type ToastState =
  | {
      kind: "move";
      byId: string;
      byFirstName: string;
      companyName: string;
      toStageName: string;
      agoLabel: string;
      undoDeal: Deal | null;
    }
  | { kind: "message"; text: string };

const YOU = "sheku-koroma";
const seedDeal = seedMoveEvent.kind === "deal-moved" ? seedMoveEvent : null;

function resolveDeal(param: string | undefined, list: Deal[]): Deal | undefined {
  if (!param) return undefined;
  return list.find((d) => d.id === param) ?? list.find((d) => d.companyId === param);
}

/* ---------------- draggable / droppable wrappers ---------------- */

function DraggableCard({
  deal,
  selected,
  onSelect,
  onPlanNextStep,
}: {
  deal: Deal;
  selected: boolean;
  onSelect: (d: Deal) => void;
  onPlanNextStep: (d: Deal) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  return (
    <DealCard
      deal={deal}
      selected={selected}
      onSelect={onSelect}
      onPlanNextStep={onPlanNextStep}
      drag={{
        ref: setNodeRef,
        listeners: listeners as unknown as Record<string, unknown>,
        attributes: attributes as unknown as Record<string, unknown>,
        style: {
          transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
          opacity: isDragging ? 0.55 : undefined,
          zIndex: isDragging ? 5 : undefined,
        },
        isDragging,
      }}
    />
  );
}

function DroppableColumn({
  stage,
  children,
  headingId,
}: {
  stage: Stage;
  children: ReactNode;
  headingId: string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      className={`col${isOver ? " drop-over" : ""}`}
      aria-labelledby={headingId}
      data-stage-id={stage.id}
    >
      {children}
    </section>
  );
}

/* ---------------- board ---------------- */

export function BoardClient({
  dealParam,
  ownerParam,
  viewParam,
  quarterParam,
  stateParam,
  paletteQuery,
  moveParam,
}: {
  dealParam?: string;
  ownerParam?: string;
  viewParam?: string;
  quarterParam?: string;
  stateParam?: string;
  paletteQuery?: string;
  moveParam?: string;
}) {
  const router = useRouter();
  const errorStageId = stateParam === "error" ? "proposal" : null;

  const [dealsState, setDealsState] = useState<Deal[]>(fixtureDeals);
  const [selectedId, setSelectedId] = useState<string>(
    () =>
      resolveDeal(dealParam, fixtureDeals)?.id ??
      resolveDeal("bracken-works", fixtureDeals)?.id ??
      fixtureDeals[0]!.id,
  );
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>(ownerParam === "me" ? "mine" : "everyone");
  const [view, setView] = useState<ViewMode>(viewParam === "list" ? "list" : "board");
  const [quarterOnly, setQuarterOnly] = useState<boolean>(quarterParam !== "0");
  const [toast, setToast] = useState<ToastState>(() => {
    if (!seedDeal) return { kind: "message", text: "" };
    // The seed toast's Undo reverts Maya's Solace move: the snapshot is the
    // fixture deal as it was back in Discovery.
    const solace = fixtureDeals.find((d) => d.id === seedDeal.dealId);
    const reverted: Deal | null = solace
      ? {
          ...solace,
          stageId: seedDeal.fromStageId,
          justMoved: undefined,
          enteredStageLabel: "9 days",
          daysInStage: 9,
        }
      : null;
    return {
      kind: "move",
      byId: seedDeal.byId,
      byFirstName: seedDeal.byName,
      companyName: seedDeal.companyName,
      toStageName: seedDeal.toStageName,
      agoLabel: seedDeal.agoLabel,
      undoDeal: reverted,
    };
  });
  const [lostDeal, setLostDeal] = useState<Deal | null>(null);
  const [moveMenu, setMoveMenu] = useState<{ dealId: string; x: number; y: number } | null>(null);
  const [requirement, setRequirement] = useState<{
    deal: Deal;
    toStageId: string;
    missing: string[];
  } | null>(null);
  const [reqStepText, setReqStepText] = useState("");
  const [reqStepDate, setReqStepDate] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(stateParam === "palette");
  const mainRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /* ----- derived, live-recomputed figures ----- */
  const countedDeals = useMemo(
    () => (errorStageId ? dealsState.filter((d) => d.stageId !== errorStageId) : dealsState),
    [dealsState, errorStageId],
  );
  const open = openTotal(countedDeals);
  const weighted = weightedTotal(countedDeals);
  const openCount = countedDeals.filter(isOpenDeal).length;
  /* Closed summary, live: the fixture's closed quarter plus any deals closed
     on this board in this session (DF-01). */
  const liveClosed = useMemo(() => {
    const won = closed.won + dealsState.filter((d) => d.stageId === "won").length;
    const lost = closed.lost + dealsState.filter((d) => d.stageId === "lost").length;
    return { won, lost, winRate: Math.round((won / (won + lost)) * 100) };
  }, [dealsState]);
  /* Deals that need a move before they can progress, from live state: no
     next step (Kestrel), a next step that blocks the contract (Bracken), or
     stale (Meridian). */
  const needsMoveDeals = useMemo(
    () =>
      dealsState.filter(
        (d) => isOpenDeal(d) && (!d.nextStep || d.nextStep.blocks || d.stale || d.nextStep.stale),
      ),
    [dealsState],
  );
  const needsMoveFor = (companyId: string) => needsMoveDeals.some((d) => d.companyId === companyId);
  const visibleDeals = useMemo(
    () => (ownerFilter === "mine" ? dealsState.filter((d) => d.ownerId === YOU) : dealsState),
    [dealsState, ownerFilter],
  );
  const selectedDeal =
    dealsState.find((d) => d.id === selectedId) ?? dealsState.find((d) => d.stageId !== "lost") ?? dealsState[0]!;

  /* ----- URL sync (filters, view, selected deal live in the URL, §10) ----- */
  const updateUrl = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.replace(qs ? `/app/pipeline?${qs}` : "/app/pipeline", { scroll: false });
    },
    [router],
  );

  const selectDeal = useCallback(
    (deal: Deal) => {
      setSelectedId(deal.id);
      updateUrl({ deal: deal.companyId });
    },
    [updateUrl],
  );

  /* ----- moving ----- */
  const doMove = useCallback(
    (deal: Deal, toStageId: string, nextStepOverride?: Deal["nextStep"]) => {
      const fromStageId = deal.stageId;
      const moved: Deal = {
        ...deal,
        stageId: toStageId,
        nextStep: nextStepOverride !== undefined ? nextStepOverride : deal.nextStep,
        daysInStage: 0,
        enteredStageLabel:
          toStageId === "won" || toStageId === "lost" ? deal.enteredStageLabel : `In ${stageById(toStageId).name} just now`,
        justMoved:
          toStageId === "won" || toStageId === "lost"
            ? undefined
            : { byId: YOU, fromStageId, toStageId, agoLabel: "just now" },
      };
      setDealsState((list) =>
        list.map((d) => (d.id === deal.id ? moved : d.justMoved ? { ...d, justMoved: undefined } : d)),
      );
      setSelectedId(deal.id);
      const company = companyById(deal.companyId);
      const toStage = stageById(toStageId);
      emitEvent({
        kind: "deal-moved",
        dealId: deal.id,
        dealName: deal.name,
        companyName: company.name,
        fromStageId,
        toStageId,
        toStageName: toStage.name,
        byId: YOU,
        byName: "You",
        agoLabel: "just now",
      });
      setToast({
        kind: "move",
        byId: YOU,
        byFirstName: "You",
        companyName: company.name,
        toStageName: toStage.name,
        agoLabel: "just now",
        undoDeal: deal,
      });
    },
    [],
  );

  const attemptMove = useCallback(
    (deal: Deal, toStageId: string) => {
      if (deal.stageId === toStageId) return;
      const verdict = checkMove(deal, toStageId);
      if (!verdict.ok) {
        setToast({ kind: "message", text: verdict.reason });
        emitEvent({ kind: "announce", message: verdict.reason });
        return;
      }
      if (verdict.needsLostConfirm) {
        setLostDeal(deal);
        return;
      }
      const missing = missingRequirements(deal, toStageId);
      if (missing.length > 0) {
        setRequirement({ deal, toStageId, missing });
        setReqStepText("");
        setReqStepDate("");
        return;
      }
      doMove(deal, toStageId);
    },
    [doMove],
  );

  function undoToast() {
    if (toast.kind !== "move" || !toast.undoDeal) return;
    const snapshot = toast.undoDeal;
    setDealsState((list) => list.map((d) => (d.id === snapshot.id ? snapshot : d)));
    const company = companyById(snapshot.companyId);
    const stage = stageById(snapshot.stageId);
    const msg = `${company.name} is back in ${stage.name}`;
    emitEvent({ kind: "announce", message: msg });
    setToast({ kind: "message", text: `Undone — ${msg}` });
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const deal = dealsState.find((d) => d.id === e.active.id);
    if (deal) attemptMove(deal, String(e.over.id));
  }

  /* ----- keyboard model (§11): M move, L log, N next step ----- */
  const openMoveMenu = useCallback(
    (deal: Deal, anchor?: DOMRect) => {
      selectDeal(deal);
      const rect =
        anchor ??
        mainRef.current
          ?.querySelector(`[data-deal-id="${deal.id}"]`)
          ?.getBoundingClientRect();
      setMoveMenu({
        dealId: deal.id,
        x: rect ? rect.left : 120,
        y: rect ? rect.bottom + 6 : 160,
      });
    },
    [selectDeal],
  );

  // ?move=1 (from the command palette's M action) opens the listbox on mount.
  const moveOpenedRef = useRef(false);
  useEffect(() => {
    if (moveParam !== "1" || moveOpenedRef.current) return;
    moveOpenedRef.current = true;
    const t = setTimeout(() => {
      const deal = dealsState.find((d) => d.id === selectedId);
      if (deal) openMoveMenu(deal);
    }, 60);
    return () => clearTimeout(t);
  }, [moveParam, dealsState, selectedId, openMoveMenu]);

  function onBoardKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, .move-menu")) return;
    const card = target.closest<HTMLElement>("[data-deal-id]");
    if (!card) return;
    const deal = dealsState.find((d) => d.id === card.dataset.dealId);
    if (!deal) return;
    const key = e.key.toLowerCase();
    if (key === "m") {
      e.preventDefault();
      openMoveMenu(deal, card.getBoundingClientRect());
    } else if (key === "l") {
      e.preventDefault();
      router.push(`/app/activities?deal=${deal.id}&log=1`);
    } else if (key === "n") {
      e.preventDefault();
      router.push(`/app/deals/${deal.companyId}?focus=next-step`);
    }
  }

  const moveMenuDeal = moveMenu ? dealsState.find((d) => d.id === moveMenu.dealId) : undefined;

  return (
    <>
      <div className="board-layout">
        <div className="board-main" ref={mainRef} onKeyDown={onBoardKeyDown}>
          {/* hero */}
          <div className="hero-row">
            <div>
              <button
                type="button"
                className="quarter-toggle"
                aria-pressed={quarterOnly}
                onClick={() => {
                  const next = !quarterOnly;
                  setQuarterOnly(next);
                  updateUrl({ quarter: next ? "1" : "0" });
                }}
                title="Toggle the Closing this quarter filter"
              >
                <i aria-hidden="true" />
                Closing this quarter · Tue, Oct 6
              </button>
              <h1 className="h1">Pipeline</h1>
            </div>
            <div className="kpi-row" role="group" aria-label="Pipeline totals">
              <div className="kpi">
                <small>Open</small>
                <b>{moneyCompact(open)}</b>
                <small>
                  {openCount} deals
                  {errorStageId ? ` · excludes ${stageById(errorStageId).name}` : ""}
                </small>
              </div>
              <div className="kpi">
                <small>Weighted</small>
                <b style={{ color: "var(--progress)" }}>{moneyCompact(weighted)}</b>
                <small>by stage win chance</small>
              </div>
              <div className="kpi">
                <small>Win rate</small>
                <b>{liveClosed.winRate}%</b>
                <small>
                  {liveClosed.won} won · {liveClosed.lost} lost
                </small>
              </div>
              <div className="kpi">
                <small>Cycle</small>
                <b>
                  {closed.averageDaysToClose}
                  <span className="unit"> days</span>
                </b>
                <small>won deals, avg</small>
              </div>
            </div>
          </div>

          {errorStageId ? (
            <p className="board-note" role="alert" style={{ margin: 0 }}>
              3 of 4 stages loaded. Totals below leave out Proposal until it loads.
            </p>
          ) : null}

          {/* flow band */}
          <section aria-label="Open value by stage" className="flow-wrap">
            <div className="flow" role="img" aria-label={openStages.map((s) => `${s.name} ${moneyCompact(stageTotal(countedDeals, s.id))}, weighted share ${s.winChance}%`).join("; ")}>
              {openStages.map((s) => (
                <div key={s.id} className="seg-bar" style={{ flex: Math.max(stageTotal(countedDeals, s.id) / 1000, 1) }}>
                  <i style={{ width: `${s.winChance}%` }} />
                </div>
              ))}
            </div>
            <div className="flow-labels">
              {openStages.map((s, i) => (
                <span key={s.id} style={{ flex: Math.max(stageTotal(countedDeals, s.id) / 1000, 1), display: "flex", gap: 4 }}>
                  {s.name} <b>{moneyCompact(stageTotal(countedDeals, s.id))}</b>
                  {i === openStages.length - 1 ? (
                    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span className="legend-dot" aria-hidden="true" />
                      weighted share
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </section>

          {/* needs a move */}
          <section aria-labelledby="nm" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="needs-head">
              <h2 id="nm">
                {needsMoveDeals.length} deals need a move <span>before they can progress</span>
              </h2>
              <div className="needs-controls">
                <Segmented
                  label="Owner"
                  options={[
                    { value: "everyone", label: "Everyone" },
                    { value: "mine", label: "Mine" },
                  ]}
                  value={ownerFilter}
                  onChange={(v) => {
                    setOwnerFilter(v);
                    updateUrl({ owner: v === "mine" ? "me" : null });
                  }}
                />
                <Segmented
                  label="View"
                  options={[
                    { value: "board", label: "Board" },
                    { value: "list", label: "List" },
                  ]}
                  value={view}
                  onChange={(v) => {
                    setView(v);
                    updateUrl({ view: v === "list" ? "list" : null });
                  }}
                />
                <Link href="/app/setup/deal" className="btn pri">
                  <PlusIcon />
                  New deal
                </Link>
              </div>
            </div>
            <div className="att-row">
              {needsMoveFor("bracken-works") ? (
                <Link href="/app/deals/bracken-works" className="att">
                  <span className="ic" style={{ background: "#FBF1E2" }}>
                    <ClockWatchIcon />
                  </span>
                  <span className="body">
                    <b>Bracken Works · $141K</b>
                    <small className="u-watch">Redlines due Thu, blocks the contract</small>
                  </span>
                </Link>
              ) : null}
              {needsMoveFor("kestrel-freight") ? (
                <a
                  href="#board"
                  className="att"
                  onClick={(e) => {
                    e.preventDefault();
                    const k = dealsState.find((d) => d.companyId === "kestrel-freight");
                    if (k) selectDeal(k);
                  }}
                >
                  <span className="ic" style={{ background: "#FBE7E4" }}>
                    <AlertIcon />
                  </span>
                  <span className="body">
                    <b>Kestrel Freight · $39.5K</b>
                    <small className="u-act">No next step since Sep 29</small>
                  </span>
                </a>
              ) : null}
              {needsMoveFor("meridian-foods") ? (
                <Link href="/app/deals/meridian-foods" className="att">
                  <span className="ic" style={{ background: "#FBF1E2" }}>
                    <PulseIcon />
                  </span>
                  <span className="body">
                    <b>Meridian Foods · $64K</b>
                    <small className="u-watch">No reply in 16 days</small>
                  </span>
                </Link>
              ) : null}
            </div>
          </section>

          {/* stage entry requirements, asked inline (§10) */}
          {requirement ? (
            <form
              className="req-banner"
              role="alert"
              onSubmit={(e) => {
                e.preventDefault();
                if (!reqStepText.trim() || !reqStepDate) return;
                const due = new Date(`${reqStepDate}T12:00:00`);
                const dueLabel = due.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }).replace(/^(\w+), (\w+) (\d+)$/, "$1, $2 $3");
                doMove(requirement.deal, requirement.toStageId, {
                  text: reqStepText.trim(),
                  dueLabel,
                  dueDate: reqStepDate,
                  urgency: "on-track",
                });
                setRequirement(null);
              }}
            >
              <span>
                <b>{companyById(requirement.deal.companyId).name}</b> needs {requirement.missing.join(", ").toLowerCase()}{" "}
                before it can enter {stageById(requirement.toStageId).name}. Add it here and the move goes through:
              </span>
              <span className="fields">
                <label className="sr-only" htmlFor="req-step-text">
                  Next step
                </label>
                <input
                  id="req-step-text"
                  className="in"
                  style={{ flex: 1, minWidth: 220, height: 36 }}
                  placeholder="Next step"
                  value={reqStepText}
                  onChange={(e) => setReqStepText(e.target.value)}
                  required
                />
                <label className="sr-only" htmlFor="req-step-date">
                  Due date
                </label>
                <input
                  id="req-step-date"
                  type="date"
                  className="in mono"
                  style={{ width: 170, height: 36 }}
                  value={reqStepDate}
                  onChange={(e) => setReqStepDate(e.target.value)}
                  required
                />
                <button type="submit" className="btn pri sm">
                  Save and move
                </button>
                <button type="button" className="btn sm" onClick={() => setRequirement(null)}>
                  Cancel
                </button>
              </span>
            </form>
          ) : null}

          {/* board / list */}
          {view === "board" ? (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div className="board-scroll" id="board">
                <div className="board">
                  {openStages.map((stage, i) =>
                    errorStageId === stage.id ? (
                      <StageErrorCard key={stage.id} stageName={stage.name} />
                    ) : (
                      <DroppableColumn key={stage.id} stage={stage} headingId={`stage-h-${stage.id}`}>
                        <StageHeader
                          stage={stage}
                          deals={dealsInStageVisible(visibleDeals, stage.id)}
                          headingId={`stage-h-${stage.id}`}
                        />
                        {dealsInStageVisible(visibleDeals, stage.id).map((deal) => (
                          <DraggableCard
                            key={deal.id}
                            deal={deal}
                            selected={deal.id === selectedDeal.id}
                            onSelect={selectDeal}
                            onPlanNextStep={(d) => router.push(`/app/activities?deal=${d.id}&log=1`)}
                          />
                        ))}
                        <span className="sr-only">Column {i + 1} of {openStages.length}</span>
                      </DroppableColumn>
                    ),
                  )}
                </div>
              </div>
            </DndContext>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }} id="board">
              {openStages.map((stage) =>
                errorStageId === stage.id ? (
                  <section key={stage.id} className="panel list-group" aria-label={stage.name}>
                    <div style={{ padding: "4px 20px 16px" }}>
                      <StageErrorCard stageName={stage.name} />
                    </div>
                  </section>
                ) : (
                  <section key={stage.id} className="panel list-group" aria-label={stage.name}>
                    <div className="stage-band">
                      <b style={{ fontSize: 14 }}>{stage.name}</b>
                      <span className="mono" style={{ fontSize: 15 }}>
                        {moneyCompact(stageTotal(visibleDeals, stage.id))}
                      </span>
                    </div>
                    <div className="tbl-wrap">
                      <div className="tbl" style={{ minWidth: 760 }}>
                        <div className="tr th list-head" aria-hidden="true">
                          <span>Company</span>
                          <span>Deal</span>
                          <span>Value</span>
                          <span>Next step</span>
                          <span>Owner</span>
                          <span>In stage</span>
                        </div>
                        {dealsInStageVisible(visibleDeals, stage.id).map((deal) => {
                          const company = companyById(deal.companyId);
                          const owner = personById(deal.ownerId);
                          return (
                            <button
                              key={deal.id}
                              type="button"
                              className="tr list-row"
                              data-deal-id={deal.id}
                              onClick={() => selectDeal(deal)}
                              aria-current={deal.id === selectedDeal.id ? "true" : undefined}
                            >
                              <span className="who">
                                <span
                                  className="mg"
                                  style={{ background: company.mgBg, color: company.mgColor }}
                                  aria-hidden="true"
                                >
                                  {company.initials}
                                </span>
                                <b style={{ fontSize: 14 }}>{company.name}</b>
                              </span>
                              <span>{deal.name}</span>
                              <span className="mono">{moneyCompact(deal.value)}</span>
                              <span style={{ fontSize: 13 }}>
                                {deal.nextStep ? (
                                  <>
                                    <span className={deal.nextStep.urgency === "on-track" ? undefined : `u-${deal.nextStep.urgency}`} style={{ fontWeight: 600 }}>
                                      {deal.nextStep.dueLabel}
                                    </span>{" "}
                                    · {deal.nextStep.text}
                                  </>
                                ) : (
                                  <span className="u-act" style={{ fontWeight: 600 }}>
                                    No next step
                                  </span>
                                )}
                              </span>
                              <span>
                                <OwnerAvatar person={owner} />
                              </span>
                              <span style={{ fontSize: 13, color: "var(--muted)" }}>{deal.enteredStageLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                ),
              )}
            </div>
          )}

          {/* live line / toast */}
          {toast.kind === "move" ? (
            <div className="toast" role="status">
              <OwnerAvatar person={personById(toast.byId)} large />
              <span>
                <b>{toast.byFirstName}</b> moved <b>{toast.companyName}</b> to {toast.toStageName} · {toast.agoLabel}
              </span>
              {toast.undoDeal ? (
                <button type="button" className="undo" onClick={undoToast}>
                  Undo
                </button>
              ) : null}
              <span className="hint">
                Move a card with <span className="kbd">M</span>
              </span>
            </div>
          ) : toast.kind === "message" && toast.text ? (
            <div className="toast" role="status">
              <span>{toast.text}</span>
              <span className="hint">
                Move a card with <span className="kbd">M</span>
              </span>
            </div>
          ) : null}
        </div>

        <DealPanel deal={selectedDeal} />
      </div>

      <footer className="board-footer">
        <span>
          Closed this quarter: <b>{liveClosed.won} won</b>, {liveClosed.lost} lost · win rate{" "}
          <b className="mono">{liveClosed.winRate}%</b> · won deals took{" "}
          <b className="mono">{closed.averageDaysToClose} days</b> on average
        </span>
        <span>
          Win chance per stage is from the last 12 months. <a href="#board">How we calculate it</a>
        </span>
      </footer>

      {moveMenuDeal && moveMenu ? (
        <MoveMenu
          deal={moveMenuDeal}
          position={{ x: moveMenu.x, y: moveMenu.y }}
          onClose={() => setMoveMenu(null)}
          onChoose={(deal, toStageId) => {
            setMoveMenu(null);
            attemptMove(deal, toStageId);
          }}
        />
      ) : null}

      {lostDeal ? (
        <ConfirmLost
          deal={lostDeal}
          open
          onClose={() => setLostDeal(null)}
          onConfirm={(deal) => {
            setLostDeal(null);
            doMove(deal, "lost");
          }}
        />
      ) : null}

      {stateParam === "palette" ? (
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} initialQuery={paletteQuery ?? "brack"} />
      ) : null}
    </>
  );
}

function dealsInStageVisible(list: Deal[], stageId: string): Deal[] {
  return list.filter((d) => d.stageId === stageId);
}
