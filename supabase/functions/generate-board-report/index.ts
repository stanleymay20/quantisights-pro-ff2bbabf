import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
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

    // Tier check (Growth+)
    const { data: sub } = await serviceClient
      .from("subscriptions").select("tier")
      .eq("organization_id", organization_id).eq("status", "active").maybeSingle();
    const tier = sub?.tier || "starter";
    if (tier === "starter") {
      return new Response(JSON.stringify({ error: "Board reports require Growth or Enterprise plan" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch org name
    const { data: org } = await serviceClient
      .from("organizations").select("name").eq("id", organization_id).single();

    // Fetch all data in parallel
    const [riskResult, convergenceResult, conflictsResult, simulationResult] = await Promise.all([
      serviceClient
        .from("executive_risk_index")
        .select("role_type, score, components, last_updated, escalation_required, escalation_reason")
        .eq("organization_id", organization_id),
      serviceClient
        .from("executive_convergence_index")
        .select("score, dispersion, conflict_penalty, volatility_divergence, alignment_status, created_at")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      serviceClient
        .from("executive_conflicts")
        .select("rule_triggered, severity, role_1, role_2, description, created_at")
        .eq("organization_id", organization_id)
        .is("resolved_at", null)
        .order("created_at", { ascending: false }),
      serviceClient
        .from("scenario_results")
        .select("kpi_id, baseline_value, simulated_value, delta_value, date")
        .eq("organization_id", organization_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const roleRisks = (riskResult.data || []).map((r: any) => ({
      role_type: r.role_type,
      score: r.score,
      components: r.components,
      last_updated: r.last_updated,
      escalation_required: r.escalation_required,
      escalation_reason: r.escalation_reason,
    }));

    const convergence = convergenceResult.data || null;
    const conflicts = conflictsResult.data || [];
    const simulation = simulationResult.data || [];

    // AI narrative for Enterprise
    let aiNarrative: any = null;
    if (tier === "enterprise" && lovableApiKey) {
      const contextBlock = `
BOARD GOVERNANCE REPORT DATA:
Organization: ${org?.name || "Unknown"}
Generated: ${new Date().toISOString()}

ROLE RISK INDICES:
${roleRisks.map((r: any) => `${r.role_type.toUpperCase()}: ${r.score}/100 (dev=${r.components?.deviation}, trend=${r.components?.trend}, vol=${r.components?.volatility}, forecast=${r.components?.forecast})${r.escalation_required ? " ⚠ ESCALATION" : ""}`).join("\n")}

CONVERGENCE INDEX:
${convergence ? `Score: ${convergence.score}/100 | Status: ${convergence.alignment_status} | Dispersion: ${convergence.dispersion} | Conflict Penalty: ${convergence.conflict_penalty}` : "Not yet computed"}

ACTIVE CONFLICTS (${conflicts.length}):
${conflicts.length > 0 ? conflicts.map((c: any) => `[${c.severity.toUpperCase()}] ${c.description}`).join("\n") : "None"}

SIMULATION DATA: ${simulation.length > 0 ? `${simulation.length} projections available` : "No recent simulations"}
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
                content: `You are a board governance advisor preparing an executive report. Return ONLY valid JSON:
{
  "governance_risk_statement": "2-3 sentence board-level risk summary",
  "strategic_outlook": "2-3 sentence forward-looking assessment",
  "recommended_actions": ["action1", "action2", "action3", "action4", "action5"],
  "confidence_score": 0-100
}
No markdown. Reference only supplied metrics. Be authoritative and precise.`,
              },
              { role: "user", content: contextBlock },
            ],
            tools: [{
              type: "function",
              function: {
                name: "board_narrative",
                description: "Return structured board governance narrative",
                parameters: {
                  type: "object",
                  properties: {
                    governance_risk_statement: { type: "string" },
                    strategic_outlook: { type: "string" },
                    recommended_actions: { type: "array", items: { type: "string" } },
                    confidence_score: { type: "number" },
                  },
                  required: ["governance_risk_statement", "strategic_outlook", "recommended_actions", "confidence_score"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "board_narrative" } },
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            aiNarrative = JSON.parse(toolCall.function.arguments);
          }
        }
      } catch (aiErr) {
        console.error("AI board narrative error:", aiErr);
      }
    }

    const report = {
      organization_name: org?.name || "Unknown",
      generated_at: new Date().toISOString(),
      generated_by: user.email,
      tier,
      role_risks: roleRisks,
      convergence,
      conflicts,
      simulation,
      ai_narrative: aiNarrative,
    };

    console.log(JSON.stringify({
      event: "board_report_generated",
      organization_id,
      roles_count: roleRisks.length,
      conflicts_count: conflicts.length,
      has_convergence: !!convergence,
      has_ai: !!aiNarrative,
    }));

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-board-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
