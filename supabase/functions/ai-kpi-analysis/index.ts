import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Server-side confidence cap based on data volume (epistemic integrity) */
function capConfidence(rawScore: number, dataPointCount: number): number {
  let maxAllowed = 90;
  if (dataPointCount < 12) maxAllowed = 60;
  else if (dataPointCount < 30) maxAllowed = 75;
  return Math.min(rawScore, maxAllowed);
}

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
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { kpi_id, dataset_id } = await req.json();
    if (!kpi_id) {
      return new Response(JSON.stringify({ error: "kpi_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!dataset_id) {
      return new Response(JSON.stringify({ error: "dataset_id required (Active Data Contract)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch KPI
    const { data: kpi } = await serviceClient
      .from("kpis")
      .select("*")
      .eq("id", kpi_id)
      .single();

    if (!kpi) {
      return new Response(JSON.stringify({ error: "KPI not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: isMember } = await serviceClient.rpc("is_org_member", {
      _user_id: user.id,
      _org_id: kpi.organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify dataset ownership — Active Data Contract enforcement
    const { data: dataset } = await serviceClient
      .from("datasets")
      .select("id")
      .eq("id", dataset_id)
      .eq("organization_id", kpi.organization_id)
      .maybeSingle();

    if (!dataset) {
      return new Response(
        JSON.stringify({ error: "Dataset not found or not owned by this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check tier — Growth+ only
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("tier")
      .eq("organization_id", kpi.organization_id)
      .eq("status", "active")
      .maybeSingle();

    const tier = sub?.tier || "starter";
    if (tier === "starter") {
      return new Response(
        JSON.stringify({ error: "AI KPI analysis requires Growth or Enterprise plan" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch KPI values — scoped by dataset_id via the KPI's org ownership
    const { data: values } = await serviceClient
      .from("kpi_values")
      .select("date, value")
      .eq("kpi_id", kpi_id)
      .order("date", { ascending: true })
      .limit(365);

    if (!values || values.length < 2) {
      return new Response(
        JSON.stringify({ error: "Not enough KPI data for analysis (minimum 2 data points)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch targets
    const { data: targets } = await serviceClient
      .from("kpi_targets")
      .select("target_value, target_date")
      .eq("kpi_id", kpi_id)
      .order("target_date", { ascending: true });

    // Build AI prompt
    const dataStr = values.map((v: any) => `${v.date}: ${v.value}`).join("\n");
    const targetStr = targets?.length
      ? targets.map((t: any) => `Target ${t.target_date}: ${t.target_value}`).join("\n")
      : "No targets set.";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // 30-second AbortController timeout per edge function standards
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are an elite executive data consultant. Analyze KPI data and provide strategic insights.

GROUNDING RULES (NON-NEGOTIABLE):
- ONLY reference values, dates, and trends that appear in the provided data.
- NEVER fabricate numbers, percentages, or trends not directly computable from the data.
- If data is insufficient for a conclusion, state: "Insufficient data to determine [X]."
- Reference specific data points (e.g., "On 2024-03-15, value was 42.5").
- Confidence CANNOT exceed 60% with <12 data points, 75% with <30, 90% max.
- State the number of data points you analyzed.

RESPONSE FORMAT: Always respond with valid JSON using this schema:
{
  "summary": "2-3 sentence executive summary citing specific values",
  "trend": "up" | "down" | "stable" | "volatile",
  "trend_percentage": number,
  "risk_level": "low" | "medium" | "high",
  "insights": ["insight 1 with specific data reference", ...],
  "recommendations": ["recommendation 1", ...],
  "confidence_score": number (0-100),
  "data_points_analyzed": number,
  "limitations": ["any caveats about the analysis"]
}`
            },
            {
              role: "user",
              content: `Analyze this KPI: "${kpi.name}" (${kpi.description || "No description"})
Formula: ${kpi.formula}
Aggregation: ${kpi.aggregation_type}
Data Points: ${values.length}

Historical values:
${dataStr}

Targets:
${targetStr}

Provide executive-grade analysis grounded ONLY in the data above. Reference specific dates and values.`
            }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "kpi_analysis",
                description: "Return structured KPI analysis",
                parameters: {
                  type: "object",
                  properties: {
                    summary: { type: "string", description: "2-3 sentence executive summary" },
                    trend: { type: "string", enum: ["up", "down", "stable", "volatile"] },
                    trend_percentage: { type: "number" },
                    risk_level: { type: "string", enum: ["low", "medium", "high"] },
                    insights: { type: "array", items: { type: "string" } },
                    recommendations: { type: "array", items: { type: "string" } },
                    confidence_score: { type: "number" },
                    data_points_analyzed: { type: "number" },
                    limitations: { type: "array", items: { type: "string" } }
                  },
                  required: ["summary", "trend", "trend_percentage", "risk_level", "insights", "recommendations", "confidence_score"],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "kpi_analysis" } }
        }),
      });

      clearTimeout(timeout);

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "AI rate limit exceeded, try again later" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      let analysis;

      // Extract from tool call
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        analysis = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } else {
        // Fallback: try parsing content
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: content, trend: "stable", insights: [], recommendations: [], confidence_score: 50, risk_level: "medium", trend_percentage: 0 };
      }

      // SERVER-SIDE CONFIDENCE CAP — epistemic integrity enforcement
      if (analysis.confidence_score != null) {
        const rawConfidence = analysis.confidence_score;
        analysis.confidence_score = capConfidence(rawConfidence, values.length);
        if (rawConfidence !== analysis.confidence_score) {
          analysis.confidence_capped = true;
          analysis.raw_confidence = rawConfidence;
          analysis.cap_reason = `Capped from ${rawConfidence} to ${analysis.confidence_score} (${values.length} data points)`;
        }
      }

      console.log(JSON.stringify({
        event: "ai_kpi_analysis",
        kpi_id,
        dataset_id,
        organization_id: kpi.organization_id,
        data_points: values.length,
        confidence_raw: analysis.raw_confidence ?? analysis.confidence_score,
        confidence_capped: analysis.confidence_score,
      }));

      return new Response(
        JSON.stringify({ success: true, analysis }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "AI analysis timed out (30s limit). Try again." }),
          { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw fetchErr;
    }
  } catch (e) {
    console.error("ai-kpi-analysis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
