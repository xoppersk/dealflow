# Dealflow — sell in the open

Dealflow is a lightweight CRM for small B2B sales teams who find Salesforce overwhelming and spreadsheets unmanageable: a visual kanban pipeline with drag-and-drop deal movement, unified contact/company records, an append-only activity timeline, role-based team access, and **realtime collaboration** — when one rep moves a card, every teammate's board updates in under 2 seconds.

This is a flagship portfolio project (built for a remote-developer job hunt) demonstrating a production-grade web application: kanban, realtime conflict resolution, PostgreSQL Row Level Security, and a full admin surface.

> **Live demo:** coming soon — `dealflow.shekukoroma.com` (deploys after the Vercel daily quota resets)
> **Status:** local build complete; all QA gates green (see below)

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) |
| UI | shadcn-style primitives on Radix, Tailwind CSS v4, Lucide icons |
| Drag & drop | dnd-kit (multi-container kanban, touch + keyboard sensors) |
| Database | **PostgreSQL** (via Supabase) — **Row Level Security** is the authorization layer, deny-by-default on every table |
| Auth | Supabase Auth (email/password + magic link), **JWT** session via `@supabase/ssr` cookies; role read from PostgreSQL per request (never cached in JWT claims) |
| Realtime | Supabase Realtime `postgres_changes` + Presence (board and per-deal "viewing now") |
| Client cache | TanStack Query, invalidated/patched by realtime events |
| Validation | Zod (shared between forms and Server Actions) |
| Search | PostgreSQL full-text search (`tsvector` + GIN, `search_all()` RPC, <500ms typeahead) |
| Charts | Recharts (dynamically imported — never in the initial bundle) |
| Files | Supabase Storage (`deal-attachments`, `avatars`; signed URLs, 1h expiry) |
| Email | Resend (invite emails, weekly overdue digest via Vercel Cron) |
| Tests | Vitest (unit) — 45 tests green |

## Architecture

```
┌─ Browser ──────────────────────────────────────────────┐
│  Server Components (initial data)                      │
│  Client islands: kanban (dnd-kit), realtime hooks,      │
│  TanStack Query cache ←── Supabase Realtime ──┐         │
└──────────────────────────────────────────────┼─────────┘
                                               │
┌─ Next.js ────────────────────────────────────┼─────────┐
│  Server Actions (Zod-validated, per-action)  │         │
│    moveDeal: version-guarded UPDATE           │         │
│      → 409 on conflict → client reconciles    │         │
└──────────────────────────────────────────────┼─────────┘
                                               │
┌─ PostgreSQL (Supabase) ──────────────────────┼─────────┐
│  Row Level Security: reps see own+unowned,    │         │
│    managers/admins see all; service role      │         │
│    bypasses RLS (server-only, invite flow +   │         │
│    audit-logged hard deletes)                 │         │
│  Triggers: closed-stage guard, closed_at,     │         │
│    last_touched_at, activity immutability,    │         │
│    FTS vectors, auth mirror                   │         │
│  Realtime publication: deals, activities,     │ ◄───────┘
│    pipeline_stages, deal_contacts             │
└───────────────────────────────────────────────┘
```

**Key design decisions:**
- **Optimistic concurrency, not OT.** Stage moves are whole-row assignments (`stage_id` + `board_position`), so a `version` counter + 409-reject + realtime reconciliation gives convergence without operational-transform complexity. The losing client gets a named toast ("Maya moved Harborlight Renewal to Negotiation…") with Retry; both attempts are preserved (`stage_history` + `audit_log`).
- **Append-only activity timeline.** Activity content is immutable after creation (database trigger enforces it); corrections are new activities. This makes the timeline trustworthy and offline sync idempotent.
- **Stage transition rules in three places:** a shared, unit-tested domain module (`lib/domain/stage-rules.ts`), the `moveDeal` Server Action, and a database trigger as defense in depth. Closed stages can't be left by drag — reopening is an explicit manager/admin action with a recorded reason.
- **RLS is the authorization layer.** Server Components never do manual permission checks beyond route-level role gates; the database enforces the rest — including on realtime payloads.

## Routes

| Route | What |
|---|---|
| `/login`, `/accept` | Email/password + magic link; invite set-password |
| `/` | Dashboard "Today": greeting, stat cards, needs-attention list, live activity feed (+ team rollup for managers) |
| `/pipeline` | Kanban board: drag-and-drop, filters, presence, conflict toasts |
| `/deals/[id]` | Deal detail: Timeline / Details / Files tabs, move-stage menu, won/lost, reassign, reopen |
| `/contacts`, `/contacts/[id]` | Contacts list + detail (timeline across deals) |
| `/companies`, `/companies/[id]` | Companies list + account view |
| `/activities` | Overdue / Upcoming / All follow-up queue |
| `/reports` | Manager reports: pipeline by stage, weighted forecast, win-rate trend, leaderboard, stalled deals (all drill-through) |
| `/settings` | Workspace settings |
| `/settings/stages` | Pipeline stage manager (reorder, recolor, guarded delete) |
| `/settings/team` | Invites, roles, deactivation with reassignment |
| `/settings/import` | 3-step CSV import wizard (mapping preview, row-level errors) |
| `/settings/audit` | Audit log viewer (admin) |

