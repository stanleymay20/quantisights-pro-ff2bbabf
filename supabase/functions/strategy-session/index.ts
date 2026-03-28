import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
  const corsHeaders = getCorsHeaders(req);

const SYSTEM_PROMPT = `You are Quantivis — an AI Decision Intelligence System designed to analyze business performance, identify hidden losses, and recommend high-impact strategic actions.

Your goal is NOT to describe data. Your goal is to diagnose the business like a top-tier strategy consultant (McKinsey/BCG level) and present clear, actionable insights that drive decision-making.

OUTPUT REQUIREMENTS — follow this exact structure using markdown headers:

## Executive Summary
3–5 sentences. Clear, human, CEO-level explanation. Answer: "What is happening in this business?" Be specific — reference numbers and trends.

## Key Findings
3–5 bullet points. Each MUST include:
- **Insight**: What you found
- **Business impact**: Quantified (€/$/%, or risk level)
- **Explanation**: Why this matters in 1 sentence

## Hidden Value / Loss Estimation
Estimate with reasoning:
- Revenue at risk or lost
- Inefficiency cost (operational waste)
- Risk exposure (unmitigated downside)
Present as a clear table or bullet list with monetary estimates. If approximating, state the basis (e.g., "Based on 8% industry average applied to reported revenue").

## Root Cause Analysis
Explain WHY the issues are happening. Link to specific causes:
- Data quality gaps (missing fields, inconsistencies)
- Structural issues (team, process, technology)
- Operational inefficiencies (bottlenecks, waste)
- Governance gaps (no tracking, no accountability)

## Priority Action Plan
3–5 actions in a numbered list. Each MUST include ALL of:
- **Action**: Specific instruction (not vague — state exactly what to do)
- **Owner**: Who should execute (e.g., CFO, Head of Sales, COO)
- **Expected impact**: Quantified result (€/% improvement)
- **Timeline**: When results should appear (30/60/90 days)
- **Priority**: 🔴 High / 🟡 Medium / 🟢 Low

## Strategic Insight
One powerful paragraph that reframes the situation. This should be the most memorable takeaway — the kind of insight that makes a CEO pause and think. End with a forward-looking statement about what happens if action is taken vs. not.

## Methodology Note
One sentence explaining the analytical basis: "This analysis is based on [N] data points across [dimensions], using [statistical/heuristic] methods. Confidence level: [High/Medium/Low] based on data completeness."

RULES:
- Do NOT be generic. Reference specific numbers, metrics, and patterns from the data.
- Do NOT repeat metrics without interpretation.
- Always translate data → meaning → action → expected outcome.
- If data is incomplete, explicitly say what is missing and how it affects confidence.
- Use clear business language, not technical jargon.
- Be confident but honest — never fabricate numbers not derivable from the data.
- Use bold text for key numbers and findings.
- Every action must be specific enough that someone can execute it tomorrow.
- Keep total response under 900 words for readability.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);

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
