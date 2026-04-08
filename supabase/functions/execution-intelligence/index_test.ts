/**
 * Integration tests for execution-intelligence edge function.
 * These tests hit the REAL deployed function and verify actual DB behavior.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/execution-intelligence`;

async function callFunction(token: string, body: Record<string, unknown>): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "x-request-id": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// Helper: get authenticated session + org — skip test if no test user
async function getTestSession(): Promise<{ token: string; orgId: string; cleanup: () => Promise<void> } | null> {
  const email = Deno.env.get("TEST_USER_EMAIL") || "test-integration@quantivis.test";
  const password = Deno.env.get("TEST_USER_PASSWORD") || "test-password-123!";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: { session } } = await supabase.auth.signInWithPassword({ email, password });
  if (!session) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", session.user.id)
    .single();

  if (!profile?.organization_id) {
    await supabase.auth.signOut();
    return null;
  }

  return {
    token: session.access_token,
    orgId: profile.organization_id,
    cleanup: async () => { await supabase.auth.signOut(); },
  };
}

// ─── AUTH TESTS ───
Deno.test({ name: "rejects unauthenticated requests", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "engine_health", organization_id: crypto.randomUUID() }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertExists(body.error);
}});

Deno.test({ name: "rejects invalid org_id format", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const session = await getTestSession();
  if (!session) { console.log("⏭️  Skipping: No test user"); return; }

  const { status, data } = await callFunction(session.token, {
    action: "engine_health",
    organization_id: "not-a-uuid",
  });
  assertEquals(status, 400);
  assertExists(data.error);
  await session.cleanup();
}});

Deno.test({ name: "rejects non-member org access", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const session = await getTestSession();
  if (!session) { console.log("⏭️  Skipping: No test user"); return; }

  const { status, data } = await callFunction(session.token, {
    action: "engine_health",
    organization_id: "00000000-0000-4000-a000-000000000001",
  });
  assertEquals(status, 403);
  assertExists(data.error);
  await session.cleanup();
}});

Deno.test({ name: "rejects unknown action", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const session = await getTestSession();
  if (!session) { console.log("⏭️  Skipping: No test user"); return; }

  const { status, data } = await callFunction(session.token, {
    action: "totally_invalid_action_xyz",
    organization_id: session.orgId,
  });
  assertEquals(status, 400);
  assertExists(data.error);
  await session.cleanup();
}});

// ─── FUNCTIONAL TESTS ───
Deno.test({ name: "engine_health returns valid response", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const session = await getTestSession();
  if (!session) { console.log("⏭️  Skipping: No test user"); return; }

  const { status, data } = await callFunction(session.token, {
    action: "engine_health",
    organization_id: session.orgId,
  });
  assertEquals(status, 200);
  assertExists(data.overall_health);
  await session.cleanup();
}});

Deno.test({ name: "command_summary returns valid response", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const session = await getTestSession();
  if (!session) { console.log("⏭️  Skipping: No test user"); return; }

  const { status, data } = await callFunction(session.token, {
    action: "command_summary",
    organization_id: session.orgId,
  });
  assertEquals(status, 200);
  assertExists(data.generated_at);
  assertExists(data.correlation_id);
  await session.cleanup();
}});

Deno.test({ name: "operational_metrics returns server-side stats", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const session = await getTestSession();
  if (!session) { console.log("⏭️  Skipping: No test user"); return; }

  const { status, data } = await callFunction(session.token, {
    action: "operational_metrics",
    organization_id: session.orgId,
  });
  assertEquals(status, 200);
  assertExists(data.engine_performance);
  assertExists(data.intervention_metrics);
  assertExists(data.dedupe_effectiveness);
  await session.cleanup();
}});

// ─── OVERRIDE RBAC TEST ───
Deno.test({ name: "executive_override requires step-up auth", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const session = await getTestSession();
  if (!session) { console.log("⏭️  Skipping: No test user"); return; }

  const { status, data } = await callFunction(session.token, {
    action: "executive_override",
    organization_id: session.orgId,
    plan_id: crypto.randomUUID(),
    override_type: "force_cancel",
    reason: "Integration test — should fail step-up auth",
  });

  // Should be 403 (step-up auth not satisfied) or 400 (plan not found after auth passes)
  assertEquals([403, 400].includes(status), true, `Expected 403 or 400, got ${status}: ${JSON.stringify(data)}`);
  await session.cleanup();
}});

// ─── SCAN / MUTATION TESTS ───
Deno.test({ name: "scan_interventions returns structured result", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const session = await getTestSession();
  if (!session) { console.log("⏭️  Skipping: No test user"); return; }

  const { status, data } = await callFunction(session.token, {
    action: "scan_interventions",
    organization_id: session.orgId,
  });
  assertEquals(status, 200);
  assertEquals(typeof data.interventions_created, "number");
  assertEquals(typeof data.scanned, "number");
  assertExists(data.run_id);
  assertExists(data.correlation_id);
  await session.cleanup();
}});

Deno.test({ name: "infer_blockers respects limit cap", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const session = await getTestSession();
  if (!session) { console.log("⏭️  Skipping: No test user"); return; }

  const { status, data } = await callFunction(session.token, {
    action: "infer_blockers",
    organization_id: session.orgId,
    limit: 9999, // Should be capped to 500
  });
  assertEquals(status, 200);
  assertEquals(data.limit_applied, 500); // Verify server-side cap
  await session.cleanup();
}});
