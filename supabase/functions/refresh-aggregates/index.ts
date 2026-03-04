import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Refresh Aggregates Edge Function
 * 
 * Computes pre-aggregated rollups from the clean metrics layer
 * into the metric_aggregates table for fast dashboard serving.
 * 
 * Supports: monthly, quarterly, yearly aggregation periods.
 * Designed for 100M+ metric scale — dashboards read aggregates, not raw metrics.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, dataset_id, pipeline_run_id, period_types } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    if (pipeline_run_id) {
      await supabase.from("pipeline_runs").update({ stage: "aggregating", status: "running" }).eq("id", pipeline_run_id);
    }

    const periods = period_types || ["monthly", "quarterly", "yearly"];

    // Fetch all metrics for scope (org + optional dataset)
    let query = supabase
      .from("metrics")
      .select("metric_type, value, date, region, segment, dataset_id")
      .eq("organization_id", organization_id)
      .order("date", { ascending: true });

    if (dataset_id) {
      query = query.eq("dataset_id", dataset_id);
    }

    const { data: metrics, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!metrics || metrics.length === 0) {
      return new Response(JSON.stringify({ success: true, aggregated: 0, message: "No metrics to aggregate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build aggregation buckets
    interface AggBucket {
      sum: number;
      count: number;
      min: number;
      max: number;
    }

    const buckets = new Map<string, AggBucket>();

    function getPeriodStart(dateStr: string, periodType: string): string {
      const d = new Date(dateStr);
      const y = d.getFullYear();
      const m = d.getMonth(); // 0-indexed
      switch (periodType) {
        case "monthly":
          return `${y}-${String(m + 1).padStart(2, "0")}-01`;
        case "quarterly": {
          const q = Math.floor(m / 3);
          return `${y}-${String(q * 3 + 1).padStart(2, "0")}-01`;
        }
        case "yearly":
          return `${y}-01-01`;
        default:
          return `${y}-${String(m + 1).padStart(2, "0")}-01`;
      }
    }

    for (const m of metrics) {
      for (const period of periods) {
        const ps = getPeriodStart(m.date, period);
        const key = `${m.dataset_id || "null"}|${m.metric_type}|${period}|${ps}|${m.region || ""}|${m.segment || ""}`;
        const val = Number(m.value);
        if (isNaN(val)) continue;

        const existing = buckets.get(key);
        if (existing) {
          existing.sum += val;
          existing.count += 1;
          existing.min = Math.min(existing.min, val);
          existing.max = Math.max(existing.max, val);
        } else {
          buckets.set(key, { sum: val, count: 1, min: val, max: val });
        }
      }
    }

    // Convert to upsert rows
    const rows: Record<string, unknown>[] = [];
    for (const [key, agg] of buckets) {
      const [dsId, metricType, periodType, periodStart, region, segment] = key.split("|");
      rows.push({
        organization_id,
        dataset_id: dsId === "null" ? null : dsId,
        metric_type: metricType,
        period_type: periodType,
        period_start: periodStart,
        region: region || "",
        segment: segment || "",
        agg_sum: agg.sum,
        agg_count: agg.count,
        agg_min: agg.min,
        agg_max: agg.max,
        agg_avg: agg.count > 0 ? agg.sum / agg.count : 0,
        computed_at: new Date().toISOString(),
      });
    }

    // Batch upsert aggregates
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase.from("metric_aggregates").upsert(batch, {
        onConflict: "organization_id,dataset_id,metric_type,period_type,period_start,region,segment",
      });
      if (error) throw error;
      upserted += batch.length;
    }

    if (pipeline_run_id) {
      await supabase.from("pipeline_runs").update({
        stage: "complete",
        status: "completed",
        aggregated_count: upserted,
        completed_at: new Date().toISOString(),
      }).eq("id", pipeline_run_id);
    }

    return new Response(JSON.stringify({
      success: true,
      aggregated: upserted,
      periods,
      metric_count: metrics.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
