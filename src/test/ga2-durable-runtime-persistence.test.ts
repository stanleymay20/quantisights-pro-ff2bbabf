import { describe, expect, it } from "vitest";

import { FakeRuntimeDatabase } from "@/test/helpers/fake-runtime-postgres";
import {
  createRuntimePersistence,
  SupabaseRuntimePersistence,
  type RuntimePersistence,
} from "@/lib/runtime-persistence";

const NOW = "2026-07-10T12:00:00.000Z";
const LATER = "2026-07-10T12:05:00.000Z";
const AFTER_RETENTION = "2026-07-11T12:05:01.000Z";

function durablePersistence(db: FakeRuntimeDatabase, now: string = NOW): RuntimePersistence {
  return createRuntimePersistence({
    adapter: new SupabaseRuntimePersistence({ client: db as any }),
    now: () => now,
  });
}

function executionInput(overrides: Partial<Parameters<RuntimePersistence["createExecution"]>[0]> = {}) {
  return {
    execution_id: "exec-001",
    correlation_id: "corr-001",
    request_hash: "hash-001",
    idempotency_key: "idem-001",
    tenant_id: "tenant-a",
    organization_id: "org-a",
    metadata: { channel: "runtime" },
    ...overrides,
  };
}

describe("GA-2 durable Runtime Persistence (SupabaseRuntimePersistence)", () => {
  it("persists an execution durably and reads it back with the same shape as the in-memory adapter", async () => {
    const db = new FakeRuntimeDatabase();
    const persistence = durablePersistence(db);

    const created = await persistence.createExecution(executionInput());
    expect(created.status).toBe("PERSISTED");
    expect(created.execution).toMatchObject({
      execution_id: "exec-001",
      tenant_id: "tenant-a",
      organization_id: "org-a",
      status: "CREATED",
      metadata: { channel: "runtime" },
    });

    const fetched = await persistence.getExecution("tenant-a", "exec-001");
    expect(fetched).toEqual(created.execution);
  });

  it("rejects a duplicate execution_id for the same tenant", async () => {
    const db = new FakeRuntimeDatabase();
    const persistence = durablePersistence(db);
    await persistence.createExecution(executionInput());

    const duplicate = await persistence.createExecution(executionInput());

    expect(duplicate.status).toBe("REJECTED");
  });

  it("allows the same execution_id to exist independently for different tenants (tenant isolation)", async () => {
    const db = new FakeRuntimeDatabase();
    const persistence = durablePersistence(db);

    const tenantA = await persistence.createExecution(executionInput({ tenant_id: "tenant-a", organization_id: "org-a" }));
    const tenantB = await persistence.createExecution(executionInput({ tenant_id: "tenant-b", organization_id: "org-b" }));

    expect(tenantA.status).toBe("PERSISTED");
    expect(tenantB.status).toBe("PERSISTED");
    expect(await persistence.getExecution("tenant-a", "exec-001")).toMatchObject({ organization_id: "org-a" });
    expect(await persistence.getExecution("tenant-b", "exec-001")).toMatchObject({ organization_id: "org-b" });
  });

  it("listExecutions never returns another tenant's rows", async () => {
    const db = new FakeRuntimeDatabase();
    const persistence = durablePersistence(db);
    await persistence.createExecution(executionInput({ tenant_id: "tenant-a", organization_id: "org-a" }));
    await persistence.createExecution(executionInput({ tenant_id: "tenant-b", organization_id: "org-b", execution_id: "exec-002" }));

    const listA = await persistence.listExecutions({ tenant_id: "tenant-a" });

    expect(listA).toHaveLength(1);
    expect(listA[0].tenant_id).toBe("tenant-a");
  });

  it("appends runtime events in strict append-only sequence and rejects a replayed sequence number", async () => {
    const db = new FakeRuntimeDatabase();
    const persistence = durablePersistence(db);
    await persistence.createExecution(executionInput());

    const first = await persistence.appendEvent({ execution_id: "exec-001", tenant_id: "tenant-a", event_type: "runtime.execution.received", payload: {} });
    const second = await persistence.appendEvent({ execution_id: "exec-001", tenant_id: "tenant-a", event_type: "runtime.execution.queued", payload: {} });

    expect(first.event?.sequence_number).toBe(1);
    expect(second.event?.sequence_number).toBe(2);

    const events = await persistence.replayEvents("tenant-a", "exec-001");
    expect(events.map((e) => e.sequence_number)).toEqual([1, 2]);
    expect(events.map((e) => e.event_type)).toEqual(["runtime.execution.received", "runtime.execution.queued"]);

    // Directly forcing a duplicate sequence number at the adapter level (bypassing
    // the app-level sequencing in createRuntimePersistence) must be rejected by
    // the database's own append-only unique constraint.
    const adapter = new SupabaseRuntimePersistence({ client: db as any });
    await expect(
      adapter.appendRuntimeEvent({
        event_id: "forged-event",
        execution_id: "exec-001",
        correlation_id: "corr-001",
        tenant_id: "tenant-a",
        organization_id: "org-a",
        event_type: "forged",
        sequence_number: 1,
        timestamp: NOW,
        payload_hash: "hash",
        payload: {},
        runtime_version: "ag-3e.1",
      }),
    ).rejects.toThrow(/append-only violation/);
  });

  it("maintains a deterministic, hash-chained, append-only audit log and rejects a forked chain", async () => {
    const db = new FakeRuntimeDatabase();
    const persistence = durablePersistence(db);
    await persistence.createExecution(executionInput());

    const first = await persistence.recordAudit(auditInput());
    const second = await persistence.recordAudit(auditInput({ action: "runtime.execution.completed" }));

    expect(first.record?.previous_audit_hash).toBeNull();
    expect(second.record?.previous_audit_hash).toBe(first.record?.audit_hash);

    const chain = await persistence.verifyAuditChain("tenant-a");
    expect(chain).toEqual({ valid: true, length: 2, broken_at: null });

    // Two records racing to extend the chain from the same previous hash must
    // not both succeed — the DB unique constraint on (tenant_id, previous_audit_hash)
    // enforces a single linear chain even under a naive two-writer race.
    const adapter = new SupabaseRuntimePersistence({ client: db as any });
    await expect(
      adapter.createAuditRecord({
        audit_id: "forged-audit",
        execution_id: "exec-001",
        tenant_id: "tenant-a",
        organization_id: "org-a",
        actor: "attacker",
        action: "forged",
        resource_type: "decision",
        resource_id: "exec-001",
        timestamp: LATER,
        audit_hash: "forged-hash",
        previous_audit_hash: first.record?.audit_hash ?? null,
        metadata: {},
      }),
    ).rejects.toThrow(/audit chain violation/);
  });

  it("saves and loads the latest queue snapshot per tenant", async () => {
    const db = new FakeRuntimeDatabase();
    const persistence = durablePersistence(db);

    await persistence.saveQueueSnapshot({ tenant_id: "tenant-a", messages: [], now: NOW });
    await persistence.saveQueueSnapshot({ tenant_id: "tenant-a", messages: [], now: LATER });

    const latest = await persistence.loadQueueSnapshot("tenant-a");
    expect(latest?.captured_at).toBe(LATER);
  });

  it("purges only expired terminal executions past retention, preserving active ones", async () => {
    const db = new FakeRuntimeDatabase();
    const persistence = durablePersistence(db, AFTER_RETENTION);
    await persistence.createExecution(executionInput({ execution_id: "exec-active" }));
    const completed = await persistence.createExecution(executionInput({ execution_id: "exec-done" }));
    await persistence.updateExecution("tenant-a", "exec-done", { status: "COMPLETED", now: NOW });
    void completed;

    const result = await persistence.purgeExpiredExecutions(AFTER_RETENTION);

    expect(result.deleted_count).toBe(1);
    expect(await persistence.getExecution("tenant-a", "exec-done")).toBeNull();
    expect(await persistence.getExecution("tenant-a", "exec-active")).not.toBeNull();
  });

  it("survives a simulated process restart: a brand new adapter/persistence instance against the same database sees prior state", async () => {
    const db = new FakeRuntimeDatabase();
    const beforeRestart = durablePersistence(db);
    await beforeRestart.createExecution(executionInput());
    await beforeRestart.appendEvent({ execution_id: "exec-001", tenant_id: "tenant-a", event_type: "runtime.execution.received", payload: {} });
    await beforeRestart.recordAudit(auditInput());

    // Simulate a process restart: throw away the persistence instance and
    // build a brand new one (new adapter object) against the same "database".
    const afterRestart = durablePersistence(db, LATER);

    const execution = await afterRestart.getExecution("tenant-a", "exec-001");
    const events = await afterRestart.replayEvents("tenant-a", "exec-001");
    const chain = await afterRestart.verifyAuditChain("tenant-a");

    expect(execution).not.toBeNull();
    expect(events).toHaveLength(1);
    expect(chain.valid).toBe(true);
    expect(chain.length).toBe(1);

    // And the restarted instance can keep extending the same execution/chain.
    const resumed = await afterRestart.appendEvent({ execution_id: "exec-001", tenant_id: "tenant-a", event_type: "runtime.execution.processing", payload: {} });
    expect(resumed.event?.sequence_number).toBe(2);
  });
});

function auditInput(overrides: Partial<Parameters<RuntimePersistence["recordAudit"]>[0]> = {}) {
  return {
    execution_id: "exec-001",
    tenant_id: "tenant-a",
    organization_id: "org-a",
    actor: "runtime",
    action: "runtime.execution.processed",
    resource_type: "decision",
    resource_id: "exec-001",
    ...overrides,
  };
}
