// tests/tenant-isolation/teardown.mjs
// Deletes seeded rows, users, and the two orgs created by seed.mjs.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const must = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1); }
  return v;
};
const TARGET = must("LOAD_TARGET");
if (TARGET === "production") { console.error("Refusing teardown in production."); process.exit(1); }
const URL = must("LOAD_SUPABASE_URL");
const KEY = must("SUPABASE_SERVICE_ROLE_KEY");

const __dirname = dirname(fileURLToPath(import.meta.url));
const statePath = `${__dirname}/.state.json`;
let state;
try { state = JSON.parse(readFileSync(statePath, "utf8")); }
catch { console.error("No .state.json — nothing to tear down."); process.exit(0); }

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

for (const org of [state.orgs.a.id, state.orgs.b.id]) {
  for (const table of ["evidence_sources", "audit_log", "decision_ledger", "organization_members"]) {
    const { error } = await sb.from(table).delete().eq("organization_id", org);
    if (error) console.warn(`delete ${table} @${org}: ${error.message}`);
  }
  const { error: oErr } = await sb.from("organizations").delete().eq("id", org);
  if (oErr) console.warn(`delete org ${org}: ${oErr.message}`);
}

for (const u of [state.users.a, state.users.b]) {
  if (!u.user_id) continue;
  const { error } = await sb.auth.admin.deleteUser(u.user_id);
  if (error) console.warn(`delete user ${u.email}: ${error.message}`);
}

try { unlinkSync(statePath); } catch { /* ignore */ }
console.log(`Teardown complete for run ${state.run_tag}.`);
