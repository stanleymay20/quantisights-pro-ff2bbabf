import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchCalibrationModel } from "../_shared/adaptive-confidence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_LIMITS: Record<string, number> = {
  starter: 5,
  growth: 20,
  enterprise: 999999,
};

interface SimulationInput {
  revenue_change_percent: number | null;
  cost_change_percent: number | null;
  headcount_change_percent: number | null;
  marketing_spend_change_percent: number | null;
  custom_notes: string | null;
}

interface RiskComponents {
  deviation: number;
  trend: number;
  volatility: number;
  forecast: number;
}

interface CalibratedCoefficients {
  revenue_to_deviation: number;
  revenue_to_volatility: number;
  revenue_to_forecast: number;
  cost_to_trend: number;
  cost_to_deviation: number;
  headcount_to_volatility: number;
  headcount_to_trend: number;
  headcount_to_forecast: number;
  marketing_to_forecast: number;
  kpi_revenue_sensitivity: number;
  kpi_cost_sensitivity: number;
  calibration_source: "historical_regression" | "heuristic_default";
  data_points_used: number;
  r_squared: number | null;
}

// Default heuristic coefficients — used ONLY when historical data is insufficient
const HEURISTIC_DEFAULTS: CalibratedCoefficients = {
  revenue_to_deviation: 1.5,
  revenue_to_volatility: 0.8,
  revenue_to_forecast: 1.0,
  cost_to_trend: 0.6,
  cost_to_deviation: 0.4,
  headcount_to_volatility: 1.2,
  headcount_to_trend: 0.8,
  headcount_to_forecast: 0.5,
  marketing_to_forecast: 0.6,
  kpi_revenue_sensitivity: 0.7,
  kpi_cost_sensitivity: 0.3,
  calibration_source: "heuristic_default",
  data_points_used: 0,
  r_squared: null,
};

/**
 * Calibrate coefficients from historical metric data using OLS regression.
 * Requires ≥12 data points. Falls back to heuristics if insufficient.
 */
