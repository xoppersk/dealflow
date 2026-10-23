#!/usr/bin/env node
// seed-owner.mjs — W4: seed Sheku's owner workspace ("Sevyn Labs") with the
// v2 fixture sample data. SAMPLE DATA FOR THE OWNER ACCOUNT ONLY — real new
// signups start with an empty pipeline (provisioning trigger) and never see
// any of this.
//
// Idempotent: an app_settings marker (key 'seed_v2' in the target workspace)
// short-circuits re-runs; individual rows are also reused by natural key
// (company name / contact email / deal name+company) so a partial run can be
// safely resumed before the marker is written.
//
// Dates: fixtures were authored against "today" = 2026-10-06. Every fixture
// date is shifted by (run date − 2026-10-06) whole days so ages, due labels
// and stale states read exactly as designed on the day the seed runs.
//
// Credentials come from .env.local (service role). Passwords for dormant
// teammate auth users are generated in-script and NEVER printed or logged.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const loadJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

/* ---------------- env ---------------- */
const env = {};
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE) { console.error('ERROR: supabase env missing from .env.local'); process.exit(2); }

const sb = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const fail = (ctx, e) => { console.error(`ERROR (${ctx}):`, e?.message ?? e); process.exit(1); };
async function q(promise, ctx) { const { data, error } = await promise; if (error) fail(ctx, error); return data; }

/* ---------------- date shift ---------------- */
const ANCHOR = new Date(2026, 9, 6); // 2026-10-06, fixture "today"
const now = new Date();
const runDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const SHIFT = Math.round((runDay - ANCHOR) / 86_400_000);
console.log(`Date shift: +${SHIFT} days (fixture anchor 2026-10-06 -> run date ${runDay.toISOString().slice(0, 10)})`);
// Shift a 2026 fixture calendar date; returns a Date at UTC noon.
function shiftYMD(y, mo, d, hh = 12, mi = 0) {
  const base = new Date(Date.UTC(y, mo - 1, d));
  base.setUTCDate(base.getUTCDate() + SHIFT);
  base.setUTCHours(hh, mi, 0, 0);
  return base;
}
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
function shiftLabel(text, hh = 12, mi = 0) { // first "Mon D" found in text, year 2026
  const m = String(text ?? '').match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/);
  if (!m) return null;
  return shiftYMD(2026, MONTHS[m[1]], Number(m[2]), hh, mi);
}
function shiftISODate(iso) { // "2026-10-08" -> shifted "yyyy-mm-dd"
  const [y, mo, d] = iso.split('-').map(Number);
  return shiftYMD(y, mo, d).toISOString().slice(0, 10);
}
const iso = (d) => d.toISOString();

/* ---------------- fixtures ---------------- */
const stagesFx = loadJson('data/stages.json');
const dealsFx = loadJson('data/deals.json');
const closedFx = loadJson('data/closed.json');
const settingsFx = loadJson('data/settings.json');
const teamFx = loadJson('data/team.json');
const activitiesFx = loadJson('data/activities.json');
const companiesFx = loadJson('data/companies.json');
const contactsFx = loadJson('data/contacts.json');
const records = loadJson('data/records.json');
const mgmt = loadJson('data/mgmt.json');

const randPassword = () => randomBytes(24).toString('base64url') + 'Aa1!';

/* ---------------- target workspace ---------------- */
const OWNER_EMAIL = 'xoppersk@gmail.com';
const authList = await q(sb.auth.admin.listUsers({ perPage: 1000 }), 'list auth users').then((r) => r.users).catch((e) => fail('list auth users', e));
const ownerAuth = authList.find((u) => u.email === OWNER_EMAIL);
if (!ownerAuth) fail('owner lookup', new Error('owner auth user not found'));
const ownerId = ownerAuth.id;

const memberRows = await q(sb.from('workspace_members').select('workspace_id, role, is_owner').eq('user_id', ownerId).eq('is_owner', true), 'owner membership');
if (!memberRows?.length) fail('owner membership', new Error('no owner membership'));
const WS = memberRows[0].workspace_id;
const wsRow = await q(sb.from('workspaces').select('*').eq('id', WS).single(), 'workspace');
console.log(`Target workspace: "${wsRow.name}" (${WS}), scope ${wsRow.scope}`);

