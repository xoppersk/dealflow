"use client";

import { useState } from "react";
import { activities, dealById, stageById } from "@/lib/df/api";
import { ConfirmLost } from "@/components/df/confirm-lost";
import { DealCard, StageHeader } from "@/components/df/deal-card";
import { NextStepPanel } from "@/components/df/next-step";
import { Button, Segmented, UrgencyLabel } from "@/components/df/primitives";
import { ActivityRow, OfflineBanner } from "@/components/df/rows";

/**
 * /dev/components — every §7 component on one page (HANDOVER §12 build
 * order step 2). Not part of the product navigation.
 */
export default function ComponentsPage() {
  const [view, setView] = useState<"board" | "list">("board");
  const [lostOpen, setLostOpen] = useState(false);
  const bracken = dealById("bracken-works-annual-operations-plan")!;
  const kestrel = dealById("kestrel-freight-logistics-contract")!;
  const solace = dealById("solace-energy-field-team-package")!;
  const negotiation = stageById("negotiation");

  return (
    <div className="page" style={{ maxWidth: 980, margin: "0 auto", width: "100%" }}>
      <header className="page-head">
        <div className="titles">
          <h1 className="page-title">Components</h1>
          <p className="summary">Dealflow Premium v2 — the §7 component set, built before the screens.</p>
        </div>
      </header>

      <section className="panel panel-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="panel-title">Button</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button variant="pri">New deal</Button>
          <Button variant="progress">Save changes</Button>
          <Button>Reschedule</Button>
          <Button variant="destructive">Mark lost</Button>
          <Button variant="destructive-fill">Mark as lost</Button>
          <Button blockedReason="Waiting on legal redlines">Move to Won</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section className="panel panel-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="panel-title">UrgencyLabel — urgency is words</h2>
        <div style={{ display: "flex", gap: 18 }}>
          <UrgencyLabel urgency="act" />
          <UrgencyLabel urgency="watch" />
          <UrgencyLabel urgency="on-track" />
        </div>
      </section>

      <section className="panel panel-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="panel-title">Segmented</h2>
        <Segmented
          label="View"
          options={[
            { value: "board", label: "Board" },
            { value: "list", label: "List" },
          ]}
          value={view}
          onChange={(v) => setView(v)}
        />
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="panel-title">StageHeader + DealCard</h2>
        <div className="col" style={{ maxWidth: 340 }}>
          <StageHeader stage={negotiation} deals={[bracken, dealById("vesper-studio-agency-partnership")!]} headingId="dev-sh" />
          <DealCard deal={bracken} selected />
          <DealCard deal={kestrel} />
          <DealCard deal={solace} />
        </div>
        <div className="col" style={{ maxWidth: 340 }}>
          <StageHeader stage={stageById("proposal")} deals={[]} failed headingId="dev-sh-failed" />
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="panel-title">NextStep</h2>
        <div style={{ maxWidth: 640 }}>
          <NextStepPanel deal={bracken} why="Jordan Bell, COO, decides; legal has the redlines." />
        </div>
      </section>

      <section className="panel" style={{ overflow: "hidden" }}>
        <div className="ph">
          <h2>ActivityRow</h2>
          <span>Overdue tasks use the act tint</span>
        </div>
        {activities.map((a) => (
          <ActivityRow key={a.id} activity={a} />
        ))}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 className="panel-title">OfflineQueue + ConfirmLost</h2>
        <OfflineBanner count={2} />
        <div>
          <Button variant="destructive" onClick={() => setLostOpen(true)}>
            Mark Kestrel Freight lost…
          </Button>
        </div>
        <p className="caption" style={{ margin: 0 }}>
          The command palette lives in the app shell — press ⌘K on any /app screen. It is not mounted on this page.
        </p>
      </section>

      <ConfirmLost deal={kestrel} open={lostOpen} onClose={() => setLostOpen(false)} onConfirm={() => setLostOpen(false)} />
    </div>
  );
}