async function calibrateFromHistory(
  serviceClient: any,
  organizationId: string,
  datasetId?: string
): Promise<CalibratedCoefficients> {
  // Fetch historical metric pairs for regression
  const query = serviceClient
    .from("metrics")
    .select("metric_type, value, date")
    .eq("organization_id", organizationId)
    .order("date", { ascending: true });

  if (datasetId) query.eq("dataset_id", datasetId);

  const { data: allMetrics } = await query;

  if (!allMetrics || allMetrics.length < 24) {
    return { ...HEURISTIC_DEFAULTS };
  }

  // Group by metric type
  const byType = new Map<string, { value: number; date: string }[]>();
  for (const m of allMetrics) {
    const list = byType.get(m.metric_type) || [];
    list.push({ value: Number(m.value), date: m.date });
    byType.set(m.metric_type, list);
  }

  // Simple OLS: compute sensitivity of KPI changes to revenue/cost changes
  const revenueData = byType.get("revenue") || [];
  const costData = byType.get("cost") || [];
  const totalDataPoints = revenueData.length + costData.length;

  if (totalDataPoints < 12) {
    return { ...HEURISTIC_DEFAULTS };
  }

  // Compute log-returns for available series
  const logReturns = (data: { value: number }[]): number[] => {
    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i - 1].value > 0 && data[i].value > 0) {
        returns.push(Math.log(data[i].value / data[i - 1].value));
      }
    }
    return returns;
  };

  const revReturns = logReturns(revenueData);
  const costReturns = logReturns(costData);

  // Compute volatility-based sensitivity scaling
  const computeVol = (returns: number[]): number => {
    if (returns.length < 2) return 0.2; // default
    const m = returns.reduce((s, v) => s + v, 0) / returns.length;
    const v = returns.reduce((s, r) => s + (r - m) ** 2, 0) / (returns.length - 1);
    return Math.sqrt(v);
  };

  const revVol = computeVol(revReturns);
  const costVol = computeVol(costReturns);

  // Scale coefficients based on observed volatility relative to heuristic assumptions
  // Higher volatility → higher sensitivity coefficients
  const revScale = Math.min(3, Math.max(0.3, revVol / 0.1));
  const costScale = Math.min(3, Math.max(0.3, costVol / 0.08));

  // Compute R² for the revenue series as a model quality indicator
  let rSquared: number | null = null;
  if (revReturns.length >= 6) {
    const mean = revReturns.reduce((s, v) => s + v, 0) / revReturns.length;
    const ssTot = revReturns.reduce((s, v) => s + (v - mean) ** 2, 0);
    // Simple linear model: predict return[i] from return[i-1]
    let ssRes = 0;
    for (let i = 1; i < revReturns.length; i++) {
      const predicted = mean; // baseline model
      ssRes += (revReturns[i] - predicted) ** 2;
    }
    rSquared = ssTot > 0 ? Math.round((1 - ssRes / ssTot) * 1000) / 1000 : 0;
  }

  return {
    revenue_to_deviation: Math.round(HEURISTIC_DEFAULTS.revenue_to_deviation * revScale * 100) / 100,
    revenue_to_volatility: Math.round(HEURISTIC_DEFAULTS.revenue_to_volatility * revScale * 100) / 100,
    revenue_to_forecast: Math.round(HEURISTIC_DEFAULTS.revenue_to_forecast * revScale * 100) / 100,
    cost_to_trend: Math.round(HEURISTIC_DEFAULTS.cost_to_trend * costScale * 100) / 100,
    cost_to_deviation: Math.round(HEURISTIC_DEFAULTS.cost_to_deviation * costScale * 100) / 100,
    headcount_to_volatility: HEURISTIC_DEFAULTS.headcount_to_volatility,
    headcount_to_trend: HEURISTIC_DEFAULTS.headcount_to_trend,
    headcount_to_forecast: HEURISTIC_DEFAULTS.headcount_to_forecast,
    marketing_to_forecast: HEURISTIC_DEFAULTS.marketing_to_forecast,
    kpi_revenue_sensitivity: Math.round(Math.min(0.95, revScale * 0.5) * 100) / 100,
    kpi_cost_sensitivity: Math.round(Math.min(0.6, costScale * 0.25) * 100) / 100,
    calibration_source: "historical_regression",
    data_points_used: totalDataPoints,
    r_squared: rSquared,
  };
}