/* ---------------- idempotency marker ---------------- */
const marker = await q(sb.from('app_settings').select('key').eq('workspace_id', WS).eq('key', 'seed_v2').maybeSingle(), 'marker check');
if (marker) {
  const { count: n } = await sb.from('deals').select('id', { count: 'exact', head: true }).eq('workspace_id', WS).eq('source', 'Seed sample');
  console.log(`Already seeded (marker seed_v2 present; ${n} seeded deals exist). Nothing written.`);
  process.exit(0);
}
console.log('No seed marker — seeding. (Rows are reused by natural key if a partial run left any.)');

/* ---------------- stages ---------------- */
const stageRows = await q(sb.from('pipeline_stages').select('id, slug, default_probability').eq('workspace_id', WS), 'stages');
const stageBySlug = new Map(stageRows.map((s) => [s.slug, s]));
for (const s of stagesFx) if (!stageBySlug.has(s.id)) fail('stages', new Error(`stage slug missing: ${s.id}`));

/* ---------------- people ---------------- */
const personId = new Map(); // fixture person id -> auth/user uuid
personId.set('sheku-koroma', ownerId);
const shekuFx = teamFx.find((p) => p.id === 'sheku-koroma');
await q(sb.from('users').update({ avatar_bg: shekuFx.avatarBg, avatar_color: shekuFx.avatarColor, full_name: shekuFx.name }).eq('id', ownerId), 'owner avatar');

const roleMap = { Admin: 'admin', Manager: 'manager', Rep: 'rep' };
for (const p of teamFx.filter((t) => !t.you)) {
  let user = authList.find((u) => u.email === p.email);
  if (!user) {
    const { data, error } = await sb.auth.admin.createUser({
      email: p.email, password: randPassword(), email_confirm: true,
      user_metadata: { full_name: p.name },
    });
    if (error) fail(`create teammate ${p.id}`, error);
    user = data.user;
    console.log(`Created dormant auth user for ${p.name} (password generated in-script, not recorded).`);
  } else {
    console.log(`Teammate ${p.name} already exists — reusing.`);
  }
  personId.set(p.id, user.id);
  // Provisioning trigger gives each their own personal workspace (mirrors a
  // real signup); here we join them to Sevyn Labs with the fixture role.
  await q(sb.from('workspace_members').upsert(
    { workspace_id: WS, user_id: user.id, role: roleMap[p.role] ?? 'rep', is_owner: false },
    { onConflict: 'workspace_id,user_id' }), `member ${p.id}`);
  await q(sb.from('users').update({ avatar_bg: p.avatarBg, avatar_color: p.avatarColor }).eq('id', user.id), `avatar ${p.id}`);
}

/* ---------------- companies ---------------- */
const companyId = new Map(); // fixture company id -> uuid
const allCompanies = [
  ...companiesFx.map((c) => ({ fxId: c.id, name: c.name, mgBg: c.mgBg, mgColor: c.mgColor })),
  ...Object.entries(records.extraCompanies ?? {}).map(([fxId, c]) => ({ fxId, name: c.name, mgBg: c.mgBg, mgColor: c.mgColor })),
];
const existingCompanies = await q(sb.from('companies').select('id, name').eq('workspace_id', WS), 'existing companies');
for (const c of allCompanies) {
  const det = records.companyDetails?.[c.fxId] ?? {};
  const listExtra = records.companiesList?.[c.fxId] ?? {};
  // records.json harberlight override for monogram colours wins when present.
  const mgBg = listExtra.mgBg ?? c.mgBg;
  const mgColor = listExtra.mgColor ?? c.mgColor;
  const found = existingCompanies.find((e) => e.name === c.name);
  if (found) { companyId.set(c.fxId, found.id); continue; }
  const firstContact = det.firstContact ? shiftLabel(det.firstContact) : null;
  const row = {
    workspace_id: WS, name: c.name,
    industry: det.industryFull ?? null,
    website: det.website && !det.website.startsWith('[') ? det.website : null,
    size: det.sizeLong ?? null, size_label: det.sizeShort ?? det.sizeLong ?? null,
    city: det.city ?? null, mg_bg: mgBg ?? null, mg_color: mgColor ?? null,
    owner_id: ownerId, created_by: ownerId,
    ...(firstContact ? { created_at: iso(firstContact), updated_at: iso(firstContact) } : {}),
  };
  const inserted = await q(sb.from('companies').insert(row).select('id').single(), `company ${c.fxId}`);
  companyId.set(c.fxId, inserted.id);
}
console.log(`Companies ready: ${companyId.size}`);

