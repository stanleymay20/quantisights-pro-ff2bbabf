import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[WEBHOOK-INGEST] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // Authenticate via x-api-key header mapped to a data_source
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "x-api-key header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up data source by credentials_key
    const { data: source, error: srcErr } = await supabase
      .from("data_sources")
      .select("id, organization_id, name, config")
      .eq("credentials_key", apiKey)
      .eq("source_type", "webhook")
      .eq("status", "active")
      .single();

    if (srcErr || !source) {
      logStep("Invalid API key", { apiKey: apiKey.slice(0, 8) + "..." });
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Source authenticated", { sourceId: source.id, org: source.organization_id });

    // Check subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("tier")
      .eq("organization_id", source.organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (!sub) {
      return new Response(JSON.stringify({ error: "Active subscription required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create sync job
    const { data: job } = await supabase
      .from("data_sync_jobs")
      .insert({
        data_source_id: source.id,
        organization_id: source.organization_id,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const body = await req.json();
    const records = Array.isArray(body) ? body : body.records || body.data || [body];

    logStep("Processing records", { count: records.length });

    // Map records to metrics
    const fieldMap = (source.config as any)?.field_mapping || {};
    const defaultMetricType = (source.config as any)?.default_metric_type || "revenue";

    const metrics = records
      .map((r: any) => {
        const date = r[fieldMap.date || "date"];
        const value = parseFloat(r[fieldMap.value || "value"]);
        if (!date || isNaN(value)) return null;
        return {
          organization_id: source.organization_id,
          metric_type: r[fieldMap.metric_type || "metric_type"] || defaultMetricType,
          date,
          value,
          region: r[fieldMap.region || "region"] || null,
          segment: r[fieldMap.segment || "segment"] || null,
        };
      })
      .filter(Boolean);

    let inserted = 0;
    for (let i = 0; i < metrics.length; i += 500) {
      const batch = metrics.slice(i, i + 500);
      const { error } = await supabase.from("metrics").insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    // Complete sync job
    await supabase
      .from("data_sync_jobs")
      .update({
        status: "completed",
        records_synced: inserted,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job!.id);

    // Update last_synced_at
    await supabase
      .from("data_sources")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", source.id);

    logStep("Sync complete", { inserted, jobId: job!.id });

    return new Response(
      JSON.stringify({ success: true, records_synced: inserted, job_id: job!.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
