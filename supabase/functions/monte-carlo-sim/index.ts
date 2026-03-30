import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyAdaptiveConfidenceWithFetch, computeVariance } from "../_shared/adaptive-confidence.ts";
import { applyRateLimit } from "../_shared/rate-guard.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

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
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Use getClaims() for secure JWT validation
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.user?.id as string;

    const {
      organization_id,
      dataset_id,
      metric_type,
      forecast_horizon = 6,
      simulation_runs = 10000,
      dry_run,
    } = await req.json();

    if (!organization_id || !metric_type) {
      return new Response(
        JSON.stringify({ error: "organization_id and metric_type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!dataset_id) {
      return new Response(
        JSON.stringify({ error: "dataset_id required by Active Data Contract" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: simulation tier (10/min per org)
    const rl = applyRateLimit(req, organization_id, "simulation", "monte-carlo-sim");
    if (rl) return rl;

    // Verify org membership
    const { data: isMember } = await serviceClient.rpc("is_org_member", {
      _user_id: userId,
      _org_id: organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dry run: validate contract only
    if (dry_run) {
      return new Response(JSON.stringify({ dry_run: true, status: "PASS", dataset_id, organization_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch historical metrics — dataset-scoped
    const { data: metrics } = await serviceClient
      .from("metrics")
      .select("value, date")
      .eq("organization_id", organization_id)
      .eq("dataset_id", dataset_id)
      .eq("metric_type", metric_type)
      .order("date", { ascending: true });

    if (!metrics || metrics.length < 3) {
      return new Response(
        JSON.stringify({ error: "Insufficient data. Need at least 3 data points." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const values = metrics.map((m) => Number(m.value));
    const sampleSize = values.length;

    // Calculate log returns for GBM
    const logReturns: number[] = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0 && values[i] > 0) {
        logReturns.push(Math.log(values[i] / values[i - 1]));
      }
    }

    if (logReturns.length < 2) {
      return new Response(
        JSON.stringify({ error: "Insufficient positive data points for simulation." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GBM parameters
    const mu = logReturns.reduce((s, v) => s + v, 0) / logReturns.length;
    const sigma = Math.sqrt(
      logReturns.reduce((s, v) => s + (v - mu) ** 2, 0) / (logReturns.length - 1)
    );

    const lastValue = values[values.length - 1];
    const steps = forecast_horizon;
    const dt = 1;
    const runs = Math.min(simulation_runs, 50000);

    function randn(): number {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    // Run simulations — GBM
    const finalValues: number[] = [];
    for (let r = 0; r < runs; r++) {
      let price = lastValue;
      for (let t = 0; t < steps; t++) {
        const drift = (mu - 0.5 * sigma * sigma) * dt;
        const diffusion = sigma * Math.sqrt(dt) * randn();
        price = price * Math.exp(drift + diffusion);
      }
      finalValues.push(price);
    }

    finalValues.sort((a, b) => a - b);

    const percentile = (arr: number[], p: number) => {
      const idx = Math.floor(p * arr.length);
      return arr[Math.min(idx, arr.length - 1)];
    };

    const expectedValue = finalValues.reduce((s, v) => s + v, 0) / finalValues.length;
    const medianValue = percentile(finalValues, 0.5);
    const p10 = percentile(finalValues, 0.1);
    const p25 = percentile(finalValues, 0.25);
    const p75 = percentile(finalValues, 0.75);
    const p90 = percentile(finalValues, 0.9);
    const probNegative = finalValues.filter((v) => v < lastValue).length / finalValues.length;
    const var95 = lastValue - percentile(finalValues, 0.05);

    // Confidence via universal adaptive helper
    const varianceScore = computeVariance(values);
    const rawConf = Math.max(30, Math.min(95, 90 - varianceScore * 0.5));
    const conf = await applyAdaptiveConfidenceWithFetch(
      { rawConfidence: rawConf, sampleSize, variance: varianceScore },
      supabaseUrl, serviceKey, organization_id,
    );

    const result = {
      organization_id,
      dataset_id,
      metric_type,
      forecast_horizon: steps,
      simulation_runs: runs,
      expected_value: round2(expectedValue),
      median_value: round2(medianValue),
      p10_value: round2(p10),
      p25_value: round2(p25),
      p75_value: round2(p75),
      p90_value: round2(p90),
      probability_negative: round2(probNegative * 100),
      value_at_risk_95: round2(var95),
      mean_growth_rate: round2(mu * 100),
      volatility: round2(sigma * 100),
      // Map adaptive confidence to table columns
      capped_confidence: conf.capped_confidence,
      raw_confidence: conf.raw_confidence,
      confidence_cap_reason: conf.confidence_cap_reason,
      variance_score: conf.variance_score,
      sample_size: sampleSize,
      data_sufficiency: conf.data_sufficiency,
      created_by: user.id,
    };

    // Store result
    const { data: inserted, error: insertErr } = await serviceClient
      .from("simulation_results")
      .insert(result)
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        success: true,
        simulation_id: inserted.id,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("monte-carlo-sim error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
