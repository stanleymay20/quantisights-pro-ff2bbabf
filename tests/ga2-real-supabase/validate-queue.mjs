// GA-2R Phase 3 — Queue Concurrency Validation.
//
// Exercises the ACTUAL SupabaseRuntimeQueueAdapter against a real Supabase
// project: 20 enqueued messages, 10 concurrent "workers" (independent
// adapter + Supabase client instances) racing to dequeue, verifying no
// message is ever delivered twice.
import { createRuntimeQueue, SupabaseRuntimeQueueAdapter } from "@/lib/runtime-queue";
import { addMs, createServiceClient, genId, nowIso, PhaseReport, printReport, requireEnvOrBlock, runStandalone } from "./_shared.mjs";

const MESSAGE_COUNT = 20;
const WORKER_COUNT = 10;

function newWorkerQueue(env) {
  return createRuntimeQueue({ adapter: new SupabaseRuntimeQueueAdapter(createServiceClient(env), 30_000) });
}

export async function run() {
  const report = new PhaseReport("Phase 3: Queue Concurrency (SupabaseRuntimeQueueAdapter)");
  const { env, blocked } = requireEnvOrBlock("validate-queue");
  if (blocked) {
    report.block(`missing environment: ${env.missing.join(", ")}`);
    return printReport(report);
  }

  const tenantId = genId("tenant");
  const organizationId = genId("org");
  const now = nowIso();
  const enqueuer = newWorkerQueue(env);

  const messageIds = [];
  for (let i = 0; i < MESSAGE_COUNT; i += 1) {
    const id = genId(`qmsg-${i}`);
    messageIds.push(id);
    await enqueuer.enqueue({
      queue_message_id: id,
      correlation_id: genId("corr"),
      idempotency_key: genId("idem"),
      request_hash: genId("hash"),
      tenant_id: tenantId,
      organization_id: organizationId,
      payload_reference: `payload-${i}`,
      priority: i % 3,
      now,
    });
  }
  report.check(`enqueued ${MESSAGE_COUNT} messages`, true);

  // 10 concurrent workers, each an independent adapter + Supabase client
  // instance, repeatedly dequeuing until the queue this tenant owns is
  // drained. Track every delivery to detect double-claims.
  const deliveries = [];
  const deliveryLock = { count: 0 };
  const workers = Array.from({ length: WORKER_COUNT }, () => newWorkerQueue(env));

  async function drainWith(queue) {
    for (;;) {
      const result = await queue.dequeue(nowIso());
      if (!result.message) return; // EMPTY or FAILED: nothing left for this worker to claim.
      if (!messageIds.includes(result.message.queue_message_id)) {
        // Claimed a message this run did not enqueue (e.g. leftover state in
        // a shared staging schema) — ack it so it does not block other
        // workers, but do not count it toward this phase's assertions.
        await queue.ack(result.message.queue_message_id, "foreign message, ga2r skip", nowIso());
        continue;
      }
      deliveries.push({ id: result.message.queue_message_id, worker: deliveryLock.count });
      await queue.ack(result.message.queue_message_id, "processed", nowIso());
    }
  }

  await Promise.all(workers.map((queue) => drainWith(queue)));

  const deliveredIds = deliveries.map((d) => d.id);
  const uniqueDeliveredIds = new Set(deliveredIds);
  const duplicateCount = deliveredIds.length - uniqueDeliveredIds.size;
  report.check(
    "each message claimed at most once (zero duplicate deliveries)",
    duplicateCount === 0,
    `duplicate-delivery count = ${duplicateCount}`,
  );
  report.check("all enqueued messages were delivered", uniqueDeliveredIds.size === MESSAGE_COUNT, `delivered ${uniqueDeliveredIds.size}/${MESSAGE_COUNT}`);

  // Acknowledged messages do not reappear.
  const requeued = await enqueuer.dequeue(nowIso());
  report.check("acknowledged messages do not reappear", requeued.status === "EMPTY" || !messageIds.includes(requeued.message?.queue_message_id));

  // Priority + FIFO ordering on a fresh, isolated pair of messages.
  const lowId = genId("qmsg-low");
  const highId = genId("qmsg-high");
  await enqueuer.enqueue({ queue_message_id: lowId, correlation_id: genId("corr"), idempotency_key: genId("idem"), request_hash: genId("hash"), tenant_id: tenantId, organization_id: organizationId, payload_reference: "low", priority: 0, now });
  await enqueuer.enqueue({ queue_message_id: highId, correlation_id: genId("corr"), idempotency_key: genId("idem"), request_hash: genId("hash"), tenant_id: tenantId, organization_id: organizationId, payload_reference: "high", priority: 10, now: addMs(now, 1000) });
  const firstClaim = await enqueuer.dequeue(nowIso());
  report.check("priority ordering respected (higher priority claimed first)", firstClaim.message?.queue_message_id === highId);
  const secondClaim = await enqueuer.dequeue(nowIso());
  report.check("FIFO fallback respected", secondClaim.message?.queue_message_id === lowId);
  await enqueuer.ack(highId, "processed", nowIso());
  await enqueuer.ack(lowId, "processed", nowIso());

  // Retry attempt history + dead-letter threshold.
  const retryId = genId("qmsg-retry");
  await enqueuer.enqueue({ queue_message_id: retryId, correlation_id: genId("corr"), idempotency_key: genId("idem"), request_hash: genId("hash"), tenant_id: tenantId, organization_id: organizationId, payload_reference: "retry", now });
  let claim = await enqueuer.dequeue(nowIso());
  let retryResult = null;
  for (let attempt = 0; attempt < 4 && claim.message; attempt += 1) {
    retryResult = await enqueuer.retry(claim.message.queue_message_id, { failure_reason: `attempt-${attempt}`, now: addMs(nowIso(), (attempt + 1) * 65_000) });
    if (retryResult?.status === "DEAD_LETTER") break;
    claim = await enqueuer.dequeue(addMs(nowIso(), (attempt + 1) * 65_000));
  }
  report.check("retry updates attempt history", (retryResult?.retry_history?.length ?? 0) > 0 || retryResult?.status === "DEAD_LETTER");
  report.check("dead-letter threshold reached after repeated failures", retryResult?.status === "DEAD_LETTER");

  // TTL expiry.
  const ttlQueue = createRuntimeQueue({ adapter: new SupabaseRuntimeQueueAdapter(createServiceClient(env)), ttl_ms: 1000 });
  const ttlId = genId("qmsg-ttl");
  await ttlQueue.enqueue({ queue_message_id: ttlId, correlation_id: genId("corr"), idempotency_key: genId("idem"), request_hash: genId("hash"), tenant_id: tenantId, organization_id: organizationId, payload_reference: "ttl", now });
  const expiredDequeue = await ttlQueue.dequeue(addMs(now, 5000));
  report.check("TTL expiry works (expired message not delivered)", expiredDequeue.status === "EMPTY" || expiredDequeue.message?.queue_message_id !== ttlId);

  // Queue statistics match actual table state.
  const stats = await enqueuer.queueStats(nowIso());
  const client = createServiceClient(env);
  const { data: tableRows } = await client.from("runtime_queue_messages").select("status").eq("tenant_id", tenantId);
  const actualAcked = (tableRows ?? []).filter((r) => r.status === "ACKNOWLEDGED").length;
  report.check(
    "queue statistics match actual table state (acknowledged count)",
    stats.acknowledged_count === actualAcked,
    `stats=${stats.acknowledged_count}, table=${actualAcked}`,
  );

  report.duplicateDeliveryCount = duplicateCount;
  report.createdRows = { runtime_queue_messages: [{ tenant_id: tenantId }] };

  return printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStandalone(run);
}
