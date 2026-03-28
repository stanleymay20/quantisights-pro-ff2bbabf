/**
 * Idempotency guard for edge functions.
 * Uses audit_log to track processed request IDs and prevent duplicate execution.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function checkIdempotency(
  resourceType: string,
  resourceId: string,
  organizationId: string
): Promise<{ alreadyProcessed: boolean }> {
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data } = await svc
    .from("audit_log")
    .select("id")
    .eq("resource_type", resourceType)
    .eq("resource_id", resourceId)
    .eq("organization_id", organizationId)
    .limit(1);

  return { alreadyProcessed: (data?.length ?? 0) > 0 };
}

export async function markProcessed(
  resourceType: string,
  resourceId: string,
  organizationId: string,
  actorId: string,
  actionType: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  await svc.from("audit_log").insert({
    organization_id: organizationId,
    actor_id: actorId,
    actor_type: "system",
    action_type: actionType,
    resource_type: resourceType,
    resource_id: resourceId,
    payload: payload || {},
  });
}
