import Link from "next/link";
import type { Company, Deal, Stage } from "@/lib/df/types";
import { moneyCompact } from "@/lib/df/format";
import "@/styles/system.css";

function PhoneIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="1.5" width="8" height="13" rx="2" />
      <path d="M7 12h2" />
    </svg>
  );
}

/**
 * X-09 Offline queue (OfflineQueue.html) — the 390px phone deal sheet
 * while offline: the ink OfflineQueue banner (role=status) with queued
 * changes marked "Saved on phone", and Move stage disabled with its
 * reason. Props-in (a real deal/company/stage); not routed in production —
 * offline state is a client condition, not a URL state.
 */
export function OfflineDealSheet({ deal, company, stage }: { deal: Deal; company: Company; stage: Stage }) {

  return (
    <div className="sys-phone">
      <div className="sys-off-banner" role="status">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#8FD0C7" strokeWidth="1.6" aria-hidden="true">
          <path d="M2 6.2a9 9 0 0 1 12 0M4.3 8.6a5.6 5.6 0 0 1 7.4 0M6.6 11a2.2 2.2 0 0 1 2.8 0M2.5 2.5l11 11" />
        </svg>
        <span>
          <b>You’re offline.</b> 2 changes are saved on this phone and will send when you’re back.
        </span>
      </div>

      <header className="sys-phone-header">
        <Link href="/app/pipeline" className="sys-phone-back" aria-label="Back to pipeline">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M11 3L5 9l6 6" />
          </svg>
        </Link>
        <span className="mg" aria-hidden="true" style={{ background: "var(--ink)", color: "#fff" }}>
          {company.initials}
        </span>
        <div className="sys-phone-title">
          <b>{company.name}</b>
          <span>
            {stage.name} · <span className="mono">{moneyCompact(deal.value)}</span>
          </span>
        </div>
      </header>

      <main className="sys-phone-main">
        <section className="sys-phone-next">
          <span className="label">
            <i aria-hidden="true" />
            Next step{deal.nextStep ? ` · due ${deal.nextStep.dueLabel}` : ""}
          </span>
          <span className="step-text">{deal.nextStep?.text ?? "No next step set"}</span>
        </section>

        <section className="panel sys-queue-panel">
          <h2>Waiting to send · 2</h2>
          <div className="sys-q">
            <span className="ic" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#44504D" strokeWidth="1.6" aria-hidden="true">
                <path d="M3 2.5h3l1.2 3-1.7 1.1a8 8 0 0 0 3.9 3.9l1.1-1.7 3 1.2v3a1.5 1.5 0 0 1-1.6 1.5A11.5 11.5 0 0 1 1.5 4.1 1.5 1.5 0 0 1 3 2.5Z" />
              </svg>
            </span>
            <span>
              <b>Call logged</b>
              <br />
              <span className="detail">Queued from this phone while offline.</span>
              <br />
              <span className="sys-saved">
                <PhoneIcon />
                Saved on phone
              </span>
            </span>
          </div>
          <div className="sys-q last">
            <span className="ic" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#44504D" strokeWidth="1.6" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </span>
            <span>
              <b>Next step changed</b>
              <br />
              <span className="detail">{deal.nextStep?.text ?? "—"}{deal.nextStep ? ` · ${deal.nextStep.dueLabel}` : ""}</span>
              <br />
              <span className="sys-saved">
                <PhoneIcon />
                Saved on phone
              </span>
            </span>
          </div>
        </section>

        <p className="sys-phone-note">
          If someone changes this deal before you reconnect, you’ll see both versions and choose.
          Nothing is overwritten without asking.
        </p>
      </main>

      <div className="sys-phone-foot">
        <Link href="#" className="btn pri">
          Log activity
        </Link>
        <button
          type="button"
          className="btn blocked-off"
          disabled
          aria-disabled="true"
          title="Stage changes wait until you’re online"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="1.5" />
            <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
          </svg>
          Move stage
        </button>
      </div>
    </div>
  );
}
