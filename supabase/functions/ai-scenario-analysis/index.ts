import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
  const corsHeaders = getCorsHeaders(req);

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { scenario_id } = await req.json();
    if (!scenario_id) {
      return new Response(JSON.stringify({ error: "scenario_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch scenario
    const { data: scenario } = await serviceClient
      .from("scenarios")
      .select("*")
      .eq("id", scenario_id)
      .single();

    if (!scenario) {
      return new Response(JSON.stringify({ error: "Scenario not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: isMember } = await serviceClient.rpc("is_org_member", {
      _user_id: userId, _org_id: scenario.organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tier check — Growth+ only
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("tier")
      .eq("organization_id", scenario.organization_id)
      .eq("status", "active")
      .maybeSingle();

    const tier = sub?.tier || "starter";
    if (tier === "starter") {
      return new Response(
        JSON.stringify({ error: "AI scenario analysis requires Growth or Enterprise plan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch assumptions and results
    const [{ data: assumptions }, { data: results }] = await Promise.all([
      serviceClient.from("scenario_assumptions").select("*").eq("scenario_id", scenario_id),
      serviceClient.from("scenario_results").select("kpi_id, date, baseline_value, simulated_value, delta_value")
        .eq("scenario_id", scenario_id).order("date", { ascending: true }).limit(500),
    ]);

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ error: "Run simulation first before requesting AI analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch KPI names
    const kpiIds = [...new Set(results.map((r: any) => r.kpi_id))];
    const { data: kpis } = await serviceClient
      .from("kpis")
      .select("id, name")
      .in("id", kpiIds);

    const kpiNames: Record<string, string> = {};
    kpis?.forEach((k: any) => { kpiNames[k.id] = k.name; });

    // Build prompt data
    const assumptionsStr = assumptions?.map((a: any) =>
      `${a.metric_type}: ${a.adjustment_type} ${a.adjustment_value > 0 ? "+" : ""}${a.adjustment_value}`
    ).join("\n") || "None";

    // Aggregate results by KPI
    const kpiAgg: Record<string, { baseline: number; simulated: number; delta: number; count: number }> = {};
    for (const r of results) {
      const key = r.kpi_id;
      if (!kpiAgg[key]) kpiAgg[key] = { baseline: 0, simulated: 0, delta: 0, count: 0 };
      kpiAgg[key].baseline += Number(r.baseline_value);
      kpiAgg[key].simulated += Number(r.simulated_value);
      kpiAgg[key].delta += Number(r.delta_value);
      kpiAgg[key].count++;
    }

    const resultsStr = Object.entries(kpiAgg).map(([id, agg]) =>
      `${kpiNames[id] || id}: Baseline=${agg.baseline.toFixed(2)}, Simulated=${agg.simulated.toFixed(2)}, Delta=${agg.delta.toFixed(2)} (${agg.count} days)`
    ).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // AI call with AbortController timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an elite strategic advisor analyzing scenario simulations.

GROUNDING RULES (NON-NEGOTIABLE):
- ONLY reference baseline values, simulated values, and deltas provided in the context.
- NEVER fabricate financial projections, percentages, or impact estimates not directly derived from the provided data.
- If data is insufficient to make a strategic assessment, state so explicitly.
- Reference specific KPI names and their actual baseline/simulated values.
- Confidence CANNOT exceed 75% for scenario projections (inherently uncertain).
- Label ALL forward-looking statements as "PROJECTED" or "ESTIMATED".
- State the number of KPIs and assumptions you analyzed.

Always respond using the structured tool call format.`,
          },
          {
            role: "user",
            content: `Scenario: "${scenario.name}"
Description: ${scenario.description || "N/A"}
Forecast: ${scenario.forecast_start_date} to ${scenario.forecast_end_date}

Assumptions:
${assumptionsStr}

Projected KPI Impact:
${resultsStr}

Provide strategic analysis of this scenario.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "scenario_analysis",
            description: "Return structured scenario analysis",
            parameters: {
              type: "object",
              properties: {
                executive_summary: { type: "string", description: "2-3 sentence executive summary" },
                projected_outcome: { type: "string", enum: ["positive", "negative", "neutral", "mixed"] },
                strategic_risks: { type: "array", items: { type: "string" } },
                opportunity_areas: { type: "array", items: { type: "string" } },
                recommended_actions: { type: "array", items: { type: "string" } },
                confidence_score: { type: "number" },
              },
              required: ["executive_summary", "projected_outcome", "strategic_risks", "opportunity_areas", "recommended_actions", "confidence_score"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "scenario_analysis" } },
      }),
    });

    clearTimeout(timeout);

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let analysis;

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      analysis = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } else {
      const content = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { executive_summary: content, projected_outcome: "neutral", strategic_risks: [], opportunity_areas: [], recommended_actions: [], confidence_score: 50 };
    }

    // Audit log
    console.log(JSON.stringify({
      event: "ai_scenario_analysis",
      scenario_id,
      organization_id: scenario.organization_id,
      user_id: userId,
      kpis_analyzed: Object.keys(kpiAgg).length,
      assumptions_count: assumptions?.length || 0,
    }));

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-scenario-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