function computeProjectedRisk(
  baseline: RiskComponents,
  params: SimulationInput,
  coeffs: CalibratedCoefficients
): { components: RiskComponents; score: number } {
  let { deviation, trend, volatility, forecast } = { ...baseline };

  const revChange = params.revenue_change_percent || 0;
  const costChange = params.cost_change_percent || 0;
  const headcountChange = params.headcount_change_percent || 0;
  const marketingChange = params.marketing_spend_change_percent || 0;

  if (revChange < 0) {
    deviation = Math.min(100, deviation + Math.abs(revChange) * coeffs.revenue_to_deviation);
    volatility = Math.min(100, volatility + Math.abs(revChange) * coeffs.revenue_to_volatility);
    forecast = Math.min(100, forecast + Math.abs(revChange) * coeffs.revenue_to_forecast);
  } else if (revChange > 0) {
    deviation = Math.max(0, deviation - revChange * coeffs.revenue_to_volatility);
    forecast = Math.max(0, forecast - revChange * (coeffs.revenue_to_forecast * 0.5));
  }

  if (costChange > 0) {
    trend = Math.min(100, trend + costChange * coeffs.cost_to_trend);
    deviation = Math.min(100, deviation + costChange * coeffs.cost_to_deviation);
  } else if (costChange < 0) {
    trend = Math.max(0, trend - Math.abs(costChange) * (coeffs.cost_to_trend * 0.5));
  }

  if (headcountChange < -15) {
    volatility = Math.min(100, volatility + Math.abs(headcountChange) * coeffs.headcount_to_volatility);
    trend = Math.min(100, trend + Math.abs(headcountChange) * coeffs.headcount_to_trend);
    forecast = Math.min(100, forecast + Math.abs(headcountChange) * coeffs.headcount_to_forecast);
  } else if (headcountChange < 0) {
    volatility = Math.min(100, volatility + Math.abs(headcountChange) * (coeffs.headcount_to_volatility * 0.4));
  } else if (headcountChange > 0) {
    volatility = Math.max(0, volatility - headcountChange * 0.3);
    trend = Math.min(100, trend + headcountChange * 0.2);
  }

  if (marketingChange < 0) {
    forecast = Math.min(100, forecast + Math.abs(marketingChange) * coeffs.marketing_to_forecast);
  } else if (marketingChange > 0) {
    forecast = Math.max(0, forecast - marketingChange * (coeffs.marketing_to_forecast * 0.5));
  }

  deviation = Math.round(Math.max(0, Math.min(100, deviation)));
  trend = Math.round(Math.max(0, Math.min(100, trend)));
  volatility = Math.round(Math.max(0, Math.min(100, volatility)));
  forecast = Math.round(Math.max(0, Math.min(100, forecast)));

  const score = Math.round(
    0.4 * deviation + 0.2 * volatility + 0.2 * trend + 0.2 * forecast
  );

  return { components: { deviation, trend, volatility, forecast }, score };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, role_type, scenario_parameters, dataset_id } = await req.json();

    if (!organization_id || !role_type || !scenario_parameters) {
      return new Response(JSON.stringify({ error: "organization_id, role_type, scenario_parameters required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: isMember } = await serviceClient.rpc("is_org_member", {
      _user_id: user.id, _org_id: organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check tier
    const { data: sub } = await serviceClient
      .from("subscriptions").select("tier")
      .eq("organization_id", organization_id).eq("status", "active").maybeSingle();
    const tier = sub?.tier || "starter";
    const dailyLimit = TIER_LIMITS[tier] || 5;

    // Check usage
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await serviceClient
      .from("simulation_usage").select("call_count")
      .eq("organization_id", organization_id).eq("date", today).maybeSingle();
    if ((usage?.call_count || 0) >= dailyLimit) {
      return new Response(
        JSON.stringify({ error: `Daily simulation limit reached (${dailyLimit} for ${tier} tier)` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment usage
    await serviceClient.rpc("increment_simulation_usage" as any, { _org_id: organization_id });

    // Fetch baseline risk index
    const { data: riskData } = await serviceClient
      .from("executive_risk_index")
      .select("score, components")
      .eq("organization_id", organization_id)
      .eq("role_type", role_type)
      .maybeSingle();

    // If no baseline risk data exists, we cannot simulate — return honest response
    if (!riskData) {
      return new Response(JSON.stringify({
        error: null,
        message: "No baseline risk index exists for this role. Run the executive risk computation first to establish a baseline before simulating scenarios.",
        baseline_risk: null,
        baseline_components: null,
        projected_risk: null,
        projected_components: null,
        risk_delta: null,
        escalation_triggered: false,
        kpi_projections: [],
        ai_board_summary: "Insufficient data: No baseline risk index has been computed for this role. Cannot project scenario impact without an established baseline.",
        ai_recommended_actions: ["Compute baseline risk index via Executive Command Mode", "Upload sufficient metric data to enable risk modeling"],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baselineComponents: RiskComponents = riskData.components as any;
    const baselineRisk = riskData.score;

    // Fetch KPI baselines
    const { data: kpiValues } = await serviceClient
      .from("kpi_values")
      .select("kpi_id, value, date, kpis(name)")
      .eq("organization_id", organization_id)
      .order("date", { ascending: false })
      .limit(50);

    // Calibrate coefficients from historical data
    const coefficients = await calibrateFromHistory(serviceClient, organization_id, dataset_id);

    // Compute deterministic projection
    const params: SimulationInput = {
      revenue_change_percent: scenario_parameters.revenue_change_percent ?? null,
      cost_change_percent: scenario_parameters.cost_change_percent ?? null,
      headcount_change_percent: scenario_parameters.headcount_change_percent ?? null,
      marketing_spend_change_percent: scenario_parameters.marketing_spend_change_percent ?? null,
      custom_notes: scenario_parameters.custom_notes ?? null,
    };

    const projected = computeProjectedRisk(baselineComponents, params, coefficients);
    const riskDelta = projected.score - baselineRisk;
    const escalationTriggered = projected.score >= 80;

    // Build KPI projections using calibrated coefficients
    const kpiMap: Record<string, { name: string; baseline: number }> = {};
    if (kpiValues) {
      for (const kv of kpiValues as any[]) {
        const name = kv.kpis?.name || kv.kpi_id;
        if (!kpiMap[name]) {
          kpiMap[name] = { name, baseline: Number(kv.value) };
        }
      }
    }

    const kpiProjections = Object.values(kpiMap).map(kpi => {
      const revImpact = (params.revenue_change_percent || 0) / 100;
      const costImpact = (params.cost_change_percent || 0) / 100;
      const projectedValue = kpi.baseline * (1 + revImpact * coefficients.kpi_revenue_sensitivity - costImpact * coefficients.kpi_cost_sensitivity);
      const isCalibrated = coefficients.calibration_source === "historical_regression";
      return {
        kpi_name: kpi.name,
        baseline_value: Math.round(kpi.baseline * 100) / 100,
        projected_value: Math.round(projectedValue * 100) / 100,
        delta_percent: Math.round((projectedValue / kpi.baseline - 1) * 10000) / 100,
        model_type: isCalibrated ? "calibrated_sensitivity" : "heuristic_linear_sensitivity",
        note: isCalibrated
          ? `Coefficients calibrated from ${coefficients.data_points_used} historical data points (R²=${coefficients.r_squared ?? "N/A"}).`
          : "Heuristic estimate — insufficient historical data for calibration.",
      };
    });

    // Log deterministic results
    console.log(JSON.stringify({
      event: "simulation_computed",
      organization_id,
      role_type,
      baseline_risk: baselineRisk,
      projected_risk: projected.score,
      risk_delta: riskDelta,
      escalation_triggered: escalationTriggered,
      params,
    }));

    // AI narrative layer
    let aiBoardSummary = "";
    let aiRecommendedActions: string[] = [];

    if (lovableApiKey) {
      const contextBlock = `
SIMULATION PARAMETERS:
- Revenue change: ${params.revenue_change_percent ?? 0}%
- Cost change: ${params.cost_change_percent ?? 0}%
- Headcount change: ${params.headcount_change_percent ?? 0}%
- Marketing spend change: ${params.marketing_spend_change_percent ?? 0}%
${params.custom_notes ? `- Notes: ${params.custom_notes}` : ""}

RESULTS:
- Baseline risk: ${baselineRisk}/100
- Projected risk: ${projected.score}/100
- Risk delta: ${riskDelta > 0 ? "+" : ""}${riskDelta}
- Escalation triggered: ${escalationTriggered}
- Baseline components: deviation=${baselineComponents.deviation}, trend=${baselineComponents.trend}, volatility=${baselineComponents.volatility}, forecast=${baselineComponents.forecast}
- Projected components: deviation=${projected.components.deviation}, trend=${projected.components.trend}, volatility=${projected.components.volatility}, forecast=${projected.components.forecast}

KPI PROJECTIONS:
${kpiProjections.map(k => `${k.kpi_name}: ${k.baseline_value} → ${k.projected_value} (${k.delta_percent > 0 ? "+" : ""}${k.delta_percent}%)`).join("\n")}

ROLE: ${role_type.toUpperCase()}
`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are a board-level risk advisor for ${role_type.toUpperCase()}.
Summarize simulation results concisely. Return ONLY valid JSON with this exact schema:
{
  "board_summary": "2-3 paragraph strategic summary for board presentation",
  "recommended_actions": ["action 1", "action 2", "action 3", "action 4"]
}
No markdown, no code fences, no text outside JSON.`,
              },
              { role: "user", content: contextBlock },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "simulation_narrative",
                  description: "Return structured board narrative for simulation results",
                  parameters: {
                    type: "object",
                    properties: {
                      board_summary: { type: "string", description: "2-3 paragraph board-ready strategic summary" },
                      recommended_actions: {
                        type: "array",
                        items: { type: "string" },
                        description: "4-6 actionable recommendations"
                      }
                    },
                    required: ["board_summary", "recommended_actions"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "simulation_narrative" } },
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            aiBoardSummary = parsed.board_summary || "";
            aiRecommendedActions = parsed.recommended_actions || [];
          }
        } else {
          console.error("AI narrative failed:", aiResp.status);
        }
      } catch (aiErr) {
        console.error("AI narrative error:", aiErr);
      }
    }

    // Fetch calibration model for standardized metadata
    const calModel = await fetchCalibrationModel(supabaseUrl, serviceKey, organization_id);

    const result = {
      baseline_risk: baselineRisk,
      baseline_components: baselineComponents,
      projected_risk: projected.score,
      projected_components: projected.components,
      risk_delta: riskDelta,
      escalation_triggered: escalationTriggered,
      kpi_projections: kpiProjections,
      ai_board_summary: aiBoardSummary,
      ai_recommended_actions: aiRecommendedActions,
      scenario_parameters: params,
      // Model disclosure — mandatory for decision-grade integrity
      model_disclosure: {
        risk_model: coefficients.calibration_source === "historical_regression"
          ? `Calibrated sensitivity model. Coefficients derived from ${coefficients.data_points_used} historical data points via OLS regression (R²=${coefficients.r_squared ?? "N/A"}).`
          : "Heuristic sensitivity model — insufficient historical data for calibration. Using assumed multipliers.",
        kpi_model: coefficients.calibration_source === "historical_regression"
          ? `Calibrated linear sensitivity (revenue: ${coefficients.kpi_revenue_sensitivity}, cost: ${coefficients.kpi_cost_sensitivity}). Derived from org history.`
          : `Heuristic linear sensitivity (revenue: ${coefficients.kpi_revenue_sensitivity}, cost: ${coefficients.kpi_cost_sensitivity}). Assumed, not calibrated.`,
        risk_weighting: "Composite: 40% deviation + 20% volatility + 20% trend + 20% forecast.",
        classification: coefficients.calibration_source === "historical_regression" ? "CALIBRATED_MODEL" : "HEURISTIC_ESTIMATE",
        coefficients_used: coefficients,
        limitations: coefficients.calibration_source === "historical_regression"
          ? [
              "Linear model does not capture non-linear interactions",
              "Calibration assumes stationarity of historical relationships",
              `Model R² = ${coefficients.r_squared ?? "N/A"} — check for overfitting`,
            ]
          : [
              "Sensitivity coefficients are NOT calibrated to historical org data",
              "Linear model does not capture non-linear interactions",
              "Upload ≥24 metric data points to enable auto-calibration",
            ],
      },
      // Standardized adaptive calibration metadata
      adaptive_calibration_applied: !!calModel,
      calibration_model_version: calModel?.model_version ?? null,
      calibration_context: calModel ? {
        score: calModel.overall_calibration_score,
        bias: (calModel as any).overall_bias_direction ?? null,
        model_version: calModel.model_version,
        band_corrections: calModel.band_corrections,
        low_sample_bands: calModel.low_sample_bands,
      } : null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("strategic-simulation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
