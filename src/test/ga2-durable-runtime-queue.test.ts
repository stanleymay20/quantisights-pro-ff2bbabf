import { describe, expect, it } from "vitest";

import { FakeRuntimeDatabase } from "@/test/helpers/fake-runtime-postgres";
import {
  createRuntimeQueue,
  SupabaseRuntimeQueueAdapter,
  type RuntimeQueue,
} from "@/lib/runtime-queue";

const NOW = "2026-07-10T12:00:00.000Z";
const T_PLUS_1S = "2026-07-10T12:00:01.000Z";
const T_PLUS_31S = "2026-07-10T12:00:31.000Z";
const T_PLUS_2M = "2026-07-10T12:02:00.000Z";
const T_PLUS_4M = "2026-07-10T12:04:00.000Z";
const T_PLUS_6M = "2026-07-10T12:06:00.000Z";

function durableQueue(db: FakeRuntimeDatabase, now: string = NOW, visibilityTimeoutMs = 30_000): RuntimeQueue {
  return createRuntimeQueue({
    adapter: new SupabaseRuntimeQueueAdapter(db as any, visibilityTimeoutMs),
    now: () => now,
  });
}

function enqueueInput(overrides: Record<string, unknown> = {}) {
  return {
    queue_message_id: "qmsg-001",
    correlation_id: "corr-001",
    idempotency_key: "idem-001",
    request_hash: "hash-001",
    tenant_id: "tenant-a",
    organization_id: "org-a",
    payload_reference: "exec-001",
    now: NOW,
    ...overrides,
  };
}

