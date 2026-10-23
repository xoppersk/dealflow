import "@/styles/mgmt.css";
import { Suspense } from "react";
import { OwnerAvatar } from "@/components/df/primitives";
import { SettingsHead } from "@/components/df/mgmt/settings-head";
import { personByIdSafe } from "@/lib/df/api";
import { getDataset } from "@/lib/df/db";
import { buildAuditEntries } from "@/lib/df/mgmt-data";
import type { Person } from "@/lib/df/types";

/** Fallback person for audit rows whose actor left the workspace. */
function stubPerson(id: string): Person {
  return {
    id,
    name: "Former member",
    firstName: "Former",
    initials: "?",
    avatarBg: "#ECE9E1",
    avatarColor: "#4A5550",
    role: "Rep",
    online: false,
    you: false,
    openDeals: 0,
    openValue: 0,
    openValueLabel: "",
    email: "",
  };
}

/**
 * M-06 — Audit log (/app/settings/audit). Real audit_log rows for the
 * workspace, newest first (actions write them: deal moves, stage changes,
 * member and workspace changes).
 */
async function AuditPageInner() {
  const ds = await getDataset();
  const entries = buildAuditEntries(ds);
  const w = ds.settings;
  return (
    <>
      <SettingsHead
        title="Audit log"
        lede={`Who changed what in ${w.workspaceName}${w.workspaceScope ? ` (${w.workspaceScope})` : ""}, newest first. ${entries.length} ${entries.length === 1 ? "entry" : "entries"}.`}
      />
      <div className="panel">
        <div className="tu" style={{ gridTemplateColumns: "170px 220px 1fr" }} role="row">
          <span>When</span>
          <span>Who</span>
          <span>What changed</span>
        </div>
        {entries.map((e, i) => (
          <div className="tu" key={e.id} style={{ gridTemplateColumns: "170px 220px 1fr" }} role="row">
            <span className="dim mono" style={{ fontSize: 12.5 }}>
              {e.dayLabel} · {e.timeLabel}
            </span>
            <span className="person">
              <OwnerAvatar person={personByIdSafe(ds.team, e.ownerId) ?? stubPerson(e.ownerId)} />
              <b>{(personByIdSafe(ds.team, e.ownerId) ?? stubPerson(e.ownerId)).name}</b>
            </span>
            <span className={i === 0 ? "this-week" : undefined}>
              {e.subject}
              {e.detail ? (
                <>
                  {" — "}
                  <b>{e.detail}</b>
                </>
              ) : null}
            </span>
          </div>
        ))}
        {entries.length === 0 ? (
          <p style={{ padding: "18px 20px", color: "var(--muted)", fontSize: 14 }}>
            Nothing yet — moves and changes land here as they happen.
          </p>
        ) : null}
      </div>
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={null}>
      <AuditPageInner />
    </Suspense>
  );
}

export const instant = false;
