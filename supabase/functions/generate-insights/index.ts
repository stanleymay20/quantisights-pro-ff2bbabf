import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Verify membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member" }), { status: 403, headers: corsHeaders });
    }

    // Enforce plan: AI insights require Growth or Enterprise
    const serviceSupabaseForTier = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: sub } = await serviceSupabaseForTier
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

    // Fetch metrics for analysis
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

    const insights: { message: string; severity: string; category: string }[] = [];

    // Revenue analysis
    const revenueMetrics = metrics.filter((m) => m.metric_type === "revenue");
    if (revenueMetrics.length >= 2) {
      const half = Math.floor(revenueMetrics.length / 2);
      const firstHalf = revenueMetrics.slice(0, half).reduce((s, m) => s + Number(m.value), 0);
      const secondHalf = revenueMetrics.slice(half).reduce((s, m) => s + Number(m.value), 0);
      const change = ((secondHalf - firstHalf) / firstHalf) * 100;

      if (change < -10) {
        insights.push({
          message: `Revenue dropped ${Math.abs(change).toFixed(1)}% in recent period. Review pricing strategy and market conditions.`,
          severity: "high",
          category: "revenue",
        });
      } else if (change > 20) {
        insights.push({
          message: `Strong revenue growth of ${change.toFixed(1)}%. Consider scaling operations to sustain momentum.`,
          severity: "info",
          category: "revenue",
        });
      } else if (change > 0) {
        insights.push({
          message: `Revenue grew ${change.toFixed(1)}%. Steady growth — optimize top-performing segments.`,
          severity: "info",
          category: "revenue",
        });
      }
    }

    // Churn analysis
    const churnMetrics = metrics.filter((m) => m.metric_type === "churn");
    if (churnMetrics.length > 0) {
      const latestChurn = Number(churnMetrics[churnMetrics.length - 1].value);
      if (latestChurn > 5) {
        insights.push({
          message: `Churn rate at ${latestChurn}% exceeds threshold. Implement retention campaigns immediately.`,
          severity: "high",
          category: "churn",
        });
      } else if (latestChurn > 3) {
        insights.push({
          message: `Churn rate at ${latestChurn}%. Monitor closely and assess customer satisfaction.`,
          severity: "medium",
          category: "churn",
        });
      }
    }

    // Cost analysis
    const costMetrics = metrics.filter((m) => m.metric_type === "cost");
    if (costMetrics.length >= 2) {
      const recent = Number(costMetrics[costMetrics.length - 1].value);
      const previous = Number(costMetrics[costMetrics.length - 2].value);
      const costChange = ((recent - previous) / previous) * 100;
      if (costChange > 15) {
        insights.push({
          message: `Cost increased ${costChange.toFixed(1)}% period-over-period. Evaluate cost-saving opportunities.`,
          severity: "medium",
          category: "cost",
        });
      }
    }

    // Regional analysis
    const regions = [...new Set(revenueMetrics.filter((m) => m.region).map((m) => m.region))];
    for (const region of regions) {
      const regionData = revenueMetrics.filter((m) => m.region === region);
      if (regionData.length >= 2) {
        const first = Number(regionData[0].value);
        const last = Number(regionData[regionData.length - 1].value);
        const regionChange = ((last - first) / first) * 100;
        if (regionChange < -15) {
          insights.push({
            message: `Revenue in ${region} dropped ${Math.abs(regionChange).toFixed(1)}%. Investigate regional market conditions.`,
            severity: "high",
            category: "regional",
          });
        }
      }
    }

    if (insights.length === 0) {
      insights.push({
        message: "All metrics within normal ranges. Continue monitoring for changes.",
        severity: "info",
        category: "general",
      });
    }

    // Delete old insights for this org (keep last 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Use service role for inserting insights
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await serviceSupabase
      .from("insights")
      .delete()
      .eq("organization_id", organization_id)
      .lt("created_at", yesterday);

    // Insert new insights
    const insightRows = insights.map((i) => ({
      organization_id,
      message: i.message,
      severity: i.severity,
      category: i.category,
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