## Getting started

```bash
# 1. Install
npm install

# 2. Configure (Supabase project URL + anon key; service-role key for admin flows)
cp .env.example .env.local
# edit .env.local

# 3. Database — apply migrations in order, then seed the demo workspace
# (Supabase SQL editor, or `supabase db push` after `supabase link`)
#   supabase/migrations/00001_enums_and_users.sql … 00011_workspace_settings.sql
#   supabase/seed.sql

# 4. Run
npm run dev        # http://localhost:3000
```

Demo team (seeded): `maya@dealflow.example.com` (rep), `jon@dealflow.example.com` (manager), `priya@dealflow.example.com` (admin). The seed inserts `public.users` rows directly; in a real project the invite flow creates them via Supabase Auth.

## QA gates

| Gate | Command | Result |
|---|---|---|
| Unit tests | `npm test` | **45/45 pass** (stage rules, stale-deal 14-day rule incl. timezone boundaries, urgency badges, forecast math, conflict resolution) |
| Typecheck | `npm run typecheck` | clean |
| Lint | `npm run lint` | clean |
| Production build | `npm run build` | 19 routes, clean |
| Bundle gate | `npm run bundle:gate` | all routes ≤ 800KB raw (calibrated: Supabase Realtime client + dnd-kit are the flagship's core; ⌘K palette lazy-loaded, recharts dynamic-only) |
| Migrations | `pglast` parse | 11/11 valid PostgreSQL |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → test → build → bundle gate on every PR.

## Known gaps & judgment calls

- **No live-database tests yet.** Migrations are syntax-validated (pglast) and written against the schema doc, but haven't run against a real Supabase project — that's the next step before deploy.
- **No Playwright e2e yet.** The concurrent-edit and offline-sync scenarios are specified in the docs (`concurrent-edit.spec.ts`, `activity-offline.spec.ts`) and the code paths exist; the specs themselves are unwritten.
- **Duplicate UI primitives.** `src/components/reports/ui.tsx` (and `page-header`, `stat-card`, `user-avatar` there) mirror `src/components/ui/*` + `src/components/shared/*` because the workstreams built in parallel. They're API-compatible and documented for a mechanical consolidation pass.
- **Resend email sending is stubbed** in the invite flow (logged server-side, invite link returned for copy) — wire `RESEND_API_KEY` before production.
- **Within-column card reorder is local-only** (no `reorderDeal` action yet); cross-column moves persist fully.
- **Mobile pipeline** uses horizontal scroll; the single-column stage-chip switcher from the design doc isn't built yet.
- Docs followed UI-DESIGN.md first, PRD second where ambiguous. The onboarding wizard (UI-DESIGN.md §2.2) is represented by the setup-checklist empty state rather than a full 6-step modal — deliberate scope trim for v1.

## Lessons learned

1. **Hand-written Supabase types must satisfy `GenericTable`.** supabase-js v2.117 infers `never` for every query unless table entries have `Relationships` and row types are `type` aliases (not `interface`s — interfaces lack the implicit index signature). Caught during parallel development; fixed once at the source.
2. **Next.js 16 Cache Components vs. dynamic routes.** `cacheComponents: true` tries to prerender everything; authenticated routes need `export const instant = false`, and `useSearchParams()` needs a `<Suspense>` boundary. Two build failures, two one-line fixes — now a checklist item for every new route.
3. **Parallel agents need contracts, not just directories.** File ownership prevented overwrites, but prop contracts (ActivityComposer, MoveStageMenu) still drifted — the union/superset pattern (accept both call shapes) resolved it without breaking either caller.

## AI workflow note

Built with AI agents (Muse Spark) under human direction: a coordinator wrote the foundation (schema, domain logic, migrations), six parallel subagents built feature verticals (UI, auth/shell, kanban, CRUD, activities/dashboard, reports/settings), and the coordinator ran integration QA (typecheck, lint, tests, production build, bundle analysis). All AI output was reviewed: migrations were syntax-validated with pglast, domain logic is unit-tested, and cross-agent integration issues (type-system mismatch, prop contract drift, migration filename collision) were fixed at the source rather than worked around. The 2026 JD landscape explicitly values AI-assisted development done with review — this repo is the evidence.
