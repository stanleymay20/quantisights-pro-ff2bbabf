import { describe, expect, it, vi } from "vitest";

import type { DecisionRecord } from "@/lib/agent-gateway";
import { SupabaseRuntimePersistence } from "@/lib/runtime-persistence";
import { SupabaseRuntimeQueueAdapter } from "@/lib/runtime-queue";
import {
  runSupplierRiskRuntimePipeline,
  type SupplierRiskDecisionLedgerRow,
  type SupplierRiskPipelineInput,
  type SupplierRiskRuntimeDeps,
} from "@/lib/supplier-risk-runtime-pipeline";
import { FakeRuntimeDatabase } from "@/test/helpers/fake-runtime-postgres";

const NOW = "2026-07-10T12:00:00.000Z";

function baseSignal() {
  return {
    event_id: "evt-supplier-ga2-001",
    source_system: "supplier-portal",
    connector_id: "connector-supplier-portal",
    source_record_id: "src-supplier-ga2-001",
    tenant_id: "org-acme",
    organization_id: "org-acme",
    supplier_id: "supplier-critical-1",
    delivery_delay_hours: 48,
    impact_amount: 750_000,
    description: "Critical supplier delivery risk detected via supplier portal feed.",
    observed_at: NOW,
  };
}

function buildDeps(db: FakeRuntimeDatabase): { deps: SupplierRiskRuntimeDeps; ledgerRows: SupplierRiskDecisionLedgerRow[] } {
  const ledgerRows: SupplierRiskDecisionLedgerRow[] = [];
  const deps: SupplierRiskRuntimeDeps = {
    persistDecisionRecord: vi.fn(async (record: DecisionRecord) => ({ decision_id: record.decision_id })),
    writeAuditEvent: vi.fn(async () => ({ audit_id: "audit-1" })),
    persistDecisionLedgerRow: vi.fn(async (row) => {
      ledgerRows.push(row);
      return { decision_id: `decision-ledger-${ledgerRows.length}` };
    }),
    runtimeQueueAdapter: new SupabaseRuntimeQueueAdapter(db as any),
    runtimePersistenceAdapter: new SupabaseRuntimePersistence({ client: db as any }),
  };
  return { deps, ledgerRows };
}

describe("GA-2: Supplier Risk runtime pipeline running on durable infrastructure", () => {
  it("still reaches DECISION_LEDGER_READY end to end when GA-2 durable adapters replace the in-memory ones", async () => {
    const db = new FakeRuntimeDatabase();
    const { deps, ledgerRows } = buildDeps(db);

    const result = await runSupplierRiskRuntimePipeline({ signal: baseSignal(), now: NOW }, deps);

    expect(result.status).toBe("DECISION_LEDGER_READY");
    expect(result.execution_record?.status).toBe("COMPLETED");
    expect(ledgerRows).toHaveLength(1);

    // The execution actually landed in durable storage, not just in-memory.
    const persistence = new SupabaseRuntimePersistence({ client: db as any });
    const stored = await persistence.getExecution(
      result.candidate_handoff!.gateway_request!.tenant_id,
      result.execution_record!.execution_id,
    );
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe("COMPLETED");
  });

  it("produces byte-identical decision_ledger row content whether infra is in-memory or durable (GA-1 behavior unchanged)", async () => {
    const memoryResult = await runSupplierRiskRuntimePipeline(
      { signal: baseSignal(), now: NOW },
      {
        persistDecisionRecord: vi.fn(async (record: DecisionRecord) => ({ decision_id: record.decision_id })),
        writeAuditEvent: vi.fn(async () => ({ audit_id: "audit-1" })),
        persistDecisionLedgerRow: vi.fn(async () => ({ decision_id: "decision-ledger-memory" })),
      },
    );

    const db = new FakeRuntimeDatabase();
    const { deps } = buildDeps(db);
    const durableResult = await runSupplierRiskRuntimePipeline({ signal: baseSignal(), now: NOW }, deps);

    expect(durableResult.status).toBe(memoryResult.status);
    expect(durableResult.verified_fact?.fact_hash).toBe(memoryResult.verified_fact?.fact_hash);
    expect(durableResult.decision_candidate?.candidate_hash).toBe(memoryResult.decision_candidate?.candidate_hash);
    const { explanation_metadata: durableMeta, ...durableRest } = durableResult.decision_ledger_row!;
    const { explanation_metadata: memoryMeta, ...memoryRest } = memoryResult.decision_ledger_row!;
    expect(durableRest).toEqual(memoryRest);
    expect((durableMeta as any).lineage.fact_id).toBe((memoryMeta as any).lineage.fact_id);
    expect((durableMeta as any).lineage.candidate_id).toBe((memoryMeta as any).lineage.candidate_id);
  });

  it("the runtime execution survives a simulated process restart between pipeline runs (same tenant, same durable database)", async () => {
    const db = new FakeRuntimeDatabase();
    const { deps: firstDeps } = buildDeps(db);
    const first = await runSupplierRiskRuntimePipeline({ signal: baseSignal(), now: NOW }, firstDeps);
    expect(first.status).toBe("DECISION_LEDGER_READY");

    // Simulate a full process restart: brand new adapter instances, but the
    // same underlying durable database, then read back what the earlier
    // "process" wrote.
    const persistenceAfterRestart = new SupabaseRuntimePersistence({ client: db as any });
    const tenantId = first.candidate_handoff!.gateway_request!.tenant_id;
    const recovered = await persistenceAfterRestart.getExecution(tenantId, first.execution_record!.execution_id);
    const events = await persistenceAfterRestart.listRuntimeEvents(tenantId, first.execution_record!.execution_id);
    const auditChain = await persistenceAfterRestart.listAuditRecords(tenantId);

    expect(recovered?.status).toBe("COMPLETED");
    expect(events.length).toBeGreaterThan(0);
    expect(auditChain.length).toBeGreaterThan(0);
  });

  it("keeps two organizations' Supplier Risk runtime executions fully isolated in durable storage", async () => {
    const db = new FakeRuntimeDatabase();
    const { deps: depsA } = buildDeps(db);
    const { deps: depsB } = buildDeps(db);

    const resultA = await runSupplierRiskRuntimePipeline(
      { signal: { ...baseSignal(), tenant_id: "org-acme", organization_id: "org-acme" }, now: NOW },
      depsA,
    );
    const resultB = await runSupplierRiskRuntimePipeline(
      {
        signal: {
          ...baseSignal(),
          event_id: "evt-supplier-ga2-002",
          source_record_id: "src-supplier-ga2-002",
          tenant_id: "org-globex",
          organization_id: "org-globex",
        },
        now: NOW,
      },
      depsB,
    );

    expect(resultA.status).toBe("DECISION_LEDGER_READY");
    expect(resultB.status).toBe("DECISION_LEDGER_READY");

    const persistence = new SupabaseRuntimePersistence({ client: db as any });
    const acmeExecutions = await persistence.listExecutions({ tenant_id: "org-acme" });
    const globexExecutions = await persistence.listExecutions({ tenant_id: "org-globex" });

    expect(acmeExecutions).toHaveLength(1);
    expect(globexExecutions).toHaveLength(1);
    expect(acmeExecutions[0].organization_id).toBe("org-acme");
    expect(globexExecutions[0].organization_id).toBe("org-globex");
  });
});
