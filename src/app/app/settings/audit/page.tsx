import { SettingsHead } from "@/components/df/mgmt/settings-head";
import { OwnerAvatar } from "@/components/df/primitives";
import { activities, personById } from "@/lib/df/api";
import { auditExtra } from "@/lib/df/mgmt-data";

/**
 * /app/settings/audit — v1 route with NO v2 screen (coordinator ruling:
 * keep it functional under the new shell as a simple fixture-driven audit
 * list, styled with the settings sub-menu + .tbl/.tr classes, in the design
 * language). Sources: the api seam's activity/move history plus the
 * Management fixture extras (e.g. the Dana Cole invite). Flagged in
 * BUILD-LOG as a no-screen build.
 */
export default function AuditPage() {
  const entries = [...activities, ...auditExtra];

  return (
    <main className="mgmt-page">
      <SettingsHead
        title="Audit log"
        lede="Every change to deals, stages and settings in Sevyn Labs · Sales, in the order it happened. Kept from the activities and move history — there is no separate audit screen in the v2 designs."
      />
      <section className="panel" aria-labelledby="al" style={{ overflow: "hidden" }}>
        <div className="ph">
          <h2 id="al">History</h2>
          <span>{entries.length} entries · fixture data</span>
        </div>
        <div className="tbl-wrap">
          <div className="tbl" style={{ minWidth: 720 }}>
            <div className="tr th" style={{ gridTemplateColumns: "90px 110px minmax(0,1fr) 110px" }}>
              <span>When</span>
              <span>Who</span>
              <span>Change</span>
              <span>Day</span>
            </div>
            {entries.map((entry) => {
              const person = personById(entry.ownerId);
              return (
                <div className="tr" key={entry.id} style={{ gridTemplateColumns: "90px 110px minmax(0,1fr) 110px" }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                    {entry.timeLabel}
                  </span>
                  <span className="who">
                    <OwnerAvatar person={person} />
                    <span>{person.firstName}</span>
                  </span>
                  <span>
                    <b style={{ fontWeight: 600 }}>{entry.type}</b> · {entry.subject}
                    {entry.detail ? <small>{entry.detail}</small> : null}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{entry.dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="def">
          Moves keep both versions when two people change the same deal at once — nothing is overwritten silently.
        </p>
      </section>
    </main>
  );
}
