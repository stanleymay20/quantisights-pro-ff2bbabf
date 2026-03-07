import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";
import { applyAIBoundary } from "../_shared/ai-redaction.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_LIMITS: Record<string, number> = {
  starter: 20,
  growth: 100,
  enterprise: 999999,
};

const SYSTEM_PROMPT = `You are Quantivis Executive Intelligence.
You advise C-Suite leaders using quantitative risk signals.
You reason like a board advisor.
You prioritize financial stability, operational resilience, and growth leverage.

RULES:
- Never hallucinate KPI data. Only reason using the supplied context.
- If data is missing, say "Insufficient data for this analysis."
- Never fabricate financial projections.
- Always mark projections as "estimated."
- Respond with clear, structured strategic advice.

EPISTEMIC INTEGRITY RULES (NON-NEGOTIABLE):
- Always state your confidence level (0-100) at the end of your response.
- Confidence CANNOT exceed 60% if you have fewer than 12 data points.
- Confidence CANNOT exceed 75% if you have fewer than 30 data points.
- Confidence CANNOT exceed 90% even with robust data.
- Always state the number of data points you are reasoning from.
- Distinguish between "data-supported" and "estimated" claims.

When the user asks about scenarios, simulations, or "what if" questions:
- Estimate directional KPI change based on the context provided.
- Estimate risk index shift.
- Provide a risk delta projection.
- Clearly label all projections as estimates.

For all responses, structure your thinking as:
1. Strategic assessment
2. Root cause hypothesis
3. Immediate actions (0–7 days)
4. Structural actions (30–90 days)
5. Risk if ignored
6. Confidence level (0–100) with data sufficiency rating`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit: 30 requests per minute per IP
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const rl = checkRateLimit(`copilot:${clientIp}`, 30, 60 * 1000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

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

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { message, session_id, role_type, organization_id } = await req.json();

    if (!message || !role_type || !organization_id) {
      return new Response(JSON.stringify({ error: "message, role_type, and organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify org membership
    const { data: isMember } = await serviceClient.rpc("is_org_member", {
      _user_id: user.id,
      _org_id: organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check subscription tier
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("tier")
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .maybeSingle();

    const tier = sub?.tier || "starter";
    const dailyLimit = TIER_LIMITS[tier] || 20;

    // Check usage
    const today = new Date().toISOString().split("T")[0];
    const { data: usage } = await serviceClient
      .from("copilot_usage")
      .select("call_count")
      .eq("organization_id", organization_id)
      .eq("date", today)
      .maybeSingle();

    const currentCount = usage?.call_count || 0;
    if (currentCount >= dailyLimit) {
      return new Response(
        JSON.stringify({ error: `Daily copilot limit reached (${dailyLimit} calls for ${tier} tier)` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment usage
    await serviceClient.rpc("increment_copilot_usage" as any, { _org_id: organization_id });

    // Get or create session
    let currentSessionId = session_id;
    if (!currentSessionId) {
      const { data: newSession, error: sessErr } = await serviceClient
        .from("copilot_sessions")
        .insert({ organization_id, user_id: user.id, role_type })
        .select("id")
        .single();
      if (sessErr) throw sessErr;
      currentSessionId = newSession.id;
    }

    // Store user message
    await serviceClient.from("copilot_messages").insert({
      session_id: currentSessionId,
      organization_id,
      role: "user",
      content: message,
    });

    // Fetch context data in parallel (including calibration model)
    const [riskResult, alertsResult, kpisResult, briefsResult, historyResult, calibrationResult] = await Promise.all([
      serviceClient
        .from("executive_risk_index")
        .select("score, components, last_updated, escalation_required, escalation_reason")
        .eq("organization_id", organization_id)
        .eq("role_type", role_type)
        .maybeSingle(),
      serviceClient
        .from("executive_alerts")
        .select("title, severity, trigger_value, threshold_value, metric_type, created_at")
        .eq("organization_id", organization_id)
        .eq("role_type", role_type)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10),
      serviceClient
        .from("kpi_values")
        .select("kpi_id, value, date, kpis(name, formula, description)")
        .eq("organization_id", organization_id)
        .order("date", { ascending: false })
        .limit(50),
      serviceClient
        .from("executive_briefs")
        .select("summary_json, risk_score, generated_at")
        .eq("organization_id", organization_id)
        .eq("role_type", role_type)
        .order("generated_at", { ascending: false })
        .limit(1),
      serviceClient
        .from("copilot_messages")
        .select("role, content")
        .eq("session_id", currentSessionId)
        .order("created_at", { ascending: true })
        .limit(20),
      serviceClient
        .from("calibration_models")
        .select("overall_calibration_score, overall_bias_direction, mean_absolute_error, band_corrections, model_version")
        .eq("organization_id", organization_id)
        .order("computed_at", { ascending: false })
        .limit(1),
    ]);

    // Build context
    const contextParts: string[] = [];

    if (riskResult.data) {
      const r = riskResult.data;
      contextParts.push(`CURRENT RISK INDEX: Score ${r.score}/100. Components: deviation=${(r.components as any)?.deviation}, trend=${(r.components as any)?.trend}, volatility=${(r.components as any)?.volatility}, forecast=${(r.components as any)?.forecast}. Escalation: ${r.escalation_required ? "REQUIRED - " + r.escalation_reason : "Not required"}.`);
    } else {
      contextParts.push("RISK INDEX: No risk data computed yet.");
    }

    if (alertsResult.data && alertsResult.data.length > 0) {
      const alertLines = alertsResult.data.map((a: any) =>
        `- [${a.severity.toUpperCase()}] ${a.title}: trigger=${a.trigger_value}, threshold=${a.threshold_value}, metric=${a.metric_type}`
      );
      contextParts.push(`ACTIVE ALERTS (${alertsResult.data.length}):\n${alertLines.join("\n")}`);
    } else {
      contextParts.push("ACTIVE ALERTS: None.");
    }

    if (kpisResult.data && kpisResult.data.length > 0) {
      const kpiMap: Record<string, { name: string; values: string[] }> = {};
      for (const kv of kpisResult.data as any[]) {
        const name = kv.kpis?.name || kv.kpi_id;
        if (!kpiMap[name]) kpiMap[name] = { name, values: [] };
        if (kpiMap[name].values.length < 5) {
          kpiMap[name].values.push(`${kv.date}: ${Number(kv.value).toFixed(2)}`);
        }
      }
      const kpiLines = Object.values(kpiMap).map(k => `${k.name}: ${k.values.join(", ")}`);
      contextParts.push(`KPI SIGNALS (recent values):\n${kpiLines.join("\n")}`);
    } else {
      contextParts.push("KPI SIGNALS: No KPI data available.");
    }

    if (briefsResult.data && briefsResult.data.length > 0) {
      const latest = briefsResult.data[0] as any;
      contextParts.push(`LATEST BRIEF (${latest.generated_at}): Risk score ${latest.risk_score}. Summary: ${JSON.stringify(latest.summary_json).slice(0, 500)}`);
    }

    // Adaptive Calibration context — standardized metadata for copilot reasoning
    if (calibrationResult.data && calibrationResult.data.length > 0) {
      const cal = calibrationResult.data[0] as any;
      contextParts.push(`ADAPTIVE CALIBRATION (v${cal.model_version}):
- Overall Score: ${cal.overall_calibration_score}/100
- Bias Direction: ${cal.overall_bias_direction}
- Mean Absolute Error: ${cal.mean_absolute_error}pp
- Band Corrections: ${JSON.stringify(cal.band_corrections)}
- adaptive_calibration_applied: true
- calibration_model_version: ${cal.model_version}
When stating confidence levels, apply these learned corrections. Every confidence you report must be corrected by these band adjustments.`);
    } else {
      contextParts.push(`ADAPTIVE CALIBRATION: No calibration model available. adaptive_calibration_applied: false`);
    }

    contextParts.push(`ROLE: ${role_type.toUpperCase()}`);
    contextParts.push(`DATE: ${new Date().toISOString().split("T")[0]}`);
    contextParts.push(`TIER: ${tier}`);

    // Fetch org AI boundary setting
    const { data: orgSettings } = await serviceClient
      .from("organizations")
      .select("ai_raw_text_enabled")
      .eq("id", organization_id)
      .maybeSingle();

    const aiRawTextEnabled = orgSettings?.ai_raw_text_enabled ?? false;

    // Apply redaction to context block
    const { text: safeContext } = applyAIBoundary(contextParts.join("\n\n"), aiRawTextEnabled);
    const { text: safeMessage } = applyAIBoundary(message, aiRawTextEnabled);

    // Build messages array from history
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n--- LIVE DATA CONTEXT ---\n" + safeContext },
    ];

    if (historyResult.data) {
      // Skip the last user message since we'll add it fresh
      const history = historyResult.data.slice(0, -1);
      for (const msg of history as any[]) {
        const { text: safeContent } = applyAIBoundary(msg.content, aiRawTextEnabled);
        aiMessages.push({ role: msg.role, content: safeContent });
      }
    }
    aiMessages.push({ role: "user", content: safeMessage });

    // Call Lovable AI with streaming
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We need to collect the full response to store it, while also streaming
    // Use a TransformStream to tee the response
    const reader = aiResponse.body!.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Pass through to client
            controller.enqueue(value);
            
            // Also collect content for storage
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullContent += content;
              } catch { /* partial chunk */ }
            }
          }
          controller.close();

          // Store assistant response after stream completes
          if (fullContent) {
            await serviceClient.from("copilot_messages").insert({
              session_id: currentSessionId,
              organization_id,
              role: "assistant",
              content: fullContent,
            });

            // Update session timestamp
            await serviceClient
              .from("copilot_sessions")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", currentSessionId);
          }
        } catch (e) {
          console.error("Stream error:", e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "X-Session-Id": currentSessionId,
      },
    });
  } catch (e) {
    console.error("executive-copilot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
