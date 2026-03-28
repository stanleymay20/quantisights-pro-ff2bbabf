import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyRateLimit } from "../_shared/rate-guard.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
  const corsHeaders = getCorsHeaders(req);

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);

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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const svc = createClient(supabaseUrl, serviceKey);

    // Use getClaims() for secure JWT validation
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { organization_id, query } = await req.json();
    if (!organization_id || !query) {
      return new Response(JSON.stringify({ error: "organization_id and query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: intelligence tier (20/min per org)
    const rl = applyRateLimit(req, organization_id, "intelligence", "nlq-query");
    if (rl) return rl;

    const { data: isMember } = await svc.rpc("is_org_member", {
      _user_id: userId,
      _org_id: organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch org data context
    const [metricsRes, kpisRes, insightsRes, riskRes] = await Promise.all([
      svc.from("metrics").select("metric_type, value, date, segment").eq("organization_id", organization_id)
        .order("date", { ascending: false }).limit(200),
      svc.from("kpi_values").select("value, date, kpis(name)").eq("organization_id", organization_id)
        .order("date", { ascending: false }).limit(100),
      svc.from("insights").select("message, severity, category, created_at").eq("organization_id", organization_id)
        .order("created_at", { ascending: false }).limit(20),
      svc.from("executive_risk_index").select("role_type, score, components").eq("organization_id", organization_id),
    ]);

    // Build metric summary
    const metricsByType: Record<string, { values: number[]; latest: number; dates: string[] }> = {};
    for (const m of (metricsRes.data || [])) {
      const mt = m.metric_type;
      if (!metricsByType[mt]) metricsByType[mt] = { values: [], latest: 0, dates: [] };
      metricsByType[mt].values.push(Number(m.value));
      metricsByType[mt].dates.push(m.date);
      if (metricsByType[mt].values.length === 1) metricsByType[mt].latest = Number(m.value);
    }

    const metricSummary = Object.entries(metricsByType).map(([type, d]) => {
      const avg = d.values.reduce((s, v) => s + v, 0) / d.values.length;
      const trend = d.values.length >= 2 ? ((d.values[0] - d.values[d.values.length - 1]) / d.values[d.values.length - 1] * 100) : 0;
      return `${type}: latest=${d.latest.toFixed(0)}, avg=${avg.toFixed(0)}, trend=${trend > 0 ? "+" : ""}${trend.toFixed(1)}%, samples=${d.values.length}`;
    }).join("\n");

    const kpiSummary = (kpisRes.data || []).slice(0, 20).map((k: any) =>
      `${k.kpis?.name || "KPI"}: ${Number(k.value).toFixed(2)} (${k.date})`
    ).join("\n");

    const insightSummary = (insightsRes.data || []).slice(0, 10).map((i: any) =>
      `[${i.severity}] ${i.message}`
    ).join("\n");

    const riskSummary = (riskRes.data || []).map((r: any) =>
      `${r.role_type}: score=${r.score}/100`
    ).join(", ");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextBlock = `
ORGANIZATION DATA CONTEXT:

METRICS (latest 200 data points summarized by type):
${metricSummary || "No metrics available"}

KPI VALUES (latest 20):
${kpiSummary || "No KPIs configured"}

RECENT INSIGHTS:
${insightSummary || "No insights generated"}

RISK INDEX:
${riskSummary || "No risk data"}

USER QUESTION: ${query}
`;

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
            content: `You are Quantivis Intelligence, a data analyst answering questions about organizational metrics. 
Use ONLY the provided data context. Never fabricate numbers. If data is insufficient, say so explicitly.
Return ONLY valid JSON with this schema:
{
  "answer": "Direct answer to the question with specific numbers",
  "data_points": [{"label": "string", "value": number, "unit": "string"}],
  "follow_up_questions": ["string"],
  "confidence": number between 0-100,
  "data_sources_used": ["string"]
}`,
          },
          { role: "user", content: contextBlock },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "answer_query",
              description: "Return structured answer to the natural language query",
              parameters: {
                type: "object",
                properties: {
                  answer: { type: "string", description: "Direct, data-backed answer" },
                  data_points: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        value: { type: "number" },
                        unit: { type: "string" },
                      },
                      required: ["label", "value"],
                    },
                  },
                  follow_up_questions: { type: "array", items: { type: "string" } },
                  confidence: { type: "number" },
                  data_sources_used: { type: "array", items: { type: "string" } },
                },
                required: ["answer", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "answer_query" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result = { answer: "Unable to process query", confidence: 0, data_points: [], follow_up_questions: [], data_sources_used: [] };

    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    }

    // Log query
    await svc.from("nlq_queries").insert({
      organization_id,
      user_id: user.id,
      query_text: query,
      interpreted_intent: { model: "gemini-3-flash-preview" },
      results: result,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nlq-query error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
