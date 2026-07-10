// GA-2R Phase 2 (persistence portion) — Service-Role Adapter Validation.
//
// Exercises the ACTUAL SupabaseRuntimePersistence class from
// src/lib/runtime-persistence.ts against a real Supabase project. No
// reimplementation of its behavior — this only calls the real adapter
// through createRuntimePersistence(), exactly as the Supplier Risk runtime
// pipeline does.
import { createRuntimePersistence, SupabaseRuntimePersistence } from "@/lib/runtime-persistence";
import { createServiceClient, genId, nowIso, PhaseReport, printReport, requireEnvOrBlock, runStandalone } from "./_shared.mjs";

export async function run() {
  const report = new PhaseReport("Phase 2: Runtime Persistence (SupabaseRuntimePersistence)");
  const { env, blocked } = requireEnvOrBlock("validate-persistence");
  if (blocked) {
    report.block(`missing environment: ${env.missing.join(", ")}`);
    return printReport(report);
  }

  const client = createServiceClient(env);
  const tenantId = genId("tenant");
  const organizationId = genId("org");
  const executionId = genId("exec");
  const now = nowIso();

  const persistence = () => createRuntimePersistence({ adapter: new SupabaseRuntimePersistence({ client }), now: () => now });

  const created = await persistence().createExecution({
    execution_id: executionId,
    correlation_id: genId("corr"),
    request_hash: genId("hash"),
    idempotency_key: genId("idem"),
    tenant_id: tenantId,
    organization_id: organizationId,
    metadata: { source: "ga2r-validation" },
  });
  report.check("1. create execution", created.status === "PERSISTED", created.errors.join("; "));

  const fetched = await persistence().getExecution(tenantId, executionId);
  report.check("2. retrieve execution", fetched?.execution_id === executionId);

  const updated = await persistence().updateExecution(tenantId, executionId, { status: "PROCESSING", now });
  report.check("3. update lifecycle (CREATED -> PROCESSING)", updated.execution?.status === "PROCESSING");

  const event1 = await persistence().appendEvent({ execution_id: executionId, tenant_id: tenantId, event_type: "runtime.execution.received", payload: {}, now });
  const event2 = await persistence().appendEvent({ execution_id: executionId, tenant_id: tenantId, event_type: "runtime.execution.processing", payload: {}, now });
  report.check(
    "4. append runtime events",
    event1.status === "APPENDED" && event2.status === "APPENDED",
  );
  report.check(
    "5. deterministic sequence ordering (1, 2)",
    event1.event?.sequence_number === 1 && event2.event?.sequence_number === 2,
  );

  const audit1 = await persistence().recordAudit({ execution_id: executionId, tenant_id: tenantId, organization_id: organizationId, actor: "ga2r", action: "created", resource_type: "execution", resource_id: executionId, now });
  const audit2 = await persistence().recordAudit({ execution_id: executionId, tenant_id: tenantId, organization_id: organizationId, actor: "ga2r", action: "processed", resource_type: "execution", resource_id: executionId, now });
  report.check("6. create audit records", audit1.status === "APPENDED" && audit2.status === "APPENDED");
  report.check(
    "7. previous_audit_hash linkage (root null, second -> first)",
    audit1.record?.previous_audit_hash === null && audit2.record?.previous_audit_hash === audit1.record?.audit_hash,
  );

  const snapshotSaved = await persistence().saveQueueSnapshot({ tenant_id: tenantId, messages: [], now });
  const snapshotLoaded = await persistence().loadQueueSnapshot(tenantId);
  report.check(
    "8. save and restore queue snapshot",
    snapshotSaved.status === "SAVED" && snapshotLoaded?.snapshot_id === snapshotSaved.snapshot?.snapshot_id,
  );

  // 9-11: discard the adapter instance, construct a brand new one, verify state survives.
  report.check("9. discard adapter instance", true, "(new JS object constructed below; no shared in-process state used)");
  const restarted = createRuntimePersistence({ adapter: new SupabaseRuntimePersistence({ client: createServiceClient(env) }), now: () => nowIso() });
  report.check("10. construct new adapter instance", true);

  const recoveredExecution = await restarted.getExecution(tenantId, executionId);
  const recoveredEvents = await restarted.replayEvents(tenantId, executionId);
  const recoveredAuditChain = await restarted.verifyAuditChain(tenantId);
  report.check(
    "11. all state survives a fresh adapter instance",
    recoveredExecution?.status === "PROCESSING" && recoveredEvents.length === 2 && recoveredAuditChain.valid === true && recoveredAuditChain.length === 2,
    `execution=${recoveredExecution?.status}, events=${recoveredEvents.length}, chain_valid=${recoveredAuditChain.valid}`,
  );

  report.createdRows = {
    runtime_executions: [{ tenant_id: tenantId, execution_id: executionId }],
    runtime_events: [{ tenant_id: tenantId, execution_id: executionId }],
    runtime_audit_records: [{ tenant_id: tenantId }],
    runtime_queue_snapshots: [{ tenant_id: tenantId }],
  };

  return printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStandalone(run);
}
