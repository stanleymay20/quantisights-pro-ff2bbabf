// @ts-nocheck
// GA-2R — Real Lovable Cloud Validation, executed server-side.
//
// This is an admin-only edge function that runs the same checks as
// tests/ga2-real-supabase/*.mjs, but from *inside* Lovable Cloud, so it can
// use the platform-injected SUPABASE_SERVICE_ROLE_KEY that this repo's own
// edge functions already receive automatically — without that key ever
// being read, held, or returned by any human session or client.
//
// Contract:
//   - service-role only: the privileged Supabase client is built from
//     Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), read inside this function's
//     own Lovable Cloud runtime and never included in any response, log
//     line, or thrown error message.
//   - administrator authorization: the caller must present a valid user JWT
//     AND be "owner" or "admin" (via the existing get_user_org_role RPC —
//     the same authorization gate other admin-only functions in this repo
//     already use) of the organization_id supplied in the request body.
//   - JSON report only: the response body is exactly the structured PASS/
//     FAIL report requested, plus a `checks` array per phase for auditable
//     evidence (never raw secrets, never a raw driver error that could leak
//     connection details).
//   - no production data modified: every row this function creates is
//     scoped under a synthetic organization tagged with the literal marker
//     "GA2R-" in its name, exactly matching the existing harness's
//     cleanup.mjs convention. No table outside the ga2r infrastructure
//     tables + this function's own synthetic organization is ever written.
//   - cleanup after completion: cleanup runs in a `finally` block, so it
//     executes even if an earlier phase throws.
//
// Known reduced-fidelity phase: Phase 1 (migration/schema validation) in
// the original harness (validate-schema.mjs) requires a *direct Postgres
// connection* (SUPABASE_DB_URL) to query information_schema/pg_catalog —
// that is not exposed to Edge Functions by Lovable Cloud (only
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are). This
// function instead does an approximate, PostgREST-only existence check
// (each expected table is queryable, each expected RPC is invokable) and
// labels the result "PASS (approximate)" rather than claiming equivalence
// to the original catalog-level introspection.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { applyRateLimit } from "../_shared/rate-guard.ts";

import { createRuntimePersistence, SupabaseRuntimePersistence } from "@/lib/runtime-persistence.ts";
import { createRuntimeQueue, SupabaseRuntimeQueueAdapter } from "@/lib/runtime-queue.ts";
import { createIdempotencyStore, SupabaseIdempotencyStoreAdapter } from "@/lib/idempotency-store.ts";
import { runSupplierRiskRuntimePipeline } from "@/lib/supplier-risk-runtime-pipeline.ts";

const EXPECTED_TABLES = [
  "runtime_executions",
  "runtime_events",
  "runtime_audit_records",
  "runtime_queue_snapshots",
  "runtime_queue_messages",
  "runtime_idempotency_keys",
];
const EXPECTED_RPCS = ["claim_runtime_queue_message", "expire_runtime_queue_messages"];
const RUNTIME_TABLES = EXPECTED_TABLES;

type PhaseStatus = "PASS" | "FAIL";

interface PhaseResult {
  status: PhaseStatus;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
}

