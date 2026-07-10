import { describe, expect, it } from "vitest";

import {
  AGENT_GATEWAY_SCHEMA_VERSION,
  AGENT_GATEWAY_VERSION,
} from "@/lib/agent-gateway";
import {
  createIdempotencyStore,
  SupabaseIdempotencyStoreAdapter,
} from "@/lib/idempotency-store";
import type { IdempotencyStoreSaveInput } from "@/lib/idempotency-store-types";
import { RUNTIME_GATEWAY_VERSION } from "@/lib/runtime-types";
import { FakeRuntimeDatabase } from "@/test/helpers/fake-runtime-postgres";

const NOW = "2026-07-10T12:00:00.000Z";
const LATER = "2026-07-10T12:05:00.000Z";
const AFTER_EXPIRY = "2026-07-10T13:01:00.000Z";

function durableStore(db: FakeRuntimeDatabase, now: string = NOW) {
  return createIdempotencyStore({
    adapter: new SupabaseIdempotencyStoreAdapter(db as any),
    ttl_ms: 60 * 60 * 1000,
    now: () => now,
  });
}

function reservationInput(
  overrides: Partial<Parameters<ReturnType<typeof createIdempotencyStore>["reserveKey"]>[0]> = {},
  now = NOW,
): Parameters<ReturnType<typeof createIdempotencyStore>["reserveKey"]>[0] {
  return {
    idempotency_key: "idem-001",
    request_hash: "hash-001",
    correlation_id: "corr-001",
    tenant_id: "tenant-a",
    organization_id: "org-a",
    gateway_version: AGENT_GATEWAY_VERSION,
    schema_version: AGENT_GATEWAY_SCHEMA_VERSION,
    runtime_version: RUNTIME_GATEWAY_VERSION,
    now,
    ...overrides,
  };
}

describe("GA-2 durable Idempotency Store (SupabaseIdempotencyStoreAdapter)", () => {
  it("reserves a key durably and looks it up by key", async () => {
    const db = new FakeRuntimeDatabase();
    const store = durableStore(db);

    const result = await store.reserveKey(reservationInput());

    expect(result.status).toBe("RESERVED");
    expect(await store.lookupKey("idem-001")).toEqual(result.record);
  });

  it("rejects a duplicate reservation with the same key (duplicate detection)", async () => {
    const db = new FakeRuntimeDatabase();
    const store = durableStore(db);
    await store.reserveKey(reservationInput());

    const duplicate = await store.reserveKey(reservationInput());

    expect(duplicate.status).toBe("REJECTED");
    expect(duplicate.replay).toMatchObject({ replayed: true, reason: "DUPLICATE_IDEMPOTENCY_KEY" });
  });

  it("detects a replayed request by hash even under a different idempotency key", async () => {
    const db = new FakeRuntimeDatabase();
    const store = durableStore(db);
    await store.reserveKey(reservationInput());

    const replay = await store.detectReplay(reservationInput({ idempotency_key: "idem-002", correlation_id: "corr-002" }));

    expect(replay).toMatchObject({ replayed: true, reason: "DUPLICATE_REQUEST_HASH" });
  });

  it("enforces cross-tenant isolation for the same idempotency key", async () => {
    const db = new FakeRuntimeDatabase();
    const store = durableStore(db);
    await store.reserveKey(reservationInput());

    const replay = await store.detectReplay(reservationInput({ tenant_id: "tenant-b", organization_id: "org-b", request_hash: "hash-tenant-b" }));

    expect(replay).toMatchObject({ replayed: true, reason: "CROSS_TENANT_KEY_REUSE" });
  });

  it("expires reservations deterministically and rejects reuse of an expired reservation", async () => {
    const db = new FakeRuntimeDatabase();
    const store = durableStore(db);
    await store.reserveKey(reservationInput());

    const expired = await store.expireKey("idem-001", AFTER_EXPIRY);
    const reuse = await store.reserveKey(reservationInput({ correlation_id: "corr-reuse" }, AFTER_EXPIRY));

    expect(expired?.status).toBe("EXPIRED");
    expect(reuse.status).toBe("REJECTED");
    expect(reuse.replay).toMatchObject({ replayed: true, reason: "EXPIRED_RESERVATION_REUSE" });
  });

  it("purges expired records without deleting active reservations", async () => {
    const db = new FakeRuntimeDatabase();
    const store = durableStore(db);
    await store.reserveKey(reservationInput());
    await store.reserveKey(reservationInput({ idempotency_key: "idem-active", request_hash: "hash-active", correlation_id: "corr-active" }, LATER));
    await store.expireKey("idem-001", AFTER_EXPIRY);

    const result = await store.purgeExpired(AFTER_EXPIRY);

    expect(result.deleted_count).toBe(1);
    expect(await store.lookupKey("idem-001")).toBeNull();
    expect(await store.lookupKey("idem-active")).toMatchObject({ status: "RESERVED" });
  });

  it("completes a reservation without mutating its immutable fields", async () => {
    const db = new FakeRuntimeDatabase();
    const store = durableStore(db);
    const reserved = await store.reserveKey(reservationInput());

    const completed = await store.completeKey("idem-001", { status: "COMPLETED", completed_at: NOW });

    expect(completed).toMatchObject({
      idempotency_key: reserved.record?.idempotency_key,
      request_hash: reserved.record?.request_hash,
      status: "COMPLETED",
      created_at: reserved.record?.created_at,
    });
  });

  it("rejects a raw concurrent double-reservation race at the storage layer (unique key backstop)", async () => {
    const db = new FakeRuntimeDatabase();
    const adapter = new SupabaseIdempotencyStoreAdapter(db as any);
    const record: IdempotencyStoreSaveInput = {
      idempotency_key: "idem-race",
      request_hash: "hash-race",
      correlation_id: "corr-race",
      tenant_id: "tenant-a",
      organization_id: "org-a",
      created_at: NOW,
      completed_at: null,
      expires_at: AFTER_EXPIRY,
      status: "RESERVED" as const,
      gateway_version: AGENT_GATEWAY_VERSION,
      schema_version: AGENT_GATEWAY_SCHEMA_VERSION,
      runtime_version: RUNTIME_GATEWAY_VERSION,
    };

    await adapter.save(record);
    // Two concurrent callers both passed the app-level detectReplay() check
    // (e.g. racing before either committed) and both try to physically save.
    await expect(adapter.save(record)).rejects.toThrow(/already reserved/);
  });

  it("survives a simulated process restart: a brand new store instance against the same database still enforces replay protection", async () => {
    const db = new FakeRuntimeDatabase();
    const beforeRestart = durableStore(db);
    await beforeRestart.reserveKey(reservationInput());

    const afterRestart = durableStore(db, AFTER_EXPIRY);
    const lookedUp = await afterRestart.lookupKey("idem-001");
    expect(lookedUp).not.toBeNull();

    // Because the reservation's TTL has elapsed by the time the process
    // restarted, a reuse attempt must still be recognized as an expired
    // reservation rather than silently succeeding.
    const reuse = await afterRestart.reserveKey(reservationInput({ correlation_id: "corr-after-restart" }, AFTER_EXPIRY));
    expect(reuse.status).toBe("REJECTED");
    expect(reuse.replay.reason).toBe("EXPIRED_RESERVATION_REUSE");
  });
});