/* ---------------- contacts ---------------- */
const contactId = new Map();
const existingContacts = await q(sb.from('contacts').select('id, email').eq('workspace_id', WS), 'existing contacts');
for (const c of contactsFx) {
  const det = records.contactDetails?.[c.id] ?? {};
  const listExtra = records.contactsList?.[c.id] ?? {};
  const found = existingContacts.find((e) => e.email === c.email);
  if (found) { contactId.set(c.id, found.id); continue; }
  const [firstName, ...rest] = c.name.split(' ');
  const earliest = det.history?.length ? shiftLabel(det.history[det.history.length - 1].date) : null;
  const row = {
    workspace_id: WS, first_name: firstName, last_name: rest.join(' '),
    email: c.email, title: c.title ?? null,
    phone: det.phone ?? null, prefers: det.prefers ?? null, met_through: det.metThrough ?? null,
    company_id: companyId.get(c.companyId) ?? null,
    owner_id: listExtra.ownerId ? personId.get(listExtra.ownerId) ?? ownerId : ownerId,
    created_by: ownerId,
    ...(earliest ? { created_at: iso(earliest), updated_at: iso(earliest) } : {}),
  };
  const inserted = await q(sb.from('contacts').insert(row).select('id').single(), `contact ${c.id}`);
  contactId.set(c.id, inserted.id);
}
console.log(`Contacts ready: ${contactId.size}`);

/* ---------------- open deals ---------------- */
const dealId = new Map();
const existingDeals = await q(sb.from('deals').select('id, name, company_id').eq('workspace_id', WS), 'existing deals');
const dealStageEntered = new Map();
for (let i = 0; i < dealsFx.length; i++) {
  const d = dealsFx[i];
  const compUuid = companyId.get(d.companyId);
  dealId.set(d.id, existingDeals.find((e) => e.name === d.name && e.company_id === compUuid)?.id ?? null);
  const stage = stageBySlug.get(d.stageId);
  const entered = d.id === 'solace-energy-field-team-package'
    ? null // set from the Move activity below
    : new Date(now.getTime() - (d.daysInStage ?? 0) * 86_400_000);
  if (entered) dealStageEntered.set(d.id, entered);
  if (dealId.get(d.id)) continue;
  const created = entered ? new Date(entered.getTime() - (2 + (i % 4)) * 86_400_000) : new Date(now.getTime() - 6 * 86_400_000);
  const touched = shiftLabel(d.lastTouchLabel) ?? entered ?? now;
  const row = {
    workspace_id: WS, name: d.name, company_id: compUuid, stage_id: stage.id,
    value: d.value, probability: stage.default_probability,
    close_date: d.closeDate ? shiftISODate(d.closeDate) : null,
    owner_id: personId.get(d.ownerId) ?? ownerId, created_by: ownerId,
    source: 'Seed sample', board_position: i,
    next_step_text: d.nextStep?.text ?? null,
    next_step_due: d.nextStep?.dueDate ? shiftISODate(d.nextStep.dueDate) : null,
    composition: d.detail?.composition ?? [],
    created_at: iso(created), updated_at: iso(touched),
    last_touched_at: iso(touched),
    ...(entered ? { stage_entered_at: iso(entered) } : {}),
  };
  const inserted = await q(sb.from('deals').insert(row).select('id').single(), `deal ${d.id}`);
  dealId.set(d.id, inserted.id);
}
console.log(`Open deals ready: ${dealsFx.length}`);

/* deal_contacts: explicit per-deal people (Bracken) + each company's contacts
   on that company's open deal, roles from records.json contactDetails. */
