"use client";

/**
 * M-04 — Team client (TeamManagement.html layout): real workspace members
 * from the dataset, role changes persist through updateMemberRole
 * (admin-gated by RLS), the signed-in user's own row keeps a fixed role
 * chip, and Invite creates a real invites row. The pending-invite row
 * renders only when an invite exists.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "@/components/df/icons";
import { SettingsHead } from "@/components/df/mgmt/settings-head";
import { createInvite, updateMemberRole } from "@/lib/df/actions";
import { moneyCompact } from "@/lib/df/format";
import { buildTeamScreen } from "@/lib/df/mgmt-data";
import type { Dataset, Person } from "@/lib/df/types";

const COLS = "minmax(0,1.5fr) 150px 150px 130px 80px";

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#66716E" strokeWidth="1.6" aria-hidden="true">
      <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="2" />
      <path d="m2.5 4.5 5.5 4 5.5-4" />
    </svg>
  );
}

export default function TeamClient({ dataset }: { dataset: Dataset }) {
  const router = useRouter();
  const t = buildTeamScreen(dataset);
  const team = dataset.team;
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(team.map((p) => [p.id, p.role])),
  );
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  async function changeRole(person: Person, roleLabel: string) {
    setRoles((prev) => ({ ...prev, [person.id]: roleLabel }));
    const res = await updateMemberRole(
      person.id,
      roleLabel === "Admin" ? "admin" : roleLabel === "Manager" ? "manager" : "rep",
    );
    if (!res.ok) {
      setError(res.error);
      setRoles((prev) => ({ ...prev, [person.id]: person.role }));
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <main className="mgmt-page">
      <SettingsHead
        title="Team"
        lede={t.lede}
        actions={
          <>
            {error ? (
              <span className="form-error" role="alert">
                {error}
              </span>
            ) : null}
            <button type="button" className="btn pri" onClick={() => setInviteOpen(true)}>
              <PlusIcon />
              Invite
            </button>
          </>
        }
      />
      <div className="split">
        <section className="panel" aria-label="People" style={{ minWidth: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 680 }}>
              <div className="tr th" style={{ gridTemplateColumns: COLS }}>
                <span>Person</span>
                <span>Role</span>
                <span>Open deals</span>
                <span>Last active</span>
                <span />
              </div>
              {team.map((person) => {
                const active = t.lastActive[person.id] ?? "—";
                return (
                  <div className="tr" key={person.id} style={{ gridTemplateColumns: COLS }}>
                    <span className="person-cell">
                      <span className="own big" aria-hidden="true" style={{ background: person.avatarBg, color: person.avatarColor }}>
                        {person.initials}
                      </span>
                      <span className="meta">
                        <b style={{ fontWeight: 600 }}>
                          {person.name}
                          {person.you ? " (you)" : ""}
                        </b>
                        <small>{t.emails[person.id] ?? person.email}</small>
                      </span>
                    </span>
                    <span>
                      {person.you ? (
                        <span className="chip role-chip">{person.role}</span>
                      ) : (
                        <select
                          className="in"
                          aria-label={`Role for ${person.name}`}
                          style={{ height: 34, width: 120 }}
                          value={roles[person.id] ?? person.role}
                          onChange={(e) => changeRole(person, e.target.value)}
                        >
                          {t.roleOptions.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </span>
                    <span className="mono" style={{ fontSize: 13 }}>
                      {person.openDeals} · {moneyCompact(person.openValue)}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
                      {active === "Now" ? <i className="active-dot" aria-hidden="true" /> : null}
                      {active}
                    </span>
                    <span />
                  </div>
                );
              })}
              {t.invite.email ? (
                <div className="tr" style={{ gridTemplateColumns: COLS, background: "var(--card-sunk)" }}>
                  <span className="person-cell">
                    <span className="invite-ic" aria-hidden="true">
                      <MailIcon />
                    </span>
                    <span className="meta">
                      <b style={{ fontWeight: 600, color: "var(--ink-2)" }}>{t.invite.email}</b>
                      <small>{t.invite.note}</small>
                    </span>
                  </span>
                  <span style={{ fontSize: 13 }}>{t.invite.role}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>—</span>
                  <span>
                    <span className="chip chip-invite">
                      <i aria-hidden="true" />
                      {t.invite.status}
                    </span>
                  </span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>Pending</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="panel" aria-labelledby="rl" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14, fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)", overflow: "visible" }}>
          <h2 id="rl" style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.2, color: "var(--ink)" }}>
            What each role can do
          </h2>
          {t.roles.map((r) => (
            <span className="role-tile" key={r.name}>
              <b>{r.name}</b> · {r.desc}
            </span>
          ))}
          <span style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
            <span className="seatbar" aria-hidden="true">
              {Array.from({ length: t.seatSegments }, (_, i) => (
                <i key={i} className={t.seatInviteIndex >= 0 && i === t.seatInviteIndex ? "invite" : undefined} />
              ))}
            </span>
            {t.seatsLabel}
          </span>
        </aside>
      </div>

      {inviteOpen ? (
        <div className="scrim" role="presentation" onClick={() => setInviteOpen(false)}>
          <div
            className="dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Invite a person"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Invite a person</h2>
            <p>They sign up with this email and land in this workspace as a Rep.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await createInvite({ email: inviteEmail.trim(), role: "Rep" });
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setError(null);
                setInviteOpen(false);
                setInviteEmail("");
                router.refresh();
              }}
            >
              <label className="f">
                <span>Email</span>
                <input
                  className="in"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </label>
              <div className="foot">
                <button type="button" className="btn" onClick={() => setInviteOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn pri">
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
