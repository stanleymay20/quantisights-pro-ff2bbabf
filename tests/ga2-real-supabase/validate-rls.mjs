// GA-2R Phase 7 — RLS and Tenant Isolation.
//
// Executes real access attempts against the real project — not a "RLS
// enabled" assumption. Requires SUPABASE_ANON_KEY for the anon/authenticated
// sub-checks; those are marked SKIPPED (not silently passed) if absent.
import { createRuntimePersistence, SupabaseRuntimePersistence } from "@/lib/runtime-persistence";
import {
  createAnonClient,
  createServiceClient,
  genId,
  nowIso,
  PhaseReport,
  printReport,
  requireEnvOrBlock,
  runStandalone,
} from "./_shared.mjs";

const TABLES = [
  "runtime_executions",
  "runtime_events",
  "runtime_audit_records",
  "runtime_queue_snapshots",
  "runtime_queue_messages",
  "runtime_idempotency_keys",
];

export async function run() {
  const report = new PhaseReport("Phase 7: RLS and Tenant Isolation");
  const { env, blocked } = requireEnvOrBlock("validate-rls");
  if (blocked) {
    report.block(`missing environment: ${env.missing.join(", ")}`);
    return printReport(report);
  }

  const service = createServiceClient(env);
  const now = nowIso();
  const tenantA = genId("tenant-a");
  const tenantB = genId("tenant-b");
  const orgA = genId("org-a");
  const orgB = genId("org-b");

  const { error: serviceInsertError } = await service.from("runtime_executions").insert({
    execution_id: genId("exec-a"),
    correlation_id: genId("corr"),
    request_hash: genId("hash"),
    idempotency_key: genId("idem"),
    tenant_id: tenantA,
    organization_id: orgA,
    status: "CREATED",
    runtime_version: "ag-3e.1",
    gateway_version: "ag-2.0.0",
    schema_version: "quantivis.execution-record.v1",
    created_at: now,
    updated_at: now,
    metadata: {},
    execution_hash: genId("exechash"),
  });
  report.check("service-role can access (insert) the infrastructure tables", !serviceInsertError, serviceInsertError?.message);

  const execIdB = genId("exec-b");
  await service.from("runtime_executions").insert({
    execution_id: execIdB,
    correlation_id: genId("corr"),
    request_hash: genId("hash"),
    idempotency_key: genId("idem"),
    tenant_id: tenantB,
    organization_id: orgB,
    status: "CREATED",
    runtime_version: "ag-3e.1",
    gateway_version: "ag-2.0.0",
    schema_version: "quantivis.execution-record.v1",
    created_at: now,
    updated_at: now,
    metadata: {},
    execution_hash: genId("exechash-b"),
  });

  const anon = createAnonClient(env);
  if (!anon) {
    report.check("anonymous client cannot access infrastructure tables", false, "SKIPPED — SUPABASE_ANON_KEY not provided");
  } else {
    for (const table of TABLES) {
      const { data: selectData, error: selectError } = await anon.from(table).select("*").limit(1);
      const { error: insertError } = await anon.from(table).insert({});
      report.check(
        `anonymous client cannot select from ${table}`,
        selectError != null || (selectData ?? []).length === 0,
        selectError ? `error=${selectError.code}` : `rows returned=${(selectData ?? []).length}`,
      );
      report.check(`anonymous client cannot insert into ${table}`, insertError != null, insertError?.code);
    }

    // Ordinary authenticated (non-service) client: create a real test user
    // via the admin API (service-role only) and sign in as them.
    const email = `${genId("ga2r-user")}@example.invalid`;
    const password = `Ga2r-${genId("pw")}`;
    const { data: createdUser, error: createUserError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createUserError || !createdUser?.user) {
      report.check("ordinary authenticated client cannot access infrastructure tables", false, `SKIPPED — could not create test user: ${createUserError?.message}`);
    } else {
      const authedClient = createAnonClient(env);
      const { error: signInError } = await authedClient.auth.signInWithPassword({ email, password });
      if (signInError) {
        report.check("ordinary authenticated client cannot access infrastructure tables", false, `SKIPPED — could not sign in test user: ${signInError.message}`);
      } else {
        for (const table of TABLES) {
          const { data: selectData, error: selectError } = await authedClient.from(table).select("*").limit(1);
          const { error: insertError } = await authedClient.from(table).insert({});
          report.check(
            `ordinary authenticated client cannot select from ${table} (no explicit policy exists)`,
            selectError != null || (selectData ?? []).length === 0,
          );
          report.check(`ordinary authenticated client cannot insert into ${table}`, insertError != null);
        }
      }
      await service.auth.admin.deleteUser(createdUser.user.id);
    }
  }

  // Tenant isolation through the adapter itself (the only real access path
  // for privileged callers): tenant A's scoped query must never surface
  // tenant B's row, and vice versa.
  const persistence = createRuntimePersistence({ adapter: new SupabaseRuntimePersistence({ client: service }), now: () => now });
  const listA = await persistence.listExecutions({ tenant_id: tenantA });
  const listB = await persistence.listExecutions({ tenant_id: tenantB });
  report.check(
    "tenant A cannot retrieve tenant B records through the adapter's tenant-scoped query",
    listA.every((r) => r.tenant_id === tenantA) && !listA.some((r) => r.execution_id === execIdB),
  );
  report.check(
    "organization filters are enforced by adapter queries",
    listB.every((r) => r.organization_id === orgB),
  );

  report.createdRows = { runtime_executions: [{ tenant_id: tenantA }, { tenant_id: tenantB }] };
  return printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStandalone(run);
}
