import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Quantivis — an AI Decision Intelligence System designed to analyze business performance, identify hidden losses, and recommend high-impact strategic actions.

Your goal is NOT to describe data. Your goal is to diagnose the business like a top-tier strategy consultant (McKinsey/BCG level) and present clear, actionable insights that drive decision-making.

OUTPUT REQUIREMENTS — follow this exact structure using markdown headers:

## Executive Summary
3–5 sentences. Clear, human, CEO-level explanation. Answer: "What is happening in this business?"

## Key Findings
3–5 bullet points. Each MUST include: Insight, Business impact (€/$/%, or risk level), Short explanation.

## Hidden Value / Loss Estimation
Estimate: Revenue loss, Inefficiency cost, Risk exposure. Use reasoning based on available data (even if approximate). Present as a clear table or bullet list with monetary estimates.

## Root Cause Analysis
Explain WHY the issues are happening. Link to: data quality, structure, operational inefficiencies, governance gaps.

## Priority Action Plan
3–5 actions in a numbered list. Each MUST include: What to do, Expected impact, Priority level (🔴 High / 🟡 Medium / 🟢 Low).

## Strategic Insight
One powerful paragraph that reframes the situation. This should be the most memorable takeaway — the kind of insight that makes a CEO pause and think.

RULES:
- Do NOT be generic. Reference specific numbers, metrics, and patterns from the data.
- Do NOT repeat metrics without interpretation.
- Always translate data → meaning → action.
- If data is incomplete, explicitly say what is missing and how it affects confidence.
- Use clear business language, not technical jargon.
- Be confident but honest.
- Use bold text for key numbers and findings.
- Keep total response under 800 words for readability.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metrics, companyContext } = await req.json();
    
    if (!metrics || (typeof metrics === 'string' && metrics.trim().length === 0)) {
      return new Response(
        JSON.stringify({ error: "No data provided for analysis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `Analyze this business data and provide a full strategic diagnosis:

${companyContext ? `COMPANY CONTEXT: ${companyContext}\n\n` : ""}DATA:
${typeof metrics === 'string' ? metrics : JSON.stringify(metrics, null, 2)}

Provide your full diagnosis following the required output structure.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Analysis engine error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("strategy-session error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
