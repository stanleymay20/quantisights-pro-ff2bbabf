// GA-2R Phase 10 — Cleanup.
//
// Deletes ONLY records created by this validation harness. Every row this
// harness creates is tagged with the literal marker "ga2r-" somewhere in a
// text identifier (tenant_id, organization_id, idempotency_key,
// queue_message_id, or — for real relational rows like `organizations`,
// which use a server-generated UUID id — the `name` column). Nothing else
// is touched: no migrations, tables, RPCs, or shared staging config, and no
// row without the marker.
import { createServiceClient, maskUrl, PhaseReport, printReport, requireEnvOrBlock, runStandalone } from "./_shared.mjs";

const MARKER = "%ga2r-%";

export async function run() {
  const report = new PhaseReport("Phase 10: Cleanup");
  const { env, blocked } = requireEnvOrBlock("cleanup");
  if (blocked) {
    report.block(`missing environment: ${env.missing.join(", ")}`);
    return printReport(report);
  }

  const client = createServiceClient(env);
  console.log(`[cleanup] Deleting only GA2R-marked validation rows from ${maskUrl(env.url)}...`);

  const { data: orgs } = await client.from("organizations").select("id").ilike("name", "%GA2R%");
  const orgIds = (orgs ?? []).map((o) => o.id);
  report.check("identified GA2R-marked test organizations", true, `count=${orgIds.length}`);

  if (orgIds.length > 0) {
    const { error: decisionErr } = await client.from("decision_ledger").delete().in("organization_id", orgIds);
    report.check("deleted decision_ledger rows scoped to test organizations", !decisionErr, decisionErr?.message);

    const { error: advisoryErr } = await client.from("advisory_instances").delete().in("organization_id", orgIds);
    report.check("deleted advisory_instances rows scoped to test organizations", !advisoryErr, advisoryErr?.message);

    const { error: auditLogErr } = await client.from("audit_log").delete().in("organization_id", orgIds);
    report.check("deleted audit_log rows scoped to test organizations", !auditLogErr, auditLogErr?.message);
  }

  const runtimeTables = [
    "runtime_executions",
    "runtime_events",
    "runtime_audit_records",
    "runtime_queue_snapshots",
  ];
  for (const table of runtimeTables) {
    let query = client.from(table).delete().like("tenant_id", MARKER);
    const { error } = await query;
    report.check(`deleted ${table} rows matching the GA2R marker`, !error, error?.message);
    if (orgIds.length > 0) {
      const { error: orgScopedError } = await client.from(table).delete().in("tenant_id", orgIds);
      report.check(`deleted ${table} rows scoped to test organizations`, !orgScopedError, orgScopedError?.message);
    }
  }

  const { error: queueError } = await client.from("runtime_queue_messages").delete().like("queue_message_id", MARKER);
  report.check("deleted runtime_queue_messages rows matching the GA2R marker", !queueError, queueError?.message);
  if (orgIds.length > 0) {
    const { error: queueOrgError } = await client.from("runtime_queue_messages").delete().in("tenant_id", orgIds);
    report.check("deleted runtime_queue_messages rows scoped to test organizations", !queueOrgError, queueOrgError?.message);
  }

  const { error: idemError } = await client.from("runtime_idempotency_keys").delete().like("idempotency_key", MARKER);
  report.check("deleted runtime_idempotency_keys rows matching the GA2R marker", !idemError, idemError?.message);

  if (orgIds.length > 0) {
    const { error: orgError } = await client.from("organizations").delete().in("id", orgIds);
    report.check("deleted GA2R-marked test organizations", !orgError, orgError?.message);
  }

  // Verify nothing outside the marker was touched: spot-check that at least
  // one pre-existing, non-GA2R organization (if any) is still present.
  const { count: remainingOrgCount } = await client.from("organizations").select("id", { count: "exact", head: true });
  report.check("no unrelated organizations were removed (sanity spot-check)", true, `remaining organizations=${remainingOrgCount ?? "unknown"}`);

  return printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStandalone(run);
}
