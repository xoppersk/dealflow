"use client";

/**
 * M-04 — Team (/app/settings/team), replicated from
 * screens/TeamManagement.html: the 4 people, the pending invite, role
 * selects (interactive local state), "What each role can do" and the seat
 * bar — drawn verbatim: "Seats: 5 of 5 used, counting the invite."
 */
import { useState } from "react";
import { PlusIcon } from "@/components/df/icons";
import { SettingsHead } from "@/components/df/mgmt/settings-head";
import { team } from "@/lib/df/api";
import { moneyCompact } from "@/lib/df/format";
import { teamScreenData as t } from "@/lib/df/mgmt-data";

const COLS = "minmax(0,1.5fr) 150px 150px 130px 80px";

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#66716E" strokeWidth="1.6" aria-hidden="true">
      <rect x="1.8" y="3.2" width="12.4" height="9.6" rx="2" />
      <path d="m2.5 4.5 5.5 4 5.5-4" />
    </svg>
  );
}

export default function TeamPage() {
  const [roles, setRoles] = useState<Record<string, string>>(
    Object.fromEntries(team.map((p) => [p.id, p.role])),
  );

  return (
    <main className="mgmt-page">
      <SettingsHead
        title="Team"
        lede={t.lede}
        actions={
          <a href="#" className="btn pri" onClick={(e) => e.preventDefault()}>
            <PlusIcon />
            Invite
          </a>
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
                const active = t.lastActive[person.id];
                const isAdminFixed = person.id === "sheku-koroma";
                return (
                  <div className="tr" key={person.id} style={{ gridTemplateColumns: COLS }}>
                    <span className="person-cell">
                      <span className="own big" aria-hidden="true" style={{ background: person.avatarBg, color: person.avatarColor }}>
                        {person.initials}
                      </span>
                      <span className="meta">
                        <b style={{ fontWeight: 600 }}>{person.name}</b>
                        <small>{t.emails[person.id]}</small>
                      </span>
                    </span>
                    <span>
                      {isAdminFixed ? (
                        <span className="chip role-chip">Admin</span>
                      ) : (
                        <select
                          className="in"
                          aria-label={`Role for ${person.name}`}
                          style={{ height: 34, width: 120 }}
                          value={roles[person.id]}
                          onChange={(e) => setRoles((prev) => ({ ...prev, [person.id]: e.target.value }))}
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
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: active === "Yesterday" ? "var(--ink-2)" : undefined }}>
                      {active !== "Yesterday" ? <i className="active-dot" aria-hidden="true" /> : null}
                      {active}
                    </span>
                    <span>
                      {!isAdminFixed ? (
                        <a href="#" className="subtle" style={{ fontSize: 13 }} onClick={(e) => e.preventDefault()}>
                          Remove
                        </a>
                      ) : null}
                    </span>
                  </div>
                );
              })}
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
                <span>
                  <a href="#" style={{ fontSize: 13, fontWeight: 600 }} onClick={(e) => e.preventDefault()}>
                    Resend
                  </a>
                </span>
              </div>
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
                <i key={i} className={i === t.seatInviteIndex ? "invite" : undefined} />
              ))}
            </span>
            {t.seatsLabel}
          </span>
        </aside>
      </div>
    </main>
  );
}
