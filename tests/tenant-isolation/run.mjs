// tests/tenant-isolation/run.mjs
// Verifies user A cannot read/write org B rows and vice versa.
// Exit 0 pass, 1 config error, 2 CRITICAL leak.
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { guardOrExit, must } from "./lib/guard.mjs";

guardOrExit();
const URL = must("LOAD_SUPABASE_URL");
const ANON = must("LOAD_SUPABASE_ANON_KEY");

const __dirname = dirname(fileURLToPath(import.meta.url));
let state;
try {
  state = JSON.parse(readFileSync(`${__dirname}/.state.json`, "utf8"));
} catch {
  console.error("Missing tests/tenant-isolation/.state.json — run seed.mjs first.");
  process.exit(1);
}

const READ_TABLES = ["decision_ledger", "audit_log", "evidence_sources"];
const results = [];
let leaks = 0;

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    console.error(`Sign-in failed for ${email}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const j = await res.json();
  return j.access_token;
}

function headers(token) {
  return { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function probeRead(token, callerTag, table, otherOrgId) {
  const url = `${URL}/rest/v1/${table}?organization_id=eq.${otherOrgId}&limit=5`;
  const res = await fetch(url, { headers: headers(token) });
  const body = res.ok ? await res.json() : null;
  const rowCount = Array.isArray(body) ? body.length : 0;
  const pass = rowCount === 0;
  if (!pass) leaks++;
  results.push({
    kind: "read", caller: callerTag, table,
    status: res.status, row_count: rowCount, pass,
    severity: pass ? "ok" : "CRITICAL",
  });
}

async function probeWrite(token, callerTag, otherOrgId) {
  const url = `${URL}/rest/v1/decision_ledger`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers(token), Prefer: "return=representation" },
    body: JSON.stringify({
      organization_id: otherOrgId,
      title: `cross-tenant-write-probe-${callerTag}-${Date.now()}`,
      decision_type: "operational",
      status: "pending",
    }),
  });
  const inserted = res.status >= 200 && res.status < 300;
  if (inserted) leaks++;
  results.push({
    kind: "write", caller: callerTag, table: "decision_ledger",
    status: res.status, pass: !inserted,
    severity: inserted ? "CRITICAL" : "ok",
  });
}

const tokenA = await signIn(state.users.a.email, state.users.a.password);
const tokenB = await signIn(state.users.b.email, state.users.b.password);

for (const t of READ_TABLES) {
  await probeRead(tokenA, "a", t, state.orgs.b.id);
  await probeRead(tokenB, "b", t, state.orgs.a.id);
}
await probeWrite(tokenA, "a", state.orgs.b.id);
await probeWrite(tokenB, "b", state.orgs.a.id);

console.log(JSON.stringify({ run_tag: state.run_tag, results, leaks }, null, 2));

if (leaks > 0) {
  console.error(`\nCRITICAL: ${leaks} cross-tenant probe(s) succeeded. See results above.`);
  process.exit(2);
}
console.log(`\nPASS: ${results.length} probes, 0 leaks.`);
