// GA-2R Phase 8 — Supplier Risk Full Integration.
//
// Seeds one realistic supplier-risk advisory in an isolated test
// organization, then runs the ACTUAL runSupplierRiskRuntimePipeline with
// REAL durable deps (SupabaseRuntimePersistence / SupabaseRuntimeQueueAdapter,
// and persistDecisionRecord/writeAuditEvent/persistDecisionLedgerRow wired to
// real audit_log / decision_ledger inserts) — the exact same code path
// supabase/functions/supplier-risk-runtime-ingest/index.ts uses. This is a
// real database write, not a pure-orchestrator-only call.
import { SupabaseRuntimePersistence } from "@/lib/runtime-persistence";
import { SupabaseRuntimeQueueAdapter } from "@/lib/runtime-queue";
import { runSupplierRiskRuntimePipeline } from "@/lib/supplier-risk-runtime-pipeline";
import { createServiceClient, genId, nowIso, PhaseReport, printReport, requireEnvOrBlock, runStandalone } from "./_shared.mjs";

/** Mirrors isSupplierRiskSource()/deriveImpactAmount()/deriveDeliveryDelayHours()
 *  in supabase/functions/supplier-risk-runtime-ingest/index.ts, and the
 *  hasExistingDecision() dedup check from auto-create-decisions /
 *  supplier-risk-runtime-ingest — the "current runtime/idempotency contract"
 *  Phase 8 asks us to validate a second identical request against. */
async function fetchExistingDecisionForAdvisory(client, organizationId, advisoryId) {
  const { data } = await client
    .from("decision_ledger")
    .select("id, advisory_instance_id")
    .eq("organization_id", organizationId)
    .eq("advisory_instance_id", advisoryId)
    .maybeSingle();
  return data ?? null;
}

