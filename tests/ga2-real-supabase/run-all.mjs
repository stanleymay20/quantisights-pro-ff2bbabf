// GA-2R — Real Supabase Runtime Validation harness entry point.
//
// Runs Phases 1-8 against a real Supabase environment (SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY required; SUPABASE_ANON_KEY and SUPABASE_DB_URL
// unlock additional checks), then Phase 10 cleanup. Never substitutes mocks
// or the fake-runtime-postgres test double — if the environment is missing,
// every phase reports BLOCKED rather than a false PASS.
//
// Usage:
//   npm run ga2:validate:staging
//   (equivalent to: node --import ./tests/ga2-real-supabase/register.mjs tests/ga2-real-supabase/run-all.mjs)
import { loadEnv, maskUrl } from "./_shared.mjs";
import * as schema from "./validate-schema.mjs";
import * as persistence from "./validate-persistence.mjs";
import * as queue from "./validate-queue.mjs";
import * as idempotency from "./validate-idempotency.mjs";
import * as auditChain from "./validate-audit-chain.mjs";
import * as rls from "./validate-rls.mjs";
import * as supplierRisk from "./validate-supplier-risk.mjs";
import * as cleanup from "./cleanup.mjs";

const PHASES = [
  ["Phase 1", schema],
  ["Phase 2/3 persistence", persistence],
  ["Phase 3 queue", queue],
  ["Phase 5 idempotency", idempotency],
  ["Phase 6 audit chain", auditChain],
  ["Phase 7 RLS", rls],
  ["Phase 8 Supplier Risk", supplierRisk],
];

async function main() {
  const env = loadEnv();
  console.log("=================================================");
  console.log("GA-2R Real Supabase Runtime Validation");
  console.log(`Target project: ${maskUrl(env.url)}`);
  console.log(`Direct SQL (SUPABASE_DB_URL): ${env.dbUrl ? "available" : "not provided"}`);
  console.log(`Anon key (SUPABASE_ANON_KEY): ${env.anonKey ? "available" : "not provided"}`);
  console.log("=================================================\n");

  if (env.blocked) {
    console.log(`BLOCKED: missing ${env.missing.join(", ")}. Not substituting mocks. Nothing else will run.`);
    process.exitCode = 2;
    return;
  }

  const results = [];
  for (const [label, module] of PHASES) {
    console.log(`\n----- ${label} -----`);
    try {
      const report = await module.run();
      results.push(report);
    } catch (error) {
      console.error(`[${label}] threw: ${error instanceof Error ? error.stack : String(error)}`);
      results.push({ name: label, status: "FAIL", checks: [], error: String(error) });
    }
  }

  console.log("\n----- Phase 10: Cleanup -----");
  const cleanupReport = await cleanup.run();
  results.push(cleanupReport);

  console.log("\n=================================================");
  console.log("GA-2R SUMMARY");
  console.log("=================================================");
  let anyFail = false;
  let anyBlocked = false;
  for (const r of results) {
    console.log(`${r.status.padEnd(8)} ${r.name}`);
    if (r.status === "FAIL") anyFail = true;
    if (r.status === "BLOCKED") anyBlocked = true;
  }

  const queuePhase = results.find((r) => r.name?.includes("Phase 3 queue"));
  if (queuePhase) {
    console.log(`\nDuplicate-delivery count (Phase 3, required = 0): ${queuePhase.duplicateDeliveryCount ?? "n/a"}`);
  }
  const auditPhase = results.find((r) => r.name?.includes("Audit Chain"));
  if (auditPhase) {
    console.log(`Fork attempt DB error code: ${auditPhase.forkErrorCode ?? "n/a"}`);
    console.log(`Second-root attempt DB error code: ${auditPhase.secondRootErrorCode ?? "n/a"}`);
  }

  const recommendation = !anyFail && !anyBlocked ? "GO" : "NO-GO";
  console.log(`\nMERGE RECOMMENDATION: ${recommendation}`);
  process.exitCode = recommendation === "GO" ? 0 : 1;
}

main();