const existingDC = await q(sb.from('deal_contacts').select('deal_id, contact_id').eq('workspace_id', WS), 'existing deal_contacts');
const dcSeen = new Set(existingDC.map((r) => `${r.deal_id}:${r.contact_id}`));
async function linkContact(dealFxId, contactFxId, role) {
  const du = dealId.get(dealFxId), cu = contactId.get(contactFxId);
  if (!du || !cu || dcSeen.has(`${du}:${cu}`)) return;
  await q(sb.from('deal_contacts').insert({ workspace_id: WS, deal_id: du, contact_id: cu, role: role ?? null }), 'deal_contact');
  dcSeen.add(`${du}:${cu}`);
}
for (const d of dealsFx) {
  for (const p of d.detail?.people ?? []) await linkContact(d.id, p.contactId, p.role);
}
for (const c of contactsFx) {
  const deal = dealsFx.find((d) => d.companyId === c.companyId);
  if (deal) await linkContact(deal.id, c.id, records.contactDetails?.[c.id]?.roleOnDeal ?? null);
}
console.log(`Deal_contacts ready: ${dcSeen.size}`);

/* ---------------- activities + stage history ---------------- */
const TYPE_MAP = { Call: ['call', 'Call'], Email: ['email', 'Email'], Meeting: ['meeting', 'Meeting'], 'Meeting booked': ['meeting', 'Meeting booked'], Note: ['note', 'Note'], Task: ['note', 'Task'] };
const existingActs = await q(sb.from('activities').select('id', { count: 'exact', head: true }).eq('workspace_id', WS), 'existing activities');
let actCount = 0, histCount = 0;
if (!existingActs) { /* count head returns null data; guard below re-checks */ }
const actExisting = await q(sb.from('activities').select('id').eq('workspace_id', WS), 'activities list');
if (actExisting.length === 0) {
  for (const a of activitiesFx) {
    const dealUuid = dealId.get(a.dealId);
    const dealFx = dealsFx.find((d) => d.id === a.dealId);
    const actor = personId.get(a.ownerId) ?? ownerId;
    if (a.type === 'Move') {
      const from = stageBySlug.get('discovery'), to = stageBySlug.get('proposal');
      const movedAt = shiftYMD(2026, 10, 6, Number(a.timeLabel.split(':')[0]), Number(a.timeLabel.split(':')[1]));
      await q(sb.from('stage_history').insert({
        workspace_id: WS, deal_id: dealUuid, from_stage_id: from.id, to_stage_id: to.id,
        changed_by: actor, changed_at: iso(movedAt),
      }), 'stage_history move');
      histCount++;
      await q(sb.from('deals').update({ stage_entered_at: iso(movedAt) }).eq('id', dealUuid), 'solace stage_entered_at');
      dealStageEntered.set(a.dealId, movedAt);
      continue;
    }
    const [type, typeLabel] = TYPE_MAP[a.type] ?? ['note', a.type];
    const isTask = a.type === 'Task';
    let occurred;
    if (a.dayLabel === 'Today') occurred = shiftYMD(2026, 10, 6, ...a.timeLabel.split(':').map(Number));
    else if (a.dayLabel === 'Yesterday') occurred = shiftYMD(2026, 10, 5, ...a.timeLabel.split(':').map(Number));
    else occurred = shiftLabel(a.timeLabel, 9, 0); // overdue tasks: timeLabel is a date
    const primaryContact = contactsFx.find((c) => c.companyId === dealFx?.companyId);
    const row = {
      workspace_id: WS, type, type_label: typeLabel,
      subject: a.subject, body: a.detail ?? a.meta ?? null,
      occurred_at: iso(occurred), created_at: iso(occurred), updated_at: iso(occurred),
      deal_id: dealUuid, contact_id: primaryContact ? contactId.get(primaryContact.id) : null,
      owner_id: actor, is_follow_up: isTask,
      ...(isTask ? { due_at: iso(occurred) } : {}),
    };
    await q(sb.from('activities').insert(row), `activity ${a.id}`);
    actCount++;
  }
  // Bracken stage progression from deals.json detail.stageHistory
  // (Sep 3 entry = creation in New lead; transitions Sep 8 / Sep 18 / Oct 1).
  const bracken = dealsFx.find((d) => d.id === 'bracken-works-annual-operations-plan');
  const transitions = [['new-lead', 'discovery', 'Sep 8'], ['discovery', 'proposal', 'Sep 18'], ['proposal', 'negotiation', 'Oct 1']];
  for (const [fromSlug, toSlug, label] of transitions) {
    await q(sb.from('stage_history').insert({
      workspace_id: WS, deal_id: dealId.get(bracken.id),
      from_stage_id: stageBySlug.get(fromSlug).id, to_stage_id: stageBySlug.get(toSlug).id,
      changed_by: personId.get(bracken.ownerId) ?? ownerId, changed_at: iso(shiftLabel(label)),
    }), 'stage_history bracken');
    histCount++;
  }
  console.log(`Activities inserted: ${actCount}; stage_history inserted: ${histCount}`);
} else {
  console.log(`Activities already present (${actExisting.length}) — skipping activity/history insert.`);
}
/* ---------------- closed deals (synthesized sample data, owner only) -------
   29 deals matching closed.json aggregates exactly for the Won set:
   daysToClose [26,31,33,34,34,35,36,38,39] (sum 306, avg 34), 9 won / 20 lost
   -> winRate round(9/29*100) = 31. created_at = closed_at - daysToClose at
   UTC noon so whole-day recomputation is exact. */
