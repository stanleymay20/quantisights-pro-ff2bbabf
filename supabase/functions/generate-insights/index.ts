import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyAdaptiveConfidence, fetchCalibrationModel } from "../_shared/adaptive-confidence.ts";
import { capConfidence } from "../_shared/confidence-cap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;
    const body = await req.json();
    const { organization_id, dataset_id, dry_run } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: corsHeaders });
    }
    if (!dataset_id) {
      return new Response(JSON.stringify({ error: "dataset_id required by Active Data Contract" }), { status: 400, headers: corsHeaders });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member" }), { status: 403, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceSupabase = createClient(supabaseUrl, serviceKey);

    // Validate dataset belongs to org
    const { data: dsCheck } = await serviceSupabase
      .from("datasets")
      .select("id")
      .eq("id", dataset_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (!dsCheck) {
      return new Response(JSON.stringify({ error: "dataset_id does not belong to this organization" }), { status: 403, headers: corsHeaders });
    }

    // Dry run: validate contract only
    if (dry_run) {
      return new Response(JSON.stringify({ dry_run: true, status: "PASS", dataset_id, organization_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: sub } = await serviceSupabase
      .from("subscriptions")
      .select("tier")
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (!sub || !["growth", "enterprise"].includes(sub.tier)) {
      return new Response(
        JSON.stringify({ error: "AI Insights require a Growth or Enterprise plan." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metricsQuery = supabase
      .from("metrics")
      .select("metric_type, value, date, region, segment")
      .eq("organization_id", organization_id)
      .eq("dataset_id", dataset_id)
      .order("date", { ascending: true });

    const { data: metrics } = await metricsQuery;

    if (!metrics || metrics.length === 0) {
      return new Response(JSON.stringify({ message: "No metrics to analyze", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch calibration model once for all insights
    const calModel = await fetchCalibrationModel(supabaseUrl, serviceKey, organization_id);

    const { computeVariance } = await import("../_shared/adaptive-confidence.ts");

    const insights: {
      message: string; severity: string; category: string;
      confidence: number;
      raw_confidence: number; capped_confidence: number;
      confidence_cap_reason: string; sample_size: number;
      variance_score: number | null; data_quality_index: number;
      adaptive_calibration_applied: boolean;
      calibration_model_version: number | null;
      calibration_band_used: string | null;
      calibration_correction_applied_pp: number | null;
      calibration_low_sample_band: boolean;
      confidence_source: string;
    }[] = [];

    function buildInsight(
      msg: string, sev: string, cat: string,
      rawConf: number, sampleSize: number, variance?: number,
    ) {
      const meta = applyAdaptiveConfidence({
        rawConfidence: rawConf, sampleSize, variance, calibrationModel: calModel,
      });
      insights.push({
        message: msg, severity: sev, category: cat,
        confidence: meta.confidence,
        raw_confidence: meta.raw_confidence, capped_confidence: meta.capped_confidence,
        confidence_cap_reason: meta.confidence_cap_reason, sample_size: meta.sample_size,
        variance_score: meta.variance_score, data_quality_index: 100,
        adaptive_calibration_applied: meta.adaptive_calibration_applied,
        calibration_model_version: meta.calibration_model_version,
        calibration_band_used: meta.calibration_band_used,
        calibration_correction_applied_pp: meta.calibration_correction_applied_pp,
        calibration_low_sample_band: meta.calibration_low_sample_band,
        confidence_source: meta.confidence_source,
      });
    }

    // Revenue analysis
    const revenueMetrics = metrics.filter((m) => m.metric_type === "revenue");
    if (revenueMetrics.length >= 2) {
      const values = revenueMetrics.map(m => Number(m.value));
      const varianceScore = computeVariance(values);
      const half = Math.floor(revenueMetrics.length / 2);
      const firstHalf = values.slice(0, half).reduce((s, v) => s + v, 0);
      const secondHalf = values.slice(half).reduce((s, v) => s + v, 0);
      const change = ((secondHalf - firstHalf) / firstHalf) * 100;

      if (change < -10) {
        buildInsight(
          `Revenue dropped ${Math.abs(change).toFixed(1)}% in recent period. Review pricing strategy and market conditions.`,
          "high", "revenue", 85, revenueMetrics.length, varianceScore,
        );
      } else if (change > 20) {
        buildInsight(
          `Strong revenue growth of ${change.toFixed(1)}%. Consider scaling operations to sustain momentum.`,
          "info", "revenue", 80, revenueMetrics.length, varianceScore,
        );
      } else if (change > 0) {
        buildInsight(
          `Revenue grew ${change.toFixed(1)}%. Steady growth — optimize top-performing segments.`,
          "info", "revenue", 75, revenueMetrics.length, varianceScore,
        );
      }
    }

    // Churn analysis
    const churnMetrics = metrics.filter((m) => m.metric_type === "churn");
    if (churnMetrics.length > 0) {
      const values = churnMetrics.map(m => Number(m.value));
      const latestChurn = values[values.length - 1];
      const varianceScore = computeVariance(values);

      if (latestChurn > 5) {
        buildInsight(
          `Churn rate at ${latestChurn}% exceeds threshold. Implement retention campaigns immediately.`,
          "high", "churn", 85, churnMetrics.length, varianceScore,
        );
      } else if (latestChurn > 3) {
        buildInsight(
          `Churn rate at ${latestChurn}%. Monitor closely and assess customer satisfaction.`,
          "medium", "churn", 75, churnMetrics.length, varianceScore,
        );
      }
    }

    // Cost analysis
    const costMetrics = metrics.filter((m) => m.metric_type === "cost");
    if (costMetrics.length >= 2) {
      const values = costMetrics.map(m => Number(m.value));
      const recent = values[values.length - 1];
      const previous = values[values.length - 2];
      const costChange = ((recent - previous) / previous) * 100;
      if (costChange > 15) {
        buildInsight(
          `Cost increased ${costChange.toFixed(1)}% period-over-period. Evaluate cost-saving opportunities.`,
          "medium", "cost", 75, costMetrics.length, computeVariance(values),
        );
      }
    }

    // Regional analysis
    const regions = [...new Set(revenueMetrics.filter((m) => m.region).map((m) => m.region))];
    for (const region of regions) {
      const regionData = revenueMetrics.filter((m) => m.region === region);
      if (regionData.length >= 2) {
        const values = regionData.map(m => Number(m.value));
        const first = values[0];
        const last = values[values.length - 1];
        const regionChange = ((last - first) / first) * 100;
        if (regionChange < -15) {
          buildInsight(
            `Revenue in ${region} dropped ${Math.abs(regionChange).toFixed(1)}%. Investigate regional market conditions.`,
            "high", "regional", 80, regionData.length, computeVariance(values),
          );
        }
      }
    }

    if (insights.length === 0) {
      buildInsight(
        "All metrics within normal ranges. Continue monitoring for changes.",
        "info", "general", 90, metrics.length,
      );
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let deleteQuery = serviceSupabase
      .from("insights")
      .delete()
      .eq("organization_id", organization_id)
      .lt("created_at", yesterday);

    // If dataset-scoped, only clean up insights for this dataset
    if (dataset_id) {
      deleteQuery = deleteQuery.eq("dataset_id", dataset_id);
    }
    await deleteQuery;

    const insightRows = insights.map((i) => ({
      organization_id,
      dataset_id: dataset_id || null,
      message: i.message,
      severity: i.severity,
      category: i.category,
      confidence_score: i.confidence,
      raw_confidence: i.raw_confidence,
      capped_confidence: i.capped_confidence,
      confidence_cap_reason: i.confidence_cap_reason,
      sample_size: i.sample_size,
      variance_score: i.variance_score,
      data_quality_index: i.data_quality_index,
    }));

    const { error: insertError } = await serviceSupabase.from("insights").insert(insightRows);
    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ message: "Insights generated", count: insights.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
