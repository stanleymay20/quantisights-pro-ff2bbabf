// tests/tenant-isolation/seed.mjs
// Creates two isolated orgs, one user each, and one row per surface.
// Staging/preview ONLY (allow-list enforced).
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { guardOrExit, must } from "./lib/guard.mjs";

const TARGET = guardOrExit();
const URL = must("LOAD_SUPABASE_URL");
const KEY = must("SUPABASE_SERVICE_ROLE_KEY");

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const pw = () => randomBytes(24).toString("hex");
const runTag = `ti-${Date.now().toString(36)}`;

async function upsertOrg(name) {
  const { data, error } = await sb.from("organizations")
    .insert({ name, industry: "loadtest" })
    .select("id, name")
    .single();
  if (error) { console.error(`org ${name}:`, error.message); process.exit(1); }
  return data;
}

async function seedUser(orgTag, orgId) {
  const email = `${runTag}-${orgTag}@quantivis.test`;
  const password = pw();
  const { data, error } = await sb.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { is_demo: true, is_loadtest: true, org_tag: orgTag, run_tag: runTag },
  });
  if (error) { console.error(`user ${email}:`, error.message); process.exit(1); }
  const userId = data.user.id;
  const { error: mErr } = await sb.from("organization_members")
    .upsert({ organization_id: orgId, user_id: userId, role: "member" });
  if (mErr) { console.error(`member ${email}:`, mErr.message); process.exit(1); }
  return { email, password, user_id: userId };
}

// Canary rows are MANDATORY for every table run.mjs probes. If any insert
// fails, seed exits non-zero — otherwise run.mjs would report vacuous PASSes
// against empty tables.
async function seedRows(orgId, userId, orgTag) {
  const rows = {};

  const { data: dec, error: decErr } = await sb.from("decision_ledger").insert({
    organization_id: orgId,
    title: `${runTag} canary ${orgTag}`,
    decision_type: "operational",
    status: "pending",
    created_by: userId,
  }).select("id").single();
  if (decErr || !dec?.id) {
    console.error(`FATAL canary decision_ledger ${orgTag}: ${decErr?.message || "no id returned"}`);
    process.exit(1);
  }
  rows.decision_ledger = dec.id;

  const { data: audit, error: auditErr } = await sb.from("audit_log").insert({
    organization_id: orgId,
    actor_id: userId,
    actor_type: "user",
    action_type: "tenant_isolation_seed",
    resource_type: "test",
    payload: { run_tag: runTag, org_tag: orgTag },
  }).select("id").single();
  if (auditErr || !audit?.id) {
    console.error(`FATAL canary audit_log ${orgTag}: ${auditErr?.message || "no id returned"}`);
    process.exit(1);
  }
  rows.audit_log = audit.id;

  const { data: ev, error: evErr } = await sb.from("evidence_sources").insert({
    organization_id: orgId,
    source_type: "internal",
    source_name: `${runTag}-${orgTag}`,
  }).select("id").single();
  if (evErr || !ev?.id) {
    console.error(`FATAL canary evidence_sources ${orgTag}: ${evErr?.message || "no id returned"}`);
    process.exit(1);
  }
  rows.evidence_sources = ev.id;

  return rows;
}

console.log(`Seeding tenant-isolation test (run=${runTag}, target=${TARGET})…`);

const orgA = await upsertOrg(`org_loadtest_a_${runTag}`);
const orgB = await upsertOrg(`org_loadtest_b_${runTag}`);

const userA = await seedUser("a", orgA.id);
const userB = await seedUser("b", orgB.id);

const rowsA = await seedRows(orgA.id, userA.user_id, "a");
const rowsB = await seedRows(orgB.id, userB.user_id, "b");

const artifact = {
  run_tag: runTag,
  target: TARGET,
  created_at: new Date().toISOString(),
  orgs: { a: orgA, b: orgB },
  users: { a: userA, b: userB },
  seeded_rows: { a: rowsA, b: rowsB },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });
writeFileSync(`${__dirname}/.state.json`, JSON.stringify(artifact, null, 2));
console.log(`Seeded orgs A=${orgA.id} B=${orgB.id}. State → tests/tenant-isolation/.state.json`);