const existingClosed = await q(sb.from('deals').select('id').eq('workspace_id', WS).eq('source', 'Seed sample').not('closed_at', 'is', null), 'existing closed');
if (existingClosed.length === 0) {
  const wonStage = stageBySlug.get('won'), lostStage = stageBySlug.get('lost');
  const companyFxIds = [...companyId.keys()];
  const ownersCycle = [ownerId, ownerId, ownerId, personId.get('priya-shah'), ownerId, personId.get('maya-jordan'), ownerId, personId.get('andre-ruiz')];
  const descriptors = ['Expansion', 'Renewal', 'Pilot programme', 'Rollout', 'Services plan', 'Annual plan', 'Onboarding', 'Platform upgrade', 'Support contract', 'Implementation'];
  const lostDays = [12, 18, 21, 24, 27, 29, 30, 32, 33, 35, 36, 37, 38, 40, 42, 44, 45, 47, 49, 52];
  let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const rows = [];
  const mk = (kind, days, idx) => {
    const daysAgo = 1 + Math.floor((idx * 34) / 28); // spread across last ~5 weeks
    const closed = new Date(Date.UTC(runDay.getUTCFullYear(), runDay.getUTCMonth(), runDay.getUTCDate(), 12) - daysAgo * 86_400_000);
    const created = new Date(closed.getTime() - days * 86_400_000);
    const compFx = companyFxIds[idx % companyFxIds.length];
    rows.push({
      workspace_id: WS, name: descriptors[idx % descriptors.length],
      company_id: companyId.get(compFx), stage_id: kind === 'won' ? wonStage.id : lostStage.id,
      value: Math.round((18000 + rnd() * 102000) / 500) * 500,
      probability: kind === 'won' ? 100 : 0,
      close_date: closed.toISOString().slice(0, 10),
      owner_id: ownersCycle[idx % ownersCycle.length], created_by: ownerId,
      source: 'Seed sample', board_position: 100 + idx, composition: [],
      created_at: iso(created), updated_at: iso(closed), last_touched_at: iso(closed),
      stage_entered_at: iso(closed), closed_at: iso(closed),
    });
  };
  closedFx.daysToClose.forEach((d, i) => mk('won', d, i));
  lostDays.forEach((d, i) => mk('lost', d, 9 + i));
  await q(sb.from('deals').insert(rows), 'closed deals');
  console.log(`Closed deals inserted: ${rows.length} (9 won / 20 lost, synthesized sample data)`);
} else {
  console.log(`Closed deals already present (${existingClosed.length}) — skipping.`);
}