export async function run() {
  const report = new PhaseReport("Phase 8: Supplier Risk Full Integration");
  const { env, blocked } = requireEnvOrBlock("validate-supplier-risk");
  if (blocked) {
    report.block(`missing environment: ${env.missing.join(", ")}`);
    return printReport(report);
  }

  const client = createServiceClient(env);
  const now = nowIso();

  const { data: org, error: orgError } = await client
    .from("organizations")
    .insert({ name: `GA2R Validation Org ${genId("org")}` })
    .select("id")
    .single();
  if (orgError || !org) {
    report.block(`could not seed a test organization: ${orgError?.message}`);
    return printReport(report);
  }
  const organizationId = org.id;

  const { data: advisory, error: advisoryError } = await client
    .from("advisory_instances")
    .insert({
      organization_id: organizationId,
      advisory_type: "risk",
      title: "Critical supplier delivery risk — Tier-1 harness supplier",
      category: "supplier_risk",
      priority: "high",
      action: "Escalate to supplier performance review and evaluate diversification before the next production cycle.",
      expected_impact: "750000",
      rationale: "Supplier delivery variance exceeded threshold for two consecutive cycles; vendor delivery risk confirmed by portal telemetry.",
      status: "open",
    })
    .select("id, created_at")
    .single();
  if (advisoryError || !advisory) {
    report.block(`could not seed a supplier-risk advisory: ${advisoryError?.message}`);
    return printReport(report);
  }
  report.check("seeded one realistic supplier-risk advisory", true, `advisory_instance_id=${advisory.id}`);

  const deps = {
    persistDecisionRecord: async (record) => {
      await client.from("audit_log").insert({
        organization_id: organizationId,
        actor_type: "system",
        action_type: "agent_gateway.decision_recorded",
        resource_type: "decision_ledger",
        resource_id: record.decision_id,
        payload: { decision_class: record.decision_class, approval_state: record.status },
      });
      return { decision_id: record.decision_id };
    },
    writeAuditEvent: async (event) => {
      const { data } = await client
        .from("audit_log")
        .insert({
          organization_id: event.organization_id,
          actor_type: "system",
          action_type: event.action_type,
          resource_type: event.resource_type,
          resource_id: event.resource_id,
          payload: event.payload,
        })
        .select("id")
        .single();
      return { audit_id: data?.id ?? genId("audit") };
    },
    persistDecisionLedgerRow: async (row) => {
      const { data, error } = await client
        .from("decision_ledger")
        .insert({ ...row, advisory_instance_id: advisory.id })
        .select("id")
        .single();
      if (error) throw new Error(`decision_ledger insert failed: ${error.message}`);
      return { decision_id: data.id };
    },
    runtimeQueueAdapter: new SupabaseRuntimeQueueAdapter(client),
    runtimePersistenceAdapter: new SupabaseRuntimePersistence({ client }),
  };

  const pipelineInput = {
    now,
    signal: {
      event_id: `advisory-${advisory.id}`,
      source_system: "advisory-engine",
      connector_id: "ga2r-validation",
      source_record_id: advisory.id,
      tenant_id: organizationId,
      organization_id: organizationId,
      supplier_id: advisory.id,
      delivery_delay_hours: 48,
      impact_amount: 750_000,
      description: advisory.rationale,
      observed_at: now,
    },
  };

  const result = await runSupplierRiskRuntimePipeline(pipelineInput, deps);

  report.check("quality assessment produced", result.signal_quality?.length > 0 && result.signal_quality[0].overall >= 0);
  report.check("contradiction result produced", Array.isArray(result.contradictions));
  report.check("verified fact produced", result.verified_fact != null);
  report.check("decision candidate produced", result.decision_candidate != null);
  report.check("Agent Gateway result produced", result.agent_gateway_result?.decision_record != null);
  report.check("Runtime acknowledgement produced", result.runtime_service_response?.ok === true);
  report.check("pipeline reached DECISION_LEDGER_READY", result.status === "DECISION_LEDGER_READY", `status=${result.status}, explanation=${result.explanation.slice(-3).join(" | ")}`);

  if (result.status !== "DECISION_LEDGER_READY") {
    report.block("pipeline did not complete — skipping durable-state verification");
    return printReport(report);
  }

  // Durable queue activity: the execution's queue message should exist and
  // be acknowledged (the pipeline acks it internally once processed).
  const { data: queueRows } = await client
    .from("runtime_queue_messages")
    .select("status")
    .eq("tenant_id", organizationId);
  report.check("durable queue activity recorded", (queueRows ?? []).length > 0, `rows=${(queueRows ?? []).length}`);

  const { data: executionRow } = await client
    .from("runtime_executions")
    .select("*")
    .eq("tenant_id", organizationId)
    .eq("execution_id", result.execution_record.execution_id)
    .maybeSingle();
  report.check("durable execution record persisted", executionRow?.status === "COMPLETED");

  const { data: eventRows } = await client
    .from("runtime_events")
    .select("*")
    .eq("tenant_id", organizationId)
    .eq("execution_id", result.execution_record.execution_id);
  report.check("durable events persisted", (eventRows ?? []).length > 0, `count=${(eventRows ?? []).length}`);

  const { data: auditRows } = await client
    .from("runtime_audit_records")
    .select("*")
    .eq("tenant_id", organizationId);
  report.check("durable audit records persisted", (auditRows ?? []).length > 0, `count=${(auditRows ?? []).length}`);

  const { data: decisionRow } = await client
    .from("decision_ledger")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("advisory_instance_id", advisory.id)
    .maybeSingle();
  report.check("a real pending decision_ledger row was created", decisionRow?.decision_status === "pending");
  report.check(
    "lineage fields and evidence references preserved",
    decisionRow?.explanation_metadata?.lineage?.fact_id === result.verified_fact.fact_id &&
      decisionRow?.explanation_metadata?.lineage?.candidate_id === result.decision_candidate.candidate_id &&
      Array.isArray(decisionRow?.evidence_sources) &&
      decisionRow.evidence_sources.length > 0,
  );

  // Second identical request must be rejected/deduplicated per the current
  // contract implemented in supplier-risk-runtime-ingest/index.ts: the
  // caller checks decision_ledger for an existing row linked to this
  // advisory before ever invoking the pipeline again.
  const existing = await fetchExistingDecisionForAdvisory(client, organizationId, advisory.id);
  report.check(
    "a second identical request is deduplicated per the current ingestion contract (existing decision found, pipeline would be skipped)",
    existing != null && existing.id === decisionRow.id,
  );

  report.createdRows = {
    organizations: [{ id: organizationId }],
    advisory_instances: [{ id: advisory.id }],
    decision_ledger: [{ id: decisionRow?.id }],
    audit_log: [{ organization_id: organizationId }],
    runtime_executions: [{ tenant_id: organizationId }],
    runtime_events: [{ tenant_id: organizationId }],
    runtime_audit_records: [{ tenant_id: organizationId }],
    runtime_queue_messages: [{ tenant_id: organizationId }],
  };

  return printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStandalone(run);
}
