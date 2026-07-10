// GA-2R Phase 5 — Idempotency and Replay Validation.
//
// Exercises the ACTUAL SupabaseIdempotencyStoreAdapter against a real
// Supabase project.
import { AGENT_GATEWAY_SCHEMA_VERSION, AGENT_GATEWAY_VERSION } from "@/lib/agent-gateway";
import { createIdempotencyStore, SupabaseIdempotencyStoreAdapter } from "@/lib/idempotency-store";
import { RUNTIME_GATEWAY_VERSION } from "@/lib/runtime-types";
import { addMs, createServiceClient, genId, nowIso, PhaseReport, printReport, requireEnvOrBlock, runStandalone } from "./_shared.mjs";

function newStore(env, now) {
  return createIdempotencyStore({ adapter: new SupabaseIdempotencyStoreAdapter(createServiceClient(env)), now: () => now, ttl_ms: 60 * 60 * 1000 });
}

function baseInput(overrides, now) {
  return {
    idempotency_key: genId("idem"),
    request_hash: genId("hash"),
    correlation_id: genId("corr"),
    tenant_id: genId("tenant"),
    organization_id: genId("org"),
    gateway_version: AGENT_GATEWAY_VERSION,
    schema_version: AGENT_GATEWAY_SCHEMA_VERSION,
    runtime_version: RUNTIME_GATEWAY_VERSION,
    now,
    ...overrides,
  };
}

export async function run() {
  const report = new PhaseReport("Phase 5: Idempotency and Replay (SupabaseIdempotencyStoreAdapter)");
  const { env, blocked } = requireEnvOrBlock("validate-idempotency");
  if (blocked) {
    report.block(`missing environment: ${env.missing.join(", ")}`);
    return printReport(report);
  }

  const now = nowIso();
  const tenantId = genId("tenant");
  const organizationId = genId("org");
  const key = genId("idem");
  const hash = genId("hash");
  const input = baseInput({ idempotency_key: key, request_hash: hash, tenant_id: tenantId, organization_id: organizationId }, now);
  const createdKeys = [key];

  const reserved = await newStore(env, now).reserveKey(input);
  report.check("reserve new idempotency key", reserved.status === "RESERVED");

  const duplicateKey = await newStore(env, now).reserveKey(input);
  report.check("reject duplicate key", duplicateKey.status === "REJECTED" && duplicateKey.replay.reason === "DUPLICATE_IDEMPOTENCY_KEY");

  const otherKey = genId("idem-2");
  createdKeys.push(otherKey);
  const duplicateHash = await newStore(env, now).reserveKey(baseInput({ idempotency_key: otherKey, request_hash: hash, tenant_id: tenantId, organization_id: organizationId }, now));
  report.check("reject duplicate request hash under a different key", duplicateHash.status === "REJECTED" && duplicateHash.replay.reason === "DUPLICATE_REQUEST_HASH");

  const conflictingHash = await newStore(env, now).reserveKey(baseInput({ idempotency_key: key, request_hash: genId("hash-conflict"), tenant_id: tenantId, organization_id: organizationId }, now));
  report.check("reject conflicting hash for the same key", conflictingHash.status === "REJECTED" && conflictingHash.replay.reason === "CONFLICTING_REQUEST_HASH");

  const crossTenant = await newStore(env, now).detectReplay(baseInput({ idempotency_key: key, request_hash: genId("hash-tenant-b"), tenant_id: genId("tenant-b"), organization_id: organizationId }, now));
  report.check("enforce tenant isolation", crossTenant.replayed && crossTenant.reason === "CROSS_TENANT_KEY_REUSE");

  const crossOrg = await newStore(env, now).detectReplay(baseInput({ idempotency_key: key, request_hash: genId("hash-org-b"), tenant_id: tenantId, organization_id: genId("org-b") }, now));
  report.check("enforce organization isolation", crossOrg.replayed && crossOrg.reason === "CROSS_TENANT_KEY_REUSE");

  const completed = await newStore(env, now).completeKey(key, { status: "COMPLETED", completed_at: now });
  report.check("complete reservation", completed?.status === "COMPLETED");

  const afterRestart = await newStore(env, addMs(now, 1000)).lookupKey(key);
  report.check("completed state preserved after adapter restart", afterRestart?.status === "COMPLETED");

  const expiredNow = addMs(now, 60 * 60 * 1000 + 60_000);
  const expireKey2 = genId("idem-3");
  createdKeys.push(expireKey2);
  await newStore(env, now).reserveKey(baseInput({ idempotency_key: expireKey2, request_hash: genId("hash-3") }, now));
  await newStore(env, expiredNow).expireKey(expireKey2, expiredNow);
  const reuseAttempt = await newStore(env, expiredNow).reserveKey(baseInput({ idempotency_key: expireKey2, request_hash: genId("hash-3b"), correlation_id: genId("corr-reuse") }, expiredNow));
  report.check(
    "expiration + reuse follows the implemented contract (expired reservation reuse is rejected, not silently allowed)",
    reuseAttempt.status === "REJECTED" && reuseAttempt.replay.reason === "EXPIRED_RESERVATION_REUSE",
  );

  const raceKey = genId("idem-race");
  createdKeys.push(raceKey);
  const raceHash = genId("hash-race");
  const raceInput = baseInput({ idempotency_key: raceKey, request_hash: raceHash }, now);
  const [raceA, raceB, raceC] = await Promise.all([
    newStore(env, now).reserveKey(raceInput),
    newStore(env, now).reserveKey(raceInput),
    newStore(env, now).reserveKey(raceInput),
  ]);
  const winners = [raceA, raceB, raceC].filter((r) => r.status === "RESERVED");
  report.check(
    "concurrent reservation race: only one winner",
    winners.length === 1,
    `winners=${winners.length}`,
  );

  report.createdRows = { runtime_idempotency_keys: createdKeys.map((k) => ({ idempotency_key: k })) };
  return printReport(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStandalone(run);
}
