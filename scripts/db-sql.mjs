#!/usr/bin/env node
// db-sql.mjs — run SQL against the Dealflow Supabase project via the
// Management API database/query endpoint.
//
// Usage:
//   node scripts/db-sql.mjs <file.sql>          # run statements from a file
//   node scripts/db-sql.mjs --query "select 1"  # run an ad-hoc query
//
// The access token is read from ~/.config/saloneconnect/credentials.json
// (key: supabase_access_token). It is NEVER printed. The sandbox egress
// proxy drops connections intermittently, so every statement is retried
// with backoff (up to 5 attempts). Statements are split respecting
// dollar-quoted function bodies, quoted strings and comments.
//
// Output: one line per statement (OK / row count / error). For queries
// that return rows, the rows are printed as JSON.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROJECT_REF = 'hqumhzcxbarozuidpjtq';
const ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

function loadToken() {
  const path = join(homedir(), '.config', 'saloneconnect', 'credentials.json');
  const creds = JSON.parse(readFileSync(path, 'utf8'));
  const token = creds.supabase_access_token;
  if (!token) {
    console.error('ERROR: supabase_access_token missing from credentials file');
    process.exit(2);
  }
  return token;
}

// Split a SQL script into statements, honouring $$...$$ / $tag$...$tag$
// dollar quoting, single/double quoted strings, line and block comments.
function splitStatements(sql) {
  const stmts = [];
  let cur = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    // line comment
    if (ch === '-' && sql[i + 1] === '-') {
      const j = sql.indexOf('\n', i);
      const end = j === -1 ? n : j;
      cur += sql.slice(i, end);
      i = end;
      continue;
    }
    // block comment
    if (ch === '/' && sql[i + 1] === '*') {
      const j = sql.indexOf('*/', i + 2);
      const end = j === -1 ? n : j + 2;
      cur += sql.slice(i, end);
      i = end;
      continue;
    }
    // single-quoted string ('' escape)
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue; }
          break;
        }
        j++;
      }
      cur += sql.slice(i, Math.min(j + 1, n));
      i = Math.min(j + 1, n);
      continue;
    }
    // double-quoted identifier
    if (ch === '"') {
      let j = i + 1;
      while (j < n && sql[j] !== '"') j++;
      cur += sql.slice(i, Math.min(j + 1, n));
      i = Math.min(j + 1, n);
      continue;
    }
    // dollar-quoted string
    if (ch === '$') {
      const m = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (m) {
        const tag = m[0];
        const j = sql.indexOf(tag, i + tag.length);
        const end = j === -1 ? n : j + tag.length;
        cur += sql.slice(i, end);
        i = end;
        continue;
      }
    }
    if (ch === ';') {
      const s = cur.trim();
      if (s) stmts.push(s);
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  const tail = cur.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runQuery(token, query) {
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const text = await res.text();
      if (res.ok) {
        try { return JSON.parse(text); } catch { return text; }
      }
      // 4xx SQL errors are deterministic — surface, don't retry forever,
      // except 429 (rate limit).
      if (res.status !== 429 && res.status < 500) {
        const err = new Error(`HTTP ${res.status}: ${text.slice(0, 2000)}`);
        err.fatal = true;
        throw err;
      }
      lastErr = new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
    }
    if (attempt < 5) await sleep(1000 * attempt + Math.random() * 500);
  }
  throw lastErr;
}

async function main() {
  const args = process.argv.slice(2);
  let sql;
  if (args[0] === '--query') {
    sql = args.slice(1).join(' ');
  } else if (args[0]) {
    sql = readFileSync(args[0], 'utf8');
  } else {
    console.error('Usage: db-sql.mjs <file.sql> | --query "<sql>"');
    process.exit(2);
  }
  const token = loadToken();
  const stmts = splitStatements(sql);
  console.log(`Running ${stmts.length} statement(s) against ${PROJECT_REF}...`);
  let failed = 0;
  for (let idx = 0; idx < stmts.length; idx++) {
    const stmt = stmts[idx];
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 90);
    try {
      const result = await runQuery(token, stmt);
      if (Array.isArray(result)) {
        console.log(`[${idx + 1}/${stmts.length}] OK (${result.length} row(s)) :: ${preview}`);
        if (result.length > 0) console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`[${idx + 1}/${stmts.length}] OK :: ${preview}`);
        if (result) console.log(String(result).slice(0, 2000));
      }
    } catch (e) {
      failed++;
      console.error(`[${idx + 1}/${stmts.length}] ERROR :: ${preview}`);
      console.error(`    ${e.message}`);
    }
  }
  if (failed > 0) {
    console.error(`DONE with ${failed} failed statement(s).`);
    process.exit(1);
  }
  console.log('DONE — all statements succeeded.');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
