// Intervention Priority Engine
// Recomputes priority + escalation tier for open interventions and flags SLA breaches.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const correlationId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const orgId: string | null = body.organization_id ?? null;

    let q = supabase
      .from("executive_interventions")
      .select("id, organization_id, sla_target_at, status")
      .in("status", ["new", "acknowledged", "in_progress", "escalated"])
      .limit(500);
    if (orgId) q = q.eq("organization_id", orgId);

    const { data: rows, error } = await q;
    if (error) throw error;

    let rescored = 0;
    let breached = 0;
    const now = Date.now();

    for (const row of rows ?? []) {
      // Trigger recompute by no-op update (auto_score trigger fires on UPDATE)
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (row.sla_target_at && new Date(row.sla_target_at).getTime() < now && row.status !== "escalated") {
        updates.status = "escalated";
        updates.escalation_tier = "executive";
        breached += 1;
        await supabase.from("intervention_escalations").insert({
          intervention_id: row.id,
          organization_id: row.organization_id,
          escalated_to_tier: "executive",
          reason: "SLA breach (auto)",
          auto_triggered: true,
        });
      }
      await supabase.from("executive_interventions").update(updates).eq("id", row.id);
      rescored += 1;
    }

    return new Response(
      JSON.stringify({ ok: true, rescored, breached, correlation_id: correlationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message, correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
