import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchCalibrationModel } from "../_shared/adaptive-confidence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_LIMITS: Record<string, number> = {
  starter: parseInt(Deno.env.get("TIER_STARTER_SIMULATION_LIMIT") || "5"),
  growth: parseInt(Deno.env.get("TIER_GROWTH_SIMULATION_LIMIT") || "20"),
  enterprise: parseInt(Deno.env.get("TIER_ENTERPRISE_SIMULATION_LIMIT") || "999999"),
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

function computeProjectedRisk(
  baseline: RiskComponents,
  params: SimulationInput
): { components: RiskComponents; score: number } {
  let { deviation, trend, volatility, forecast } = { ...baseline };

  const revChange = params.revenue_change_percent || 0;
  const costChange = params.cost_change_percent || 0;
  const headcountChange = params.headcount_change_percent || 0;
  const marketingChange = params.marketing_spend_change_percent || 0;

  // Revenue impact: negative revenue increases deviation and volatility
  if (revChange < 0) {
    deviation = Math.min(100, deviation + Math.abs(revChange) * 1.5);
    volatility = Math.min(100, volatility + Math.abs(revChange) * 0.8);
    forecast = Math.min(100, forecast + Math.abs(revChange) * 1.0);
  } else if (revChange > 0) {
    deviation = Math.max(0, deviation - revChange * 0.8);
    forecast = Math.max(0, forecast - revChange * 0.5);
  }

  // Cost impact: cost increases raise trend risk
  if (costChange > 0) {
    trend = Math.min(100, trend + costChange * 0.6);
    deviation = Math.min(100, deviation + costChange * 0.4);
  } else if (costChange < 0) {
    trend = Math.max(0, trend - Math.abs(costChange) * 0.3);
  }

  // Headcount impact: >15% drop triggers operational risk surge
  if (headcountChange < -15) {
    volatility = Math.min(100, volatility + Math.abs(headcountChange) * 1.2);
    trend = Math.min(100, trend + Math.abs(headcountChange) * 0.8);
    forecast = Math.min(100, forecast + Math.abs(headcountChange) * 0.5);
  } else if (headcountChange < 0) {
    volatility = Math.min(100, volatility + Math.abs(headcountChange) * 0.5);
  } else if (headcountChange > 0) {
    // Hiring reduces operational risk slightly but increases cost pressure
    volatility = Math.max(0, volatility - headcountChange * 0.3);
    trend = Math.min(100, trend + headcountChange * 0.2);
  }

  // Marketing spend impact
  if (marketingChange < 0) {
    forecast = Math.min(100, forecast + Math.abs(marketingChange) * 0.6);
  } else if (marketingChange > 0) {
    forecast = Math.max(0, forecast - marketingChange * 0.3);
  }

  // Clamp all
  deviation = Math.round(Math.max(0, Math.min(100, deviation)));
  trend = Math.round(Math.max(0, Math.min(100, trend)));
  volatility = Math.round(Math.max(0, Math.min(100, volatility)));
  forecast = Math.round(Math.max(0, Math.min(100, forecast)));

  // Weighted score: 0.4 deviation + 0.2 volatility + 0.2 trend + 0.2 forecast
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

    const { organization_id, role_type, scenario_parameters } = await req.json();

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

    // Compute deterministic projection
    const params: SimulationInput = {
      revenue_change_percent: scenario_parameters.revenue_change_percent ?? null,
      cost_change_percent: scenario_parameters.cost_change_percent ?? null,
      headcount_change_percent: scenario_parameters.headcount_change_percent ?? null,
      marketing_spend_change_percent: scenario_parameters.marketing_spend_change_percent ?? null,
      custom_notes: scenario_parameters.custom_notes ?? null,
    };

    const projected = computeProjectedRisk(baselineComponents, params);
    const riskDelta = projected.score - baselineRisk;
    const escalationTriggered = projected.score >= 80;

    // Build KPI projections
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
      // Directional projection — labeled as estimates, not predictions.
      // Uses simple linear sensitivity: revenue change → proportional KPI shift
      // This is a HEURISTIC MODEL — labeled clearly in the output.
      const revImpact = (params.revenue_change_percent || 0) / 100;
      const costImpact = (params.cost_change_percent || 0) / 100;
      // Sensitivity coefficients are heuristic assumptions, not calibrated
      const projectedValue = kpi.baseline * (1 + revImpact * 0.7 - costImpact * 0.3);
      return {
        kpi_name: kpi.name,
        baseline_value: Math.round(kpi.baseline * 100) / 100,
        projected_value: Math.round(projectedValue * 100) / 100,
        delta_percent: Math.round((projectedValue / kpi.baseline - 1) * 10000) / 100,
        model_type: "heuristic_linear_sensitivity",
        note: "Estimate based on assumed linear sensitivity coefficients (0.7 revenue, 0.3 cost). Not calibrated to historical data.",
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
