// tests/tenant-isolation/run.mjs
// Verifies user A cannot read/write org B rows and vice versa.
//
// Verdict taxonomy (per probe):
//   - isolation_pass    RLS correctly blocked cross-tenant access
//   - isolation_leak    CRITICAL: cross-tenant read returned rows or write succeeded
//   - framework_failure Something in this harness/env is wrong (missing canary, malformed JSON, network)
//   - app_error         Unexpected API status (5xx, 400/404/409/422, schema error) — not a leak, but not a valid pass
//
// Exit codes:
//   0  every probe = isolation_pass
//   1  configuration or framework_failure or app_error present (no leaks)
//   2  at least one isolation_leak (CRITICAL)
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

// Canaries are MANDATORY: a read probe against a table with no seeded row is
// vacuously "empty" and cannot distinguish RLS-blocked from just-nothing-there.
const canaries = state.seeded_rows || {};
const REQUIRED_TABLES = ["decision_ledger", "audit_log", "evidence_sources"];
const missingCanaries = [];
for (const side of ["a", "b"]) {
  const c = canaries[side] || {};
  for (const t of REQUIRED_TABLES) {
    if (!c[t]) missingCanaries.push(`${side}.${t}`);
  }
}
if (missingCanaries.length > 0) {
  console.error(
    "Refusing to run: seed did not create canary rows for: " + missingCanaries.join(", ") +
    "\nRun seed.mjs again — vacuous isolation tests are not allowed.",
  );
  process.exit(1);
}

const READ_TABLES = REQUIRED_TABLES;
const results = [];
let leaks = 0;
let frameworkFailures = 0;
let appErrors = 0;

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

async function readBody(res) {
  const text = await res.text();
  let parsed = null;
  try { parsed = text.length > 0 ? JSON.parse(text) : null; } catch { /* leave null */ }
  return { text, parsed };
}

function push(entry) {
  results.push(entry);
  if (entry.verdict === "isolation_leak") leaks++;
  else if (entry.verdict === "framework_failure") frameworkFailures++;
  else if (entry.verdict === "app_error") appErrors++;
}

async function probeRead(token, callerTag, actorOrgId, targetOrgId, table) {
  const url = `${URL}/rest/v1/${table}?organization_id=eq.${targetOrgId}&limit=5`;
  const base = { kind: "read", caller: callerTag, actor_org: actorOrgId, target_org: targetOrgId, table };
  let res;
  try {
    res = await fetch(url, { headers: headers(token) });
  } catch (e) {
    push({ ...base, status: 0, body: `network_error: ${e.message}`, verdict: "framework_failure", severity: "framework" });
    return;
  }
  const { text, parsed } = await readBody(res);

  // Strict contract: 200 + JSON array + length 0 = pass. Anything else is not a valid pass.
  if (res.status !== 200) {
    push({
      ...base,
      status: res.status,
      body: text.slice(0, 300),
      verdict: "app_error",
      severity: "app",
      note: `expected 200; got ${res.status}`,
    });
    return;
  }
  if (!Array.isArray(parsed)) {
    push({
      ...base,
      status: 200,
      body: text.slice(0, 300),
      verdict: "framework_failure",
      severity: "framework",
      note: "response is 200 but body is not a JSON array",
    });
    return;
  }
  if (parsed.length === 0) {
    push({ ...base, status: 200, row_count: 0, verdict: "isolation_pass", severity: "ok" });
    return;
  }
  // Non-empty result across tenants = CRITICAL
  push({
    ...base,
    status: 200,
    row_count: parsed.length,
    body: JSON.stringify(parsed).slice(0, 300),
    verdict: "isolation_leak",
    severity: "CRITICAL",
  });
}

// Write-probe expected rejection classes.
// - 401 unauthenticated (should not happen; we sign in), 403 RLS/forbidden
// - PostgREST returns 403 with code "42501" (insufficient_privilege) OR
//   a "new row violates row-level security policy" error object on RLS deny.
// Anything else (400 schema, 404 missing table, 409 conflict, 422 unprocessable,
// 5xx, malformed) is a framework/app error — NOT a valid isolation pass.
function classifyWrite(status, parsed, text) {
  if (status >= 200 && status < 300) {
    return { verdict: "isolation_leak", severity: "CRITICAL", note: "cross-tenant insert accepted" };
  }
  const code = parsed && typeof parsed === "object" ? String(parsed.code || "") : "";
  const msg = parsed && typeof parsed === "object" ? String(parsed.message || "") : text || "";
  const looksLikeRls =
    code === "42501" ||
    /row-level security|row level security|insufficient.privilege|permission denied/i.test(msg);
  if (status === 401 || status === 403 || looksLikeRls) {
    return { verdict: "isolation_pass", severity: "ok", note: `rls_reject status=${status} code=${code || "-"}` };
  }
  // Everything else is not proof of isolation.
  return {
    verdict: "app_error",
    severity: "app",
    note: `unexpected rejection class: status=${status} code=${code || "-"}`,
  };
}

async function probeWrite(token, callerTag, actorOrgId, targetOrgId) {
  const url = `${URL}/rest/v1/decision_ledger`;
  const base = {
    kind: "write", caller: callerTag, actor_org: actorOrgId, target_org: targetOrgId, table: "decision_ledger",
  };
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { ...headers(token), Prefer: "return=representation" },
      body: JSON.stringify({
        organization_id: targetOrgId,
        title: `cross-tenant-write-probe-${callerTag}-${Date.now()}`,
        decision_type: "operational",
        status: "pending",
      }),
    });
  } catch (e) {
    push({ ...base, status: 0, body: `network_error: ${e.message}`, verdict: "framework_failure", severity: "framework" });
    return;
  }
  const { text, parsed } = await readBody(res);
  const cls = classifyWrite(res.status, parsed, text);
  push({ ...base, status: res.status, body: text.slice(0, 300), ...cls });
}

const tokenA = await signIn(state.users.a.email, state.users.a.password);
const tokenB = await signIn(state.users.b.email, state.users.b.password);

for (const t of READ_TABLES) {
  await probeRead(tokenA, "a", state.orgs.a.id, state.orgs.b.id, t);
  await probeRead(tokenB, "b", state.orgs.b.id, state.orgs.a.id, t);
}
await probeWrite(tokenA, "a", state.orgs.a.id, state.orgs.b.id);
await probeWrite(tokenB, "b", state.orgs.b.id, state.orgs.a.id);

const summary = {
  run_tag: state.run_tag,
  totals: {
    probes: results.length,
    isolation_pass: results.filter((r) => r.verdict === "isolation_pass").length,
    isolation_leak: leaks,
    framework_failure: frameworkFailures,
    app_error: appErrors,
  },
  results,
};
console.log(JSON.stringify(summary, null, 2));

if (leaks > 0) {
  console.error(`\nCRITICAL: ${leaks} cross-tenant probe(s) leaked. Exit 2.`);
  process.exit(2);
}
if (frameworkFailures > 0 || appErrors > 0) {
  console.error(
    `\nINVALID: ${frameworkFailures} framework_failure(s), ${appErrors} app_error(s). ` +
      `No leaks detected, but the run is not a valid PASS. Exit 1.`,
  );
  process.exit(1);
}
console.log(`\nPASS: ${results.length} probes, 0 leaks, 0 framework/app errors.`);