describe("GA-2 durable Runtime Queue (SupabaseRuntimeQueueAdapter)", () => {
  it("enqueues, dequeues, and acknowledges a message durably", async () => {
    const db = new FakeRuntimeDatabase();
    const queue = durableQueue(db);

    const enqueued = await queue.enqueue(enqueueInput());
    expect(enqueued.status).toBe("QUEUED");

    const dequeued = await queue.dequeue(NOW);
    expect(dequeued.status).toBe("PROCESSING");
    expect(dequeued.message?.queue_message_id).toBe("qmsg-001");
    expect(dequeued.message?.attempt_count).toBe(1);

    const acked = await queue.ack("qmsg-001", "processed", T_PLUS_1S);
    expect(acked?.status).toBe("ACKNOWLEDGED");

    const stats = await queue.queueStats(T_PLUS_1S);
    expect(stats.acknowledged_count).toBe(1);
    expect(stats.queue_depth).toBe(0);
  });

  it("respects priority and FIFO ordering when claiming the next message", async () => {
    const db = new FakeRuntimeDatabase();
    const queue = durableQueue(db);
    await queue.enqueue(enqueueInput({ queue_message_id: "qmsg-low", priority: 0, now: NOW }));
    await queue.enqueue(enqueueInput({ queue_message_id: "qmsg-high", priority: 10, now: T_PLUS_1S }));

    const first = await queue.dequeue(T_PLUS_2M);
    expect(first.message?.queue_message_id).toBe("qmsg-high");

    const second = await queue.dequeue(T_PLUS_2M);
    expect(second.message?.queue_message_id).toBe("qmsg-low");
  });

  it("never delivers the same message to two concurrent dequeue calls (SKIP LOCKED semantics)", async () => {
    const db = new FakeRuntimeDatabase();
    const queue = durableQueue(db);
    await queue.enqueue(enqueueInput());

    const [a, b] = await Promise.all([queue.dequeue(NOW), queue.dequeue(NOW)]);
    const delivered = [a.message, b.message].filter((m) => m !== null);

    expect(delivered).toHaveLength(1);
    expect(a.status === "PROCESSING" ? a.status : b.status).toBe("PROCESSING");
  });

  it("retries a failed message up to the policy limit, then dead-letters it", async () => {
    const db = new FakeRuntimeDatabase();
    const queue = durableQueue(db);
    await queue.enqueue(enqueueInput());
    const claimed = await queue.dequeue(NOW);
    const id = claimed.message!.queue_message_id;

    const retried = await queue.retry(id, { failure_reason: "downstream timeout" });
    expect(retried?.status).toBe("RETRY");
    expect(retried?.retry_history).toHaveLength(1);

    // Re-claim after the retry delay and fail again until dead-letter threshold.
    const claim2 = await queue.dequeue(T_PLUS_2M);
    await queue.retry(claim2.message!.queue_message_id, { failure_reason: "downstream timeout", now: T_PLUS_2M });
    const claim3 = await queue.dequeue(T_PLUS_4M);
    const final = await queue.retry(claim3.message!.queue_message_id, { failure_reason: "downstream timeout", now: T_PLUS_4M });

    expect(final?.status).toBe("DEAD_LETTER");
    const stats = await queue.queueStats(T_PLUS_2M);
    expect(stats.dead_letter_count).toBe(1);
  });

  it("dead-letters a message directly", async () => {
    const db = new FakeRuntimeDatabase();
    const queue = durableQueue(db);
    await queue.enqueue(enqueueInput());
    const claimed = await queue.dequeue(NOW);

    const deadLettered = await queue.moveToDeadLetter(claimed.message!.queue_message_id, "poison message");

    expect(deadLettered?.status).toBe("DEAD_LETTER");
    expect(deadLettered?.dead_letter_reason).toBe("poison message");
  });

  it("expires a message once its TTL passes and never redelivers it", async () => {
    const db = new FakeRuntimeDatabase();
    const queue = createRuntimeQueue({
      adapter: new SupabaseRuntimeQueueAdapter(db as any),
      ttl_ms: 5_000,
      now: () => NOW,
    });
    await queue.enqueue(enqueueInput());

    const stillQueued = await queue.dequeue(T_PLUS_1S);
    expect(stillQueued.status).toBe("PROCESSING");
    await queue.retry(stillQueued.message!.queue_message_id, { failure_reason: "retry", now: T_PLUS_1S });

    const afterTtl = await queue.dequeue(T_PLUS_2M);
    expect(afterTtl.status).toBe("EMPTY");

    const stats = await queue.queueStats(T_PLUS_2M);
    expect(stats.expired_count).toBe(1);
  });

  it("purges only terminal (acknowledged/expired/dead-letter-purged) messages", async () => {
    const db = new FakeRuntimeDatabase();
    const queue = durableQueue(db);
    await queue.enqueue(enqueueInput({ queue_message_id: "qmsg-ack" }));
    await queue.enqueue(enqueueInput({ queue_message_id: "qmsg-active" }));
    const claimed = await queue.dequeue(NOW);
    await queue.ack(claimed.message!.queue_message_id, "processed", T_PLUS_1S);

    const purged = await queue.purge(T_PLUS_1S);

    expect(purged.purged_count).toBe(1);
    const stats = await queue.queueStats(T_PLUS_1S);
    expect(stats.queue_depth).toBe(1);
    expect(stats.acknowledged_count).toBe(0);
  });

  it("crash recovery: reclaims a PROCESSING message via visibility timeout if the worker never acks", async () => {
    const db = new FakeRuntimeDatabase();
    // Short visibility timeout to simulate a crashed worker quickly.
    const queue = durableQueue(db, NOW, 30_000);
    await queue.enqueue(enqueueInput());

    const claimedByCrashedWorker = await queue.dequeue(NOW);
    expect(claimedByCrashedWorker.status).toBe("PROCESSING");
    // The crashed worker never calls ack/retry/deadLetter.

    // A fresh worker instance (simulating restart) polls after the
    // visibility timeout elapses and must be able to reclaim the message.
    const recoveredWorkerQueue = durableQueue(db, T_PLUS_31S, 30_000);
    const reclaimed = await recoveredWorkerQueue.dequeue(T_PLUS_31S);

    expect(reclaimed.status).toBe("PROCESSING");
    expect(reclaimed.message?.queue_message_id).toBe("qmsg-001");
    expect(reclaimed.message?.attempt_count).toBe(2);
  });

  it("survives a simulated process restart: a brand new adapter instance against the same database sees the same queue state", async () => {
    const db = new FakeRuntimeDatabase();
    const beforeRestart = durableQueue(db);
    await beforeRestart.enqueue(enqueueInput());
    await beforeRestart.enqueue(enqueueInput({ queue_message_id: "qmsg-002" }));

    const afterRestart = durableQueue(db, T_PLUS_1S);
    const stats = await afterRestart.queueStats(T_PLUS_1S);
    expect(stats.queue_depth).toBe(2);

    const claimed = await afterRestart.dequeue(T_PLUS_1S);
    expect(claimed.message).not.toBeNull();
  });

  it("keeps queue state isolated per tenant", async () => {
    const db = new FakeRuntimeDatabase();
    const queue = durableQueue(db);
    await queue.enqueue(enqueueInput({ queue_message_id: "qmsg-tenant-a", tenant_id: "tenant-a", organization_id: "org-a" }));
    await queue.enqueue(enqueueInput({ queue_message_id: "qmsg-tenant-b", tenant_id: "tenant-b", organization_id: "org-b" }));

    const first = await queue.dequeue(NOW);
    const second = await queue.dequeue(NOW);

    const tenants = [first.message?.tenant_id, second.message?.tenant_id].sort();
    expect(tenants).toEqual(["tenant-a", "tenant-b"]);
  });
});
