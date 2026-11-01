// Auto-transfers all data from the repo's SQL migrations into the DB in
// SUPABASE_DB_URL. Runs every statement independently (autocommit), so
// "already exists" / FK-demo errors are skipped and the real data still loads.
//
// Usage (PowerShell/bash), from the project root:
//   1. Supabase dashboard -> Connect -> copy the "Session pooler" URI,
//      put your DB password in it.
//   2. SUPABASE_DB_URL="postgresql://...pooler.supabase.com:5432/postgres" bun scripts/transfer-data.mjs
//      (bun add pg first, or: npm i pg && node scripts/transfer-data.mjs)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("Set SUPABASE_DB_URL to your Supabase Postgres connection string.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const migDir = join(here, "..", "supabase", "migrations");

// Split SQL into statements, respecting '…' strings (with '' escaping),
// $tag$…$tag$ dollar quotes, -- line comments and /* */ block comments.
function splitStatements(sql) {
  const out = [];
  let buf = "";
  let i = 0;
  const n = sql.length;
  let inS = false;          // single-quote string
  let dollar = null;        // active dollar-quote tag, e.g. "$$" or "$f$"
  while (i < n) {
    const c = sql[i];
    const two = sql.slice(i, i + 2);
    if (!inS && !dollar && two === "--") {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? n : nl;
      continue;
    }
    if (!inS && !dollar && two === "/*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (!inS && !dollar && c === "$") {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) { dollar = m[0]; buf += dollar; i += dollar.length; continue; }
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { buf += dollar; i += dollar.length; dollar = null; continue; }
      buf += c; i++; continue;
    }
    if (inS) {
      if (c === "'" && sql[i + 1] === "'") { buf += "''"; i += 2; continue; }
      if (c === "'") { inS = false; buf += c; i++; continue; }
      buf += c; i++; continue;
    }
    if (c === "'") { inS = true; buf += c; i++; continue; }
    if (c === ";") { const s = buf.trim(); if (s) out.push(s); buf = ""; i++; continue; }
    buf += c; i++;
  }
  const s = buf.trim();
  if (s) out.push(s);
  return out;
}

const files = readdirSync(migDir).filter(f => /^\d.*\.sql$/.test(f)).sort();
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

let ok = 0, fail = 0;
const errors = [];
for (const f of files) {
  const stmts = splitStatements(readFileSync(join(migDir, f), "utf8"));
  for (const stmt of stmts) {
    try { await client.query(stmt); ok++; }
    catch (e) { fail++; errors.push(`${f}: ${e.message} :: ${stmt.slice(0, 90).replace(/\s+/g, " ")}`); }
  }
}
await client.end();

console.log(`\nDone. ${files.length} files, ${ok} statements OK, ${fail} skipped/failed.`);
if (errors.length) {
  console.log(`\nFirst ${Math.min(errors.length, 25)} skipped (mostly harmless "already exists"):`);
  for (const e of errors.slice(0, 25)) console.log("  - " + e);
}
