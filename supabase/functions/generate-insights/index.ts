import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { capConfidence, computeVariance, fetchCalibrationModel } from "../_shared/confidence-cap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { organization_id } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: corsHeaders });
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

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    const { data: metrics } = await supabase
      .from("metrics")
      .select("metric_type, value, date, region, segment")
      .eq("organization_id", organization_id)
      .order("date", { ascending: true });

    if (!metrics || metrics.length === 0) {
      return new Response(JSON.stringify({ message: "No metrics to analyze", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch calibration model for adaptive corrections
    const calModel = await fetchCalibrationModel(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      organization_id
    );

    const insights: {
      message: string; severity: string; category: string;
      raw_confidence: number; capped_confidence: number;
      confidence_cap_reason: string; sample_size: number;
      variance_score: number | null; data_quality_index: number;
    }[] = [];

    // Revenue analysis
    const revenueMetrics = metrics.filter((m) => m.metric_type === "revenue");
    if (revenueMetrics.length >= 2) {
      const values = revenueMetrics.map(m => Number(m.value));
      const varianceScore = computeVariance(values);
      const half = Math.floor(revenueMetrics.length / 2);
      const firstHalf = values.slice(0, half).reduce((s, v) => s + v, 0);
      const secondHalf = values.slice(half).reduce((s, v) => s + v, 0);
      const change = ((secondHalf - firstHalf) / firstHalf) * 100;

      let rawConf = 70;
      let msg = "";
      let sev = "info";

      if (change < -10) {
        rawConf = 85;
        msg = `Revenue dropped ${Math.abs(change).toFixed(1)}% in recent period. Review pricing strategy and market conditions.`;
        sev = "high";
      } else if (change > 20) {
        rawConf = 80;
        msg = `Strong revenue growth of ${change.toFixed(1)}%. Consider scaling operations to sustain momentum.`;
      } else if (change > 0) {
        rawConf = 75;
        msg = `Revenue grew ${change.toFixed(1)}%. Steady growth — optimize top-performing segments.`;
      }

      if (msg) {
        const cap = capConfidence(rawConf, revenueMetrics.length, varianceScore, calModel);
        insights.push({
          message: msg, severity: sev, category: "revenue",
          raw_confidence: cap.raw_confidence, capped_confidence: cap.capped_confidence,
          confidence_cap_reason: cap.confidence_cap_reason, sample_size: cap.sample_size,
          variance_score: cap.variance_score, data_quality_index: 100,
        });
      }
    }

    // Churn analysis
    const churnMetrics = metrics.filter((m) => m.metric_type === "churn");
    if (churnMetrics.length > 0) {
      const values = churnMetrics.map(m => Number(m.value));
      const latestChurn = values[values.length - 1];
      const varianceScore = computeVariance(values);
      let rawConf = 70;
      let msg = "";
      let sev = "info";

      if (latestChurn > 5) {
        rawConf = 85; sev = "high";
        msg = `Churn rate at ${latestChurn}% exceeds threshold. Implement retention campaigns immediately.`;
      } else if (latestChurn > 3) {
        rawConf = 75; sev = "medium";
        msg = `Churn rate at ${latestChurn}%. Monitor closely and assess customer satisfaction.`;
      }

      if (msg) {
        const cap = capConfidence(rawConf, churnMetrics.length, varianceScore, calModel);
        insights.push({
          message: msg, severity: sev, category: "churn",
          raw_confidence: cap.raw_confidence, capped_confidence: cap.capped_confidence,
          confidence_cap_reason: cap.confidence_cap_reason, sample_size: cap.sample_size,
          variance_score: cap.variance_score, data_quality_index: 100,
        });
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
        const cap = capConfidence(75, costMetrics.length, computeVariance(values), calModel);
        insights.push({
          message: `Cost increased ${costChange.toFixed(1)}% period-over-period. Evaluate cost-saving opportunities.`,
          severity: "medium", category: "cost",
          raw_confidence: cap.raw_confidence, capped_confidence: cap.capped_confidence,
          confidence_cap_reason: cap.confidence_cap_reason, sample_size: cap.sample_size,
          variance_score: cap.variance_score, data_quality_index: 100,
        });
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
          const cap = capConfidence(80, regionData.length, computeVariance(values), calModel);
          insights.push({
            message: `Revenue in ${region} dropped ${Math.abs(regionChange).toFixed(1)}%. Investigate regional market conditions.`,
            severity: "high", category: "regional",
            raw_confidence: cap.raw_confidence, capped_confidence: cap.capped_confidence,
            confidence_cap_reason: cap.confidence_cap_reason, sample_size: cap.sample_size,
            variance_score: cap.variance_score, data_quality_index: 100,
          });
        }
      }
    }

    if (insights.length === 0) {
      const cap = capConfidence(90, metrics.length, undefined, calModel);
      insights.push({
        message: "All metrics within normal ranges. Continue monitoring for changes.",
        severity: "info", category: "general",
        raw_confidence: cap.raw_confidence, capped_confidence: cap.capped_confidence,
        confidence_cap_reason: cap.confidence_cap_reason, sample_size: cap.sample_size,
        variance_score: null, data_quality_index: 100,
      });
    }

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await serviceSupabase
      .from("insights")
      .delete()
      .eq("organization_id", organization_id)
      .lt("created_at", yesterday);

    const insightRows = insights.map((i) => ({
      organization_id,
      message: i.message,
      severity: i.severity,
      category: i.category,
      confidence_score: i.capped_confidence,
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