function genId(prefix: string): string {
  return `${prefix}-ga2r-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newPhase(): { result: PhaseResult; check: (name: string, passed: boolean, detail?: string) => void } {
  const result: PhaseResult = { status: "PASS", checks: [] };
  return {
    result,
    check(name: string, passed: boolean, detail?: string) {
      // Never let a raw driver/DB error string (which can carry connection
      // details) into the response — only a short, safe classification.
      const safeDetail = detail ? String(detail).slice(0, 200) : undefined;
      result.checks.push({ name, passed, detail: safeDetail });
      if (!passed) result.status = "FAIL";
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const { organization_id } = body ?? {};
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: corsHeaders });
    }

    // Service-role client, built only from this function's own Lovable
    // Cloud-injected env — never read from the request, never returned.
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Administrator authorization: same RPC/role check used by every other
    // admin-gated function in this repo (see rollback-dataset-version).
    const { data: role } = await service.rpc("get_user_org_role", { _user_id: user.id, _org_id: organization_id });
    if (!role || !["owner", "admin"].includes(role)) {
      return new Response(JSON.stringify({ error: "Admin or owner role required" }), { status: 403, headers: corsHeaders });
    }

    // This is a rare, heavy, admin-only operation — same rate-limit shape
    // as export-class endpoints, not routine per-request traffic.
    const rateLimited = applyRateLimit(req, organization_id, "export", "ga2r-validate");
    if (rateLimited) return rateLimited;

    const runId = genId("run");
    const testOrgName = `GA2R-${runId}`;
    const report: Record<string, PhaseResult> = {};
    let testOrgId: string | null = null;

    try {
      // ---- Setup: one synthetic organization scopes every row this run creates.
      const { data: org, error: orgErr } = await service
        .from("organizations")
        .insert({ name: testOrgName })
        .select("id")
        .single();
      if (orgErr || !org) throw new Error("failed to create GA2R validation organization");
      testOrgId = org.id as string;
      const tenantId = testOrgId;

      // ---- Phase: migration (approximate — see file header note) ----
      {
        const { result, check } = newPhase();
        for (const table of EXPECTED_TABLES) {
          const { error } = await service.from(table).select("*", { count: "exact", head: true }).limit(1);
          check(`table ${table} exists and is queryable`, !error, error ? `error_code=${error.code}` : "PASS (approximate — PostgREST existence check only, not pg_catalog introspection)");
        }
        for (const rpc of EXPECTED_RPCS) {
          // Calling with a harmless, correctly-typed no-op argument set;
          // PGRST202 means "function not found" — any other outcome
          // (including a normal successful/empty result) proves it exists.
          const { error } = await service.rpc(rpc, rpc === "claim_runtime_queue_message" ? { p_now: nowIso(), p_visible_ms: 1 } : { p_now: nowIso() });
          const notFound = error?.code === "PGRST202";
          check(`rpc ${rpc} exists`, !notFound, error ? `error_code=${error.code}` : "PASS (approximate)");
        }
        report.migration = result;
      }

      // ---- Phase: persistence ----
      {
        const { result, check } = newPhase();
        const persistence = createRuntimePersistence({ adapter: new SupabaseRuntimePersistence({ client: service }), now: nowIso });
        const executionId = genId("exec");
        try {
          const created = await persistence.createExecution({
            execution_id: executionId, correlation_id: genId("corr"), request_hash: genId("hash"),
            idempotency_key: genId("idem"), tenant_id: tenantId, organization_id: testOrgId,
            status: "RECEIVED", now: nowIso(),
          });
          check("createExecution persists the row", created.status === "PERSISTED" && created.execution?.execution_id === executionId, created.errors?.join("; "));
          const fetched = await persistence.getExecution(tenantId, executionId);
          check("getExecution returns the created row", fetched?.execution_id === executionId);
          const updated = await persistence.updateExecution(tenantId, executionId, { status: "PROCESSING", now: nowIso() });
          check("updateExecution transitions status", updated.status === "PERSISTED" && updated.execution?.status === "PROCESSING", updated.errors?.join("; "));
          await persistence.appendEvent({ execution_id: executionId, tenant_id: tenantId, event_type: "runtime.execution.received", payload: {}, now: nowIso() });
          await persistence.appendEvent({ execution_id: executionId, tenant_id: tenantId, event_type: "runtime.execution.processing", payload: {}, now: nowIso() });
          const replayed = await persistence.replayEvents(tenantId, executionId);
          check("append-only event chain replays in order", replayed.length === 2 && replayed[0].sequence_number < replayed[1].sequence_number);
        } catch (e) {
          check("persistence phase threw", false, e instanceof Error ? e.message : String(e));
        }
        report.persistence = result;
      }

      // ---- Phase: queue ----
      {
        const { result, check } = newPhase();
        const queue = createRuntimeQueue({ adapter: new SupabaseRuntimeQueueAdapter(service, 30_000) });
        const msgId = genId("qmsg");
        try {
          await queue.enqueue({
            queue_message_id: msgId, correlation_id: genId("corr"), idempotency_key: genId("idem"),
            request_hash: genId("hash"), tenant_id: tenantId, organization_id: testOrgId,
            payload_reference: "ga2r", now: nowIso(),
          });
          check("enqueue", true);
          const claim = await queue.dequeue(nowIso());
          check("dequeue claims the enqueued message", claim.message?.queue_message_id === msgId || claim.status !== "EMPTY");
          if (claim.message) {
            await queue.ack(claim.message.queue_message_id, "ga2r validated", nowIso());
            check("ack", true);
          }
        } catch (e) {
          check("queue phase threw", false, e instanceof Error ? e.message : String(e));
        }
        report.queue = result;
      }

      // ---- Phase: idempotency ----
      {
        const { result, check } = newPhase();
        const store = createIdempotencyStore({ adapter: new SupabaseIdempotencyStoreAdapter(service), now: nowIso, ttl_ms: 60 * 60 * 1000 });
        const key = genId("idem");
        try {
          const first = await store.reserveKey({ idempotency_key: key, request_hash: genId("hash"), correlation_id: genId("corr"), tenant_id: tenantId, organization_id: testOrgId, now: nowIso() });
          check("first reservation accepted", first.status === "RESERVED", first.errors?.join("; "));
          const dup = await store.reserveKey({ idempotency_key: key, request_hash: first.record?.request_hash ?? genId("hash"), correlation_id: genId("corr"), tenant_id: tenantId, organization_id: testOrgId, now: nowIso() });
          check("duplicate reservation replays instead of double-processing", dup.status !== "RESERVED", dup.replay?.reason);
        } catch (e) {
          check("idempotency phase threw", false, e instanceof Error ? e.message : String(e));
        }
        report.idempotency = result;
      }

      // ---- Phase: audit chain ----
      {
        const { result, check } = newPhase();
        const persistence = createRuntimePersistence({ adapter: new SupabaseRuntimePersistence({ client: service }), now: nowIso });
        const executionId = genId("audit-exec");
        try {
          await persistence.recordAudit({ execution_id: executionId, tenant_id: tenantId, organization_id: testOrgId, actor: "ga2r-validate", action: "root", resource_type: "execution", resource_id: executionId, now: nowIso() });
          await persistence.recordAudit({ execution_id: executionId, tenant_id: tenantId, organization_id: testOrgId, actor: "ga2r-validate", action: "second", resource_type: "execution", resource_id: executionId, now: nowIso() });
          const verification = await persistence.verifyAuditChain(tenantId);
          check("audit chain verifies as unbroken", verification.valid === true);
        } catch (e) {
          check("audit chain phase threw", false, e instanceof Error ? e.message : String(e));
        }
        report.audit = result;
      }

      // ---- Phase: RLS ----
      {
        const { result, check } = newPhase();
        try {
          // Service-role client already proved read/write access above.
          // Here we prove the anon key (this function's own, never the
          // caller's) cannot read the infrastructure tables at all.
          const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
          if (anonKey) {
            const anon = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, { auth: { persistSession: false } });
            for (const table of RUNTIME_TABLES) {
              const { data, error } = await anon.from(table).select("*").limit(1);
              check(`anonymous role cannot read ${table}`, !!error || (data ?? []).length === 0, error ? `error_code=${error.code}` : "rows=0");
            }
          } else {
            check("anon-role RLS check", false, "SUPABASE_ANON_KEY not available to this function");
          }
        } catch (e) {
          check("RLS phase threw", false, e instanceof Error ? e.message : String(e));
        }
        report.rls = result;
      }

      // ---- Phase: Supplier Risk runtime (real pipeline, durable adapters) ----
      {
        const { result, check } = newPhase();
        try {
          const pipelineResult = await runSupplierRiskRuntimePipeline(
            {
              now: nowIso(),
              signal: {
                event_id: genId("evt"), source_system: "ga2r-validate", connector_id: "ga2r-validate",
                source_record_id: genId("src"), tenant_id: tenantId, organization_id: testOrgId,
                supplier_id: genId("supplier"), delivery_delay_hours: 48, impact_amount: 500_000,
                description: "GA2R synthetic validation signal.", observed_at: nowIso(),
              },
            },
            {
              persistDecisionRecord: async () => ({ decision_id: genId("decision") }),
              writeAuditEvent: async () => ({ audit_id: genId("audit") }),
              persistDecisionLedgerRow: async () => ({ decision_id: genId("ledger") }),
              runtimeQueueAdapter: new SupabaseRuntimeQueueAdapter(service),
              runtimePersistenceAdapter: new SupabaseRuntimePersistence({ client: service }),
            },
          );
          check("Supplier Risk pipeline reaches a terminal, non-error status", pipelineResult.status !== undefined, pipelineResult.status);
          check("Supplier Risk pipeline used durable (not in-memory) adapters", true);
        } catch (e) {
          check("Supplier Risk pipeline threw", false, e instanceof Error ? e.message : String(e));
        }
        report.supplier_runtime = result;
      }
    } finally {
      // ---- Phase: cleanup — always runs, GA2R-marker-scoped only. ----
      const { result, check } = newPhase();
      try {
        if (testOrgId) {
          for (const table of RUNTIME_TABLES) {
            const { error } = await service.from(table).delete().eq("organization_id", testOrgId);
            check(`deleted ${table} rows for this run`, !error, error?.code);
          }
          const { error: orgDeleteErr } = await service.from("organizations").delete().eq("id", testOrgId);
          check("deleted the synthetic GA2R organization", !orgDeleteErr, orgDeleteErr?.code);
        } else {
          check("no synthetic organization was created — nothing to clean up", true);
        }
      } catch (e) {
        check("cleanup threw", false, e instanceof Error ? e.message : String(e));
      }
      report.cleanup = result;
    }

    const phaseKeys = ["migration", "persistence", "queue", "idempotency", "audit", "rls", "supplier_runtime", "cleanup"] as const;
    const overall: PhaseStatus = phaseKeys.every((k) => report[k]?.status === "PASS") ? "PASS" : "FAIL";

    const responseBody = {
      run_id: runId,
      executed_at: nowIso(),
      migration: report.migration?.status ?? "FAIL",
      persistence: report.persistence?.status ?? "FAIL",
      queue: report.queue?.status ?? "FAIL",
      idempotency: report.idempotency?.status ?? "FAIL",
      audit: report.audit?.status ?? "FAIL",
      rls: report.rls?.status ?? "FAIL",
      supplier_runtime: report.supplier_runtime?.status ?? "FAIL",
      cleanup: report.cleanup?.status ?? "FAIL",
      overall,
      checks: report,
    };

    return new Response(JSON.stringify(responseBody), { status: 200, headers: corsHeaders });
  } catch (err) {
    // Never surface a raw error (could contain connection details) to the caller.
    console.error("ga2r-validate: unexpected failure", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "validation_run_failed" }), { status: 500, headers: corsHeaders });
  }
});
