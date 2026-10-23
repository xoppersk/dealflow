#!/usr/bin/env node
// test-users.mjs — W4: create/refresh the two pre-confirmed test accounts
// used for the coordinator's two-account isolation proof:
//   dealflow.test.a@example.com ("Test A"), dealflow.test.b@example.com ("Test B")
// Passwords are generated in-script, written ONLY to scripts/.test-users.json
// (mode 600, gitignored) — never printed to stdout or any log.
// Idempotent: existing users are reused and their passwords reset via the
// Admin API, then the file is rewritten with the fresh passwords.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scripts', '.test-users.json');

const env = {};
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: supabase env missing from .env.local'); process.exit(2);
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ACCOUNTS = [
  { email: 'dealflow.test.a@example.com', full_name: 'Test A' },
  { email: 'dealflow.test.b@example.com', full_name: 'Test B' },
];
const randPassword = () => randomBytes(24).toString('base64url') + 'Aa1!';

const { data: list, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (listErr) { console.error('ERROR (list users):', listErr.message); process.exit(1); }

const out = [];
for (const acct of ACCOUNTS) {
  const password = randPassword();
  const existing = list.users.find((u) => u.email === acct.email);
  let user, action;
  if (existing) {
    const { data, error } = await sb.auth.admin.updateUserById(existing.id, {
      password, email_confirm: true, user_metadata: { full_name: acct.full_name },
    });
    if (error) { console.error(`ERROR (update ${acct.email}):`, error.message); process.exit(1); }
    user = data.user; action = 'existed — password reset via Admin API';
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: acct.email, password, email_confirm: true,
      user_metadata: { full_name: acct.full_name },
    });
    if (error) { console.error(`ERROR (create ${acct.email}):`, error.message); process.exit(1); }
    user = data.user; action = 'created (pre-confirmed)';
  }
  out.push({ email: acct.email, password, user_id: user.id, full_name: acct.full_name });
  console.log(`${acct.email}: ${action} (user ${user.id})`);
}

writeFileSync(OUT, JSON.stringify({ generated_at: new Date().toISOString(), users: out }, null, 2) + '\n', { mode: 0o600 });
console.log('Credentials file written: scripts/.test-users.json (mode 600). Passwords are not printed here by design.');
