// GA-2R Phase 1 — Migration Validation.
//
// Applies supabase/migrations/20260710124500_ga2_durable_runtime_infrastructure.sql
// (if not already applied) to the target database and verifies every table,
// RPC, constraint, and index it defines, via direct SQL against
// information_schema/pg_catalog. This needs a direct Postgres connection
// (SUPABASE_DB_URL) because PostgREST does not expose information_schema/
// pg_catalog for introspection — there is no way to do this validation
// through the REST client alone.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadEnv, maskUrl, PhaseReport, printReport, runStandalone } from "./_shared.mjs";

const MIGRATION_PATH = path.join(
  fileURLToPath(new URL("../../", import.meta.url)),
  "supabase/migrations/20260710124500_ga2_durable_runtime_infrastructure.sql",
);

const EXPECTED_TABLES = [
  "runtime_executions",
  "runtime_events",
  "runtime_audit_records",
  "runtime_queue_snapshots",
  "runtime_queue_messages",
  "runtime_idempotency_keys",
];

const EXPECTED_RPCS = ["claim_runtime_queue_message", "expire_runtime_queue_messages"];

export async function run() {
  const report = new PhaseReport("Phase 1: Migration Validation");
  const env = loadEnv();

  if (!env.dbUrl) {
    report.block(
      "SUPABASE_DB_URL not set — direct Postgres access is required for schema introspection " +
        "(information_schema/pg_catalog are not exposed via PostgREST).",
    );
    return printReport(report);
  }

  let pg;
  try {
    pg = await import("pg");
  } catch {
    report.block(
      "the 'pg' package is not installed in this environment and could not be installed here " +
        "(sandbox npm registry denied the install). Run `npm install --no-save pg` in a real " +
        "CI/deployment context to execute this phase.",
    );
    return printReport(report);
  }

  const { Client } = pg.default ?? pg;
  const client = new Client({ connectionString: env.dbUrl });
  console.log(`[validate-schema] Connecting to database for ${maskUrl(env.url)}...`);
  await client.connect();

  try {
    const migrationSql = await readFile(MIGRATION_PATH, "utf8");
    const alreadyApplied = await client.query(
      `SELECT to_regclass('public.runtime_executions') IS NOT NULL AS exists`,
    );
    if (!alreadyApplied.rows[0].exists) {
      console.log("[validate-schema] Applying GA-2 migration...");
      await client.query(migrationSql);
      report.check("migration applied", true);
    } else {
      report.check("migration already applied (idempotent skip)", true);
    }

    for (const table of EXPECTED_TABLES) {
      const { rows } = await client.query(`SELECT to_regclass($1) IS NOT NULL AS exists`, [`public.${table}`]);
      report.check(`table exists: ${table}`, rows[0].exists);
    }

    for (const fn of EXPECTED_RPCS) {
      const { rows } = await client.query(
        `SELECT count(*) > 0 AS exists FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = $1`,
        [fn],
      );
      report.check(`RPC exists: ${fn}`, rows[0].exists);
    }

    for (const table of EXPECTED_TABLES) {
      const { rows } = await client.query(
        `SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass($1)`,
        [`public.${table}`],
      );
      report.check(`RLS enabled: ${table}`, rows[0]?.relrowsecurity === true);
    }

    const constraintChecks = [
      { table: "runtime_executions", type: "u", columns: ["tenant_id", "execution_id"] },
      { table: "runtime_events", type: "u", columns: ["tenant_id", "execution_id", "sequence_number"] },
      { table: "runtime_audit_records", type: "u", columns: ["tenant_id", "previous_audit_hash"] },
      { table: "runtime_queue_messages", type: "p", columns: ["queue_message_id"] },
      { table: "runtime_idempotency_keys", type: "p", columns: ["idempotency_key"] },
    ];
    for (const spec of constraintChecks) {
      const { rows } = await client.query(
        `SELECT array_agg(a.attname ORDER BY a.attnum) AS cols
         FROM pg_constraint c
         JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
         WHERE c.conrelid = to_regclass($1) AND c.contype = $2
         GROUP BY c.oid`,
        [`public.${spec.table}`, spec.type],
      );
      const match = rows.some((row) => JSON.stringify((row.cols ?? []).sort()) === JSON.stringify([...spec.columns].sort()));
      report.check(
        `${spec.type === "p" ? "primary key" : "unique constraint"} on ${spec.table}(${spec.columns.join(",")})`,
        match,
      );
    }

    const partialIndexes = [
      { name: "idx_runtime_audit_root_per_tenant", table: "runtime_audit_records" },
      { name: "idx_runtime_queue_messages_claim", table: "runtime_queue_messages" },
      { name: "idx_runtime_queue_messages_visibility", table: "runtime_queue_messages" },
    ];
    for (const idx of partialIndexes) {
      const { rows } = await client.query(
        `SELECT indexdef LIKE '%WHERE%' AS is_partial FROM pg_indexes WHERE schemaname='public' AND indexname=$1`,
        [idx.name],
      );
      report.check(`partial index exists: ${idx.name}`, rows[0]?.is_partial === true);
    }

    const tenantIndexes = [
      { table: "runtime_executions", name: "idx_runtime_executions_tenant_status" },
      { table: "runtime_queue_messages", name: "idx_runtime_queue_messages_tenant" },
      { table: "runtime_idempotency_keys", name: "idx_runtime_idempotency_tenant" },
    ];
    for (const idx of tenantIndexes) {
      const { rows } = await client.query(
        `SELECT count(*) > 0 AS exists FROM pg_indexes WHERE schemaname='public' AND indexname=$1`,
        [idx.name],
      );
      report.check(`tenant index exists: ${idx.name}`, rows[0].exists);
    }
  } finally {
    await client.end();
  }

  return printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStandalone(run);
}