/* ---------------- pending invite ---------------- */
const inviteEmail = settingsFx.pendingInviteEmail;
const existingInvite = await q(sb.from('invites').select('id').eq('workspace_id', WS).eq('email', inviteEmail).is('accepted_at', null).maybeSingle(), 'invite check');
if (!existingInvite) {
  const roleLabel = mgmt.teamScreen?.invite?.role ?? 'Rep';
  await q(sb.from('invites').insert({
    workspace_id: WS, email: inviteEmail, role: roleMap[roleLabel] ?? 'rep',
    token: randomUUID(), invited_by: ownerId, accepted_at: null,
    created_at: iso(shiftYMD(2026, 10, 5, 16, 0)), expires_at: iso(shiftYMD(2026, 10, 12, 16, 0)),
  }), 'invite');
  console.log(`Pending invite inserted: ${inviteEmail} as ${roleLabel} (expires ${shiftISODate('2026-10-12')})`);
} else console.log('Pending invite already present — skipping.');

/* ---------------- marker ---------------- */
await q(sb.from('app_settings').upsert(
  { workspace_id: WS, key: 'seed_v2', value: { seeded_at: new Date().toISOString(), shift_days: SHIFT, source: 'scripts/seed-owner.mjs' } },
  { onConflict: 'workspace_id,key' }), 'marker write');
console.log('Marker seed_v2 written.');

/* ---------------- verification ---------------- */
async function count(table, extra = (x) => x, col = 'id') {
  const { count: c, error } = await extra(sb.from(table).select(col, { count: 'exact', head: true })).eq('workspace_id', WS);
  if (error) fail(`verify ${table}`, error);
  return c;
}
const v = {};
v.companies = await count('companies');
v.contacts = await count('contacts');
v.deal_contacts = await count('deal_contacts', (x) => x, 'deal_id');
v.activities = await count('activities');
v.stage_history = await count('stage_history');
v.invites_pending = await count('invites', (x) => x.is('accepted_at', null));
const allDeals = await q(sb.from('deals').select('id, stage_id, created_at, closed_at').eq('workspace_id', WS).eq('source', 'Seed sample'), 'verify deals');
const wonUuid = stageBySlug.get('won').id, lostUuid = stageBySlug.get('lost').id;
const won = allDeals.filter((d) => d.stage_id === wonUuid);
const lost = allDeals.filter((d) => d.stage_id === lostUuid);
const open = allDeals.filter((d) => d.stage_id !== wonUuid && d.stage_id !== lostUuid);
const days = won.map((d) => Math.floor((new Date(d.closed_at) - new Date(d.created_at)) / 86_400_000)).sort((a, b) => a - b);
const avg = Math.round(days.reduce((s, n) => s + n, 0) / days.length);
const winRate = Math.round((won.length / (won.length + lost.length)) * 100);
console.log('--- VERIFICATION (Sevyn Labs workspace) ---');
console.log(`companies=${v.companies} contacts=${v.contacts} deal_contacts=${v.deal_contacts} activities=${v.activities} stage_history=${v.stage_history} pending_invites=${v.invites_pending}`);
console.log(`deals: open=${open.length} won=${won.length} lost=${lost.length} total=${allDeals.length}`);
console.log(`closed aggregates from DB: won=${won.length} (fixture ${closedFx.won}), lost=${lost.length} (fixture ${closedFx.lost}), winRate=${winRate}% (fixture ${closedFx.winRate}), daysToClose=[${days.join(',')}] (fixture [${closedFx.daysToClose.join(',')}]), avg=${avg} (fixture ${closedFx.averageDaysToClose})`);
const aggregatesOk = won.length === closedFx.won && lost.length === closedFx.lost && winRate === closedFx.winRate && avg === closedFx.averageDaysToClose && JSON.stringify(days) === JSON.stringify(closedFx.daysToClose);
console.log(`closed aggregates match closed.json: ${aggregatesOk ? 'YES' : 'NO'}`);
// No seeded rows anywhere else: CRM tables outside this workspace must be empty.
let leak = 0;
for (const t of ['companies', 'contacts', 'deals', 'activities', 'stage_history']) {
  const { count: c, error } = await sb.from(t).select('id', { count: 'exact', head: true }).neq('workspace_id', WS);
  if (error) fail(`leak check ${t}`, error);
  leak += c ?? 0;
}
console.log(`rows in OTHER workspaces (companies/contacts/deals/activities/stage_history): ${leak} (expected 0; teammates' personal workspaces hold only their trigger-created starter stages)`);
if (!aggregatesOk || leak !== 0) process.exit(1);
console.log('Seed complete.');
