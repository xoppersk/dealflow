"use client";

import { useEffect, useRef, useState } from "react";
import { companyByIdSafe } from "@/lib/df/api";
import { useDataset } from "../dataset-context";
import { moneyCompact } from "@/lib/df/format";
import { checkMove } from "@/lib/df/rules";
import type { Deal } from "@/lib/df/types";

/**
 * Move menu (§10/§11): the M-key stage listbox. Lists every stage; Won shows
 * its blocked reason inline when checkMove refuses it; Lost routes through
 * the parent's ConfirmLost. Arrow keys move, Enter chooses, Esc closes.
 */
export function MoveMenu({
  deal,
  position,
  onChoose,
  onClose,
}: {
  deal: Deal;
  position: { x: number; y: number };
  onChoose: (deal: Deal, toStageId: string) => void;
  onClose: () => void;
}) {
  const ds = useDataset();
  const stages = ds.stages;
  const company = companyByIdSafe(ds.companies, deal.companyId) ?? {
    id: deal.companyId, name: deal.name, initials: "??", mgBg: "#F1EEE6", mgColor: "#17201E",
  };
  const currentIdx = Math.max(
    0,
    stages.findIndex((s) => s.id === deal.stageId),
  );
  const [active, setActive] = useState(currentIdx);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  function choose(idx: number) {
    const stage = stages[idx];
    if (!stage) return;
    const verdict = checkMove(deal, stage.id);
    if (!verdict.ok) {
      setBlockedReason(verdict.reason);
      return;
    }
    onChoose(deal, stage.id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(stages.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(active);
    }
  }

  return (
    <div
      ref={ref}
      className="move-menu"
      role="listbox"
      aria-label={`Move ${company.name} to`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{
        position: "fixed",
        left: Math.min(position.x, typeof window !== "undefined" ? window.innerWidth - 260 : position.x),
        top: position.y,
      }}
    >
      <div className="gl" style={{ padding: "6px 10px 4px" }}>
        Move {company.name} · {moneyCompact(deal.value)}
      </div>
      {stages.map((s, i) => {
        const verdict = checkMove(deal, s.id);
        const isCurrent = s.id === deal.stageId;
        return (
          <div
            key={s.id}
            role="option"
            aria-selected={i === active}
            aria-disabled={!verdict.ok || isCurrent}
            title={!verdict.ok ? verdict.reason : undefined}
            onMouseEnter={() => setActive(i)}
            onClick={() => {
              if (isCurrent) return;
              choose(i);
            }}
          >
            <span>
              {s.name}
              {isCurrent ? <span style={{ color: "var(--muted)" }}> · current</span> : null}
            </span>
            <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
              {s.id === "won" || s.id === "lost" ? "" : `${s.winChance}% win`}
            </span>
          </div>
        );
      })}
      {blockedReason ? (
        <p className="u-act" style={{ margin: "6px 10px 4px", fontSize: 12.5, lineHeight: 1.45 }} role="alert">
          {blockedReason}
        </p>
      ) : null}
    </div>
  );
}
