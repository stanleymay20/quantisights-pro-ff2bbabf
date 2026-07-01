// tests/tenant-isolation/seed.mjs
// Creates two isolated orgs, one user each, and one row per surface.
// Staging/preview only.
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const must = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
  return v;
};

const TARGET = must("LOAD_TARGET");
if (TARGET === "production") {
  console.error("Refusing to seed against production.");
  process.exit(1);
}
if (!["staging", "preview"].includes(TARGET)) {
  console.error(`LOAD_TARGET must be 'staging' or 'preview' (got '${TARGET}').`);
  process.exit(1);
}

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

async function seedRows(orgId, userId, orgTag) {
  // decision_ledger (canary row)
  const { data: dec, error: decErr } = await sb.from("decision_ledger").insert({
    organization_id: orgId,
    title: `${runTag} canary ${orgTag}`,
    decision_type: "operational",
    status: "pending",
    created_by: userId,
  }).select("id").single();
  if (decErr) console.error(`decision ${orgTag}:`, decErr.message);

  // audit_log
  const { error: auditErr } = await sb.from("audit_log").insert({
    organization_id: orgId,
    actor_id: userId,
    actor_type: "user",
    action_type: "tenant_isolation_seed",
    resource_type: "test",
    payload: { run_tag: runTag, org_tag: orgTag },
  });
  if (auditErr) console.error(`audit ${orgTag}:`, auditErr.message);

  // evidence_sources — schema varies; best-effort insert
  const { error: evErr } = await sb.from("evidence_sources").insert({
    organization_id: orgId,
    source_type: "internal",
    source_name: `${runTag}-${orgTag}`,
  });
  if (evErr) console.warn(`evidence ${orgTag} (non-fatal): ${evErr.message}`);

  return { decision_id: dec?.id ?? null };
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
