import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { capConfidence, computeVariance } from "../_shared/confidence-cap.ts";

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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const svc = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      organization_id,
      decision_id,
      revenue_delta_pct = 0,
      cost_delta_pct = 0,
      churn_change_pct = 0,
      implementation_cost = 0,
      time_to_impact_months = 3,
      simulation_runs = 10000,
    } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify org membership
    const { data: isMember } = await svc.rpc("is_org_member", {
      _user_id: user.id,
      _org_id: organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch historical revenue, cost, churn metrics for volatility estimation
    const metricTypes = ["revenue", "cost", "churn_rate"];
    const metricData: Record<string, number[]> = {};

    for (const mt of metricTypes) {
      const { data } = await svc
        .from("metrics")
        .select("value")
        .eq("organization_id", organization_id)
        .eq("metric_type", mt)
        .order("date", { ascending: true });
      metricData[mt] = (data || []).map((m) => Number(m.value));
    }

    const revenueValues = metricData.revenue;
    const costValues = metricData.cost;
    const churnValues = metricData.churn_rate;

    // Sample size = minimum across all used metrics (conservative)
    const sampleSize = Math.max(
      3,
      Math.min(
        revenueValues.length || 3,
        costValues.length || 3,
        churnValues.length || 3
      )
    );

    // Compute volatilities
    const revenueVol = computeLogVolatility(revenueValues);
    const costVol = computeLogVolatility(costValues);
    const churnVol = computeLogVolatility(churnValues);

    // Base values (latest or defaults)
    const baseRevenue = revenueValues.length > 0 ? revenueValues[revenueValues.length - 1] : 100000;
    const baseCost = costValues.length > 0 ? costValues[costValues.length - 1] : 50000;
    const baseChurn = churnValues.length > 0 ? churnValues[churnValues.length - 1] : 5;

    const runs = Math.min(simulation_runs, 50000);
    const steps = time_to_impact_months;

    // Correlation assumptions (revenue-cost typically correlated ~0.6)
    const correlations = { revenue_cost: 0.6, revenue_churn: -0.3 };

    const netImpacts: number[] = [];

    for (let r = 0; r < runs; r++) {
      // Correlated random normals using Cholesky
      const z1 = randn();
      const z2 = correlations.revenue_cost * z1 + Math.sqrt(1 - correlations.revenue_cost ** 2) * randn();
      const z3 = correlations.revenue_churn * z1 + Math.sqrt(1 - correlations.revenue_churn ** 2) * randn();

      // Simulate revenue path
      const revDrift = (revenue_delta_pct / 100) / steps;
      const revShock = (revenueVol / 100) * Math.sqrt(steps) * z1;
      const simRevenue = baseRevenue * Math.exp(revDrift * steps + revShock);

      // Simulate cost path
      const costDrift = (cost_delta_pct / 100) / steps;
      const costShock = (costVol / 100) * Math.sqrt(steps) * z2;
      const simCost = baseCost * Math.exp(costDrift * steps + costShock);

      // Simulate churn path (bounded 0-100)
      const churnDelta = baseChurn * (churn_change_pct / 100) + (churnVol / 100) * baseChurn * z3;
      const simChurn = Math.max(0, Math.min(100, baseChurn + churnDelta));

      // Churn revenue erosion (monthly compounding)
      const retentionFactor = Math.pow(1 - simChurn / 100, steps);

      // Net impact = (new revenue × retention) - new cost - implementation cost - baseline profit
      const baselineProfit = (baseRevenue * Math.pow(1 - baseChurn / 100, steps)) - baseCost;
      const simProfit = (simRevenue * retentionFactor) - simCost - implementation_cost;
      const netImpact = simProfit - baselineProfit;

      netImpacts.push(netImpact);
    }

    // Sort for percentile extraction
    netImpacts.sort((a, b) => a - b);

    const percentile = (arr: number[], p: number) => {
      const idx = Math.floor(p * arr.length);
      return arr[Math.min(idx, arr.length - 1)];
    };

    const expectedNet = netImpacts.reduce((s, v) => s + v, 0) / netImpacts.length;
    const medianNet = percentile(netImpacts, 0.5);
    const p10 = percentile(netImpacts, 0.1);
    const p50 = percentile(netImpacts, 0.5);
    const p90 = percentile(netImpacts, 0.9);
    const probPositiveRoi = netImpacts.filter((v) => v > 0).length / netImpacts.length;
    const probCashStress = netImpacts.filter((v) => v < -implementation_cost * 0.5).length / netImpacts.length;
    const riskAdjustedEV = expectedNet * probPositiveRoi;

    // Confidence governance
    const allValues = [...revenueValues, ...costValues, ...churnValues];
    const varianceScore = computeVariance(allValues.length > 1 ? allValues : [1, 1]);
    const rawConf = Math.max(30, Math.min(95, 85 - varianceScore * 0.4));

    // Fetch learning adjustment from past calibrations
    const { data: pastSims } = await svc
      .from("decision_simulations")
      .select("calibration_delta")
      .eq("organization_id", organization_id)
      .not("calibration_delta", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    let learningAdjustment = 0;
    if (pastSims && pastSims.length >= 5) {
      const avgCalDelta = pastSims.reduce((s, p) => s + Number(p.calibration_delta), 0) / pastSims.length;
      // If we've been systematically over/under-confident, adjust
      learningAdjustment = -avgCalDelta * 0.1; // gentle correction
    }

    const adjustedRawConf = Math.max(20, Math.min(95, rawConf + learningAdjustment));
    const conf = capConfidence(adjustedRawConf, sampleSize, varianceScore);

    const result = {
      organization_id,
      decision_id: decision_id || null,
      revenue_delta_pct,
      cost_delta_pct,
      churn_change_pct,
      implementation_cost,
      time_to_impact_months: steps,
      expected_net_impact: round2(expectedNet),
      median_net_impact: round2(medianNet),
      p10_impact: round2(p10),
      p50_impact: round2(p50),
      p90_impact: round2(p90),
      probability_positive_roi: round2(probPositiveRoi * 100),
      probability_cashflow_stress: round2(probCashStress * 100),
      risk_adjusted_expected_value: round2(riskAdjustedEV),
      raw_confidence: conf.raw_confidence,
      capped_confidence: conf.capped_confidence,
      confidence_cap_reason: conf.confidence_cap_reason,
      variance_score: conf.variance_score,
      sample_size: sampleSize,
      data_sufficiency: conf.data_sufficiency,
      correlation_assumptions: correlations,
      model_version: 1,
      simulation_runs: runs,
      created_by: user.id,
    };

    // Store simulation
    const { data: inserted, error: insertErr } = await svc
      .from("decision_simulations")
      .insert(result)
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    // Link to decision if provided
    if (decision_id) {
      await svc
        .from("decision_ledger")
        .update({
          decision_simulation_id: inserted.id,
          predicted_roi_probability: round2(probPositiveRoi * 100),
          predicted_net_impact: round2(expectedNet),
        })
        .eq("id", decision_id);
    }

    return new Response(
      JSON.stringify({ success: true, simulation_id: inserted.id, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("decision-impact-sim error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function randn(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function computeLogVolatility(values: number[]): number {
  if (values.length < 2) return 20; // default 20% vol
  const logReturns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0 && values[i] > 0) {
      logReturns.push(Math.log(values[i] / values[i - 1]));
    }
  }
  if (logReturns.length < 2) return 20;
  const mean = logReturns.reduce((s, v) => s + v, 0) / logReturns.length;
  const variance = logReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / (logReturns.length - 1);
  return Math.sqrt(variance) * 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
