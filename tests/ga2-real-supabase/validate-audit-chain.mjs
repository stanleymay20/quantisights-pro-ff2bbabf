// GA-2R Phase 6 — Audit Chain Validation.
//
// Exercises the ACTUAL SupabaseRuntimePersistence.recordAudit()/
// verifyAuditChain() against a real Supabase project, then demonstrates the
// raw Postgres constraint (23505 unique_violation) that makes a fork or a
// second chain root impossible, by issuing the equivalent insert directly
// against runtime_audit_records with the real client.
import { createRuntimePersistence, SupabaseRuntimePersistence } from "@/lib/runtime-persistence";
import { createServiceClient, genId, nowIso, PhaseReport, printReport, requireEnvOrBlock, runStandalone } from "./_shared.mjs";

const CHAIN_LENGTH = 10;

export async function run() {
  const report = new PhaseReport("Phase 6: Audit Chain Validation");
  const { env, blocked } = requireEnvOrBlock("validate-audit-chain");
  if (blocked) {
    report.block(`missing environment: ${env.missing.join(", ")}`);
    return printReport(report);
  }

  const client = createServiceClient(env);
  const now = nowIso();
  const persistence = createRuntimePersistence({ adapter: new SupabaseRuntimePersistence({ client }), now: () => now });

  const tenantA = genId("tenant-a");
  const tenantB = genId("tenant-b");
  const orgA = genId("org-a");
  const orgB = genId("org-b");
  const executionId = genId("exec");

  const chainA = [];
  for (let i = 0; i < CHAIN_LENGTH; i += 1) {
    const result = await persistence.recordAudit({
      execution_id: executionId,
      tenant_id: tenantA,
      organization_id: orgA,
      actor: "ga2r",
      action: `step-${i}`,
      resource_type: "execution",
      resource_id: executionId,
      now,
    });
    chainA.push(result.record);
  }
  report.check(`created a chain of ${CHAIN_LENGTH} audit records`, chainA.every((r) => r != null));

  report.check("first record has the expected root value (previous_audit_hash = null)", chainA[0]?.previous_audit_hash === null);

  let linked = true;
  for (let i = 1; i < chainA.length; i += 1) {
    if (chainA[i].previous_audit_hash !== chainA[i - 1].audit_hash) linked = false;
  }
  report.check("each previous_audit_hash points to the prior record", linked);

  const listed = await persistence.listAuditRecords(tenantA, executionId);
  const orderedByAction = listed.map((r) => r.action);
  const expectedOrder = chainA.map((r) => r.action);
  report.check("ordering is deterministic (matches insertion order)", JSON.stringify(orderedByAction) === JSON.stringify(expectedOrder));

  const verification = await persistence.verifyAuditChain(tenantA);
  report.check("verifyAuditChain reports a valid chain", verification.valid === true && verification.length === CHAIN_LENGTH);

  // Deliberate fork attempt: two children racing to extend from the same
  // previous_audit_hash. Go through the real adapter first (behavioral
  // proof), then hit the table directly to surface the raw Postgres error
  // code independent of the adapter's error-message wrapping.
  const forkAttempt = await persistence.recordAudit({
    execution_id: executionId,
    tenant_id: tenantA,
    organization_id: orgA,
    actor: "ga2r-fork-attempt",
    action: "forked-step",
    resource_type: "execution",
    resource_id: executionId,
    now,
  });
  // A legitimate second record from the real adapter always succeeds
  // (it looks up the true last hash first) — so to actually attempt a
  // *fork*, replay the same previous_audit_hash as an already-consumed one.
  const { error: forkError } = await client.from("runtime_audit_records").insert({
    audit_id: genId("audit-fork"),
    execution_id: executionId,
    tenant_id: tenantA,
    organization_id: orgA,
    actor: "ga2r-fork-attempt-raw",
    action: "forked-step-raw",
    resource_type: "execution",
    resource_id: executionId,
    occurred_at: now,
    audit_hash: genId("audit-hash-fork"),
    previous_audit_hash: chainA[0].audit_hash, // already has a successor (chainA[1])
    metadata: {},
  });
  report.check("a deliberate fork attempt is rejected", forkError != null, forkError ? `code=${forkError.code}` : "no error raised");
  report.forkErrorCode = forkError?.code ?? null;

  const { error: secondRootError } = await client.from("runtime_audit_records").insert({
    audit_id: genId("audit-root2"),
    execution_id: executionId,
    tenant_id: tenantA,
    organization_id: orgA,
    actor: "ga2r-root-attempt",
    action: "second-root-attempt",
    resource_type: "execution",
    resource_id: executionId,
    occurred_at: now,
    audit_hash: genId("audit-hash-root2"),
    previous_audit_hash: null,
    metadata: {},
  });
  report.check("a second root attempt for the same tenant is rejected", secondRootError != null, secondRootError ? `code=${secondRootError.code}` : "no error raised");
  report.secondRootErrorCode = secondRootError?.code ?? null;

  // Tenant B maintains a fully separate chain (including its own root).
  const tenantBRoot = await persistence.recordAudit({ execution_id: executionId, tenant_id: tenantB, organization_id: orgB, actor: "ga2r", action: "root", resource_type: "execution", resource_id: executionId, now });
  report.check("tenant B can create its own root (chains are per-tenant, not global)", tenantBRoot.record?.previous_audit_hash === null);
  const tenantBChain = await persistence.verifyAuditChain(tenantB);
  const tenantAChain = await persistence.verifyAuditChain(tenantA);
  report.check(
    "tenant A and tenant B maintain separate chains",
    tenantAChain.length === CHAIN_LENGTH + 1 && tenantBChain.length === 1,
    `tenantA length=${tenantAChain.length}, tenantB length=${tenantBChain.length}`,
  );

  void forkAttempt;
  report.createdRows = { runtime_audit_records: [{ tenant_id: tenantA }, { tenant_id: tenantB }] };
  return printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStandalone(run);
}
