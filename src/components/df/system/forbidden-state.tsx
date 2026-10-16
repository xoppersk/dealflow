import Link from "next/link";
import { personById } from "@/lib/df/api";
import "@/styles/system.css";

/**
 * X-07 Forbidden (Forbidden.html) — a Rep opening Reports: the state card
 * naming the restriction, your role, the role needed, and who to ask.
 * Management renders this for /app/reports?state=forbidden.
 */
export function ForbiddenState() {
  const admin = personById("sheku-koroma");
  return (
    <section className="state">
      <div className="sys-state-top">
        <span className="ic" style={{ background: "#FBF1E2" }} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="#9A5B00" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="1.5" />
            <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
          </svg>
        </span>
        <span className="stamp">Access · Reports</span>
      </div>
      <h1>Reports are for managers and admins.</h1>
      <p>
        You’re a Rep, so you can see the whole board and your own numbers, but not team reports.{" "}
        {admin.name} can change your role.
      </p>
      <dl className="kv box">
        <dt>Your role</dt>
        <dd>
          <span className="chip" style={{ background: "#ECE9E1", color: "var(--ink-2)" }}>
            Rep
          </span>
        </dd>
        <dt>Needs</dt>
        <dd>Manager or Admin</dd>
        <dt>Ask</dt>
        <dd className="sys-ask-row">
          <span
            className="own"
            style={{ background: admin.avatarBg, color: admin.avatarColor }}
            aria-hidden="true"
          >
            {admin.initials}
          </span>
          {admin.name} · Admin
        </dd>
      </dl>
      <div className="sys-state-actions">
        <Link href="#" className="btn pri">
          Ask Sheku for access
        </Link>
        <Link href="/app" className="btn">
          See your own numbers
        </Link>
      </div>
    </section>
  );
}
