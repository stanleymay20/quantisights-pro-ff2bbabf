// Intervention Fatigue Compute
// Daily rollup: per-owner intervention volume, resolution latency, ack-rate, effectiveness.
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
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: rows, error } = await supabase
      .from("executive_interventions")
      .select("organization_id, owner_id, status, created_at, acknowledged_at, resolved_at, outcome_effectiveness")
      .gte("created_at", since)
      .limit(5000);
    if (error) throw error;

    const buckets = new Map<string, { org: string; owner: string | null; total: number; acked: number; resolved: number; ackMs: number[]; resMs: number[]; eff: number[] }>();
    for (const r of rows ?? []) {
      const key = `${r.organization_id}::${r.owner_id ?? "unassigned"}`;
      const b = buckets.get(key) ?? { org: r.organization_id, owner: r.owner_id ?? null, total: 0, acked: 0, resolved: 0, ackMs: [], resMs: [], eff: [] };
      b.total += 1;
      if (r.acknowledged_at) { b.acked += 1; b.ackMs.push(new Date(r.acknowledged_at).getTime() - new Date(r.created_at).getTime()); }
      if (r.resolved_at) { b.resolved += 1; b.resMs.push(new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()); }
      if (r.outcome_effectiveness != null) b.eff.push(Number(r.outcome_effectiveness));
      buckets.set(key, b);
    }

    const today = new Date().toISOString().slice(0, 10);
    const payload = Array.from(buckets.values()).map((b) => ({
      organization_id: b.org,
      owner_id: b.owner,
      window_date: today,
      total_interventions: b.total,
      ack_rate: b.total ? b.acked / b.total : 0,
      resolution_rate: b.total ? b.resolved / b.total : 0,
      avg_ack_minutes: b.ackMs.length ? Math.round(b.ackMs.reduce((s, x) => s + x, 0) / b.ackMs.length / 60000) : null,
      avg_resolution_minutes: b.resMs.length ? Math.round(b.resMs.reduce((s, x) => s + x, 0) / b.resMs.length / 60000) : null,
      avg_effectiveness: b.eff.length ? b.eff.reduce((s, x) => s + x, 0) / b.eff.length : null,
      fatigue_score: Math.min(100, b.total * 5 + (b.total - b.resolved) * 3),
    }));

    if (payload.length) {
      const { error: upErr } = await supabase
        .from("intervention_fatigue")
        .upsert(payload, { onConflict: "organization_id,owner_id,window_date" });
      if (upErr) throw upErr;
    }

    return new Response(
      JSON.stringify({ ok: true, buckets_written: payload.length, correlation_id: correlationId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message, correlation_id: correlationId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
