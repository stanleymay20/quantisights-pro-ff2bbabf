import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_LIMITS: Record<string, number> = {
  starter: 0,
  growth: 10,
  enterprise: 999999,
};

// --- Configurable thresholds via env vars ---
function envFloat(key: string, fallback: number): number {
  const v = Deno.env.get(key);
  if (!v) return fallback;
  const p = parseFloat(v);
  return isFinite(p) ? p : fallback;
}
function envInt(key: string, fallback: number): number {
  const v = Deno.env.get(key);
  if (!v) return fallback;
  const p = parseInt(v, 10);
  return isFinite(p) ? p : fallback;
}

function getConvergenceConfig() {
  return {
    ceoVsCfoDivergence: envFloat("CONV_CEO_CFO_DIVERGENCE", 30),
    ceoVsCfoPenalty: envFloat("CONV_CEO_CFO_PENALTY", 15),
    cmoLowThreshold: envFloat("CONV_CMO_LOW_THRESHOLD", 40),
    cooHighThreshold: envFloat("CONV_COO_HIGH_THRESHOLD", 70),
    growthExecutionPenalty: envFloat("CONV_GROWTH_EXEC_PENALTY", 8),
    cfoHighThreshold: envFloat("CONV_CFO_HIGH_THRESHOLD", 75),
    ceoLowThreshold: envFloat("CONV_CEO_LOW_THRESHOLD", 50),
    cashExpansionPenalty: envFloat("CONV_CASH_EXP_PENALTY", 15),
    volatilityHighThreshold: envFloat("CONV_VOL_HIGH_THRESHOLD", 80),
    volatilityLowThreshold: envFloat("CONV_VOL_LOW_THRESHOLD", 40),
    operationalImbalancePenalty: envFloat("CONV_OP_IMBAL_PENALTY", 25),
    volatilityDivergenceThreshold: envFloat("CONV_VOL_DIV_THRESHOLD", 35),
    volatilityDivergencePenalty: envFloat("CONV_VOL_DIV_PENALTY", 10),
    alignedThreshold: envInt("CONV_ALIGNED_THRESHOLD", 80),
    tensionThreshold: envInt("CONV_TENSION_THRESHOLD", 60),
    misalignmentThreshold: envInt("CONV_MISALIGNMENT_THRESHOLD", 40),
  };
}

interface RiskComponents { deviation: number; trend: number; volatility: number; forecast: number; }
interface RoleRisk { role_type: string; score: number; components: RiskComponents; }
interface Conflict { rule_triggered: string; severity: string; role_1: string; role_2: string; description: string; }

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function computeConvergence(roles: RoleRisk[]): {
  score: number;
  dispersion: number;
  conflict_penalty: number;
  volatility_divergence: number;
  alignment_status: string;
  conflicts: Conflict[];
} {
  if (roles.length < 2) {
    return { score: 0, dispersion: 0, conflict_penalty: 0, volatility_divergence: 0, alignment_status: "aligned", conflicts: [] };
  }

  const cfg = getConvergenceConfig();
  const scores = roles.map(r => r.score);
  const dispersion = Math.round(stddev(scores) * 100) / 100;

  const conflicts: Conflict[] = [];
  let conflictPenalty = 0;

  const roleMap: Record<string, RoleRisk> = {};
  for (const r of roles) roleMap[r.role_type] = r;

  // Rule 1: CEO vs CFO divergence
  if (roleMap.ceo && roleMap.cfo && Math.abs(roleMap.ceo.score - roleMap.cfo.score) > cfg.ceoVsCfoDivergence) {
    conflicts.push({
      rule_triggered: "strategic_financial_divergence",
      severity: "high",
      role_1: "ceo",
      role_2: "cfo",
      description: `CEO risk (${roleMap.ceo.score}) and CFO risk (${roleMap.cfo.score}) diverge by ${Math.abs(roleMap.ceo.score - roleMap.cfo.score)} points — strategic vs financial misalignment`,
    });
    conflictPenalty += cfg.ceoVsCfoPenalty;
  }

  // Rule 2: CMO low risk + COO high risk
  if (roleMap.cmo && roleMap.coo && roleMap.cmo.score < cfg.cmoLowThreshold && roleMap.coo.score > cfg.cooHighThreshold) {
    conflicts.push({
      rule_triggered: "growth_execution_strain",
      severity: "medium",
      role_1: "cmo",
      role_2: "coo",
      description: `CMO sees low risk (${roleMap.cmo.score}) while COO faces elevated operational pressure (${roleMap.coo.score}) — growth vs execution strain`,
    });
    conflictPenalty += cfg.growthExecutionPenalty;
  }

  // Rule 3: CFO high risk + CEO low risk
  if (roleMap.cfo && roleMap.ceo && roleMap.cfo.score > cfg.cfoHighThreshold && roleMap.ceo.score < cfg.ceoLowThreshold) {
    conflicts.push({
      rule_triggered: "cash_expansion_mismatch",
      severity: "high",
      role_1: "cfo",
      role_2: "ceo",
      description: `CFO flags cash risk (${roleMap.cfo.score}) while CEO pursues expansion (${roleMap.ceo.score}) — cash protection vs expansion mismatch`,
    });
    conflictPenalty += cfg.cashExpansionPenalty;
  }

  // Rule 4: One role volatility high while others low
  for (const r of roles) {
    const vol = (r.components as any)?.volatility ?? 0;
    if (vol > cfg.volatilityHighThreshold) {
      const othersLow = roles.filter(o => o.role_type !== r.role_type).every(o => ((o.components as any)?.volatility ?? 0) < cfg.volatilityLowThreshold);
      if (othersLow) {
        conflicts.push({
          rule_triggered: "operational_imbalance",
          severity: "critical",
          role_1: r.role_type,
          role_2: "all_others",
          description: `${r.role_type.toUpperCase()} volatility (${vol}) vastly exceeds other roles — operational imbalance detected`,
        });
        conflictPenalty += cfg.operationalImbalancePenalty;
      }
    }
  }

  // Volatility divergence
  const volatilities = roles.map(r => (r.components as any)?.volatility ?? 0);
  const volMax = Math.max(...volatilities);
  const volMin = Math.min(...volatilities);
  let volatilityDivergence = 0;
  if (volMax - volMin > cfg.volatilityDivergenceThreshold) {
    volatilityDivergence = cfg.volatilityDivergencePenalty;
  }

  // Final score
  const rawScore = 100 - (dispersion + conflictPenalty + volatilityDivergence);
  const score = clamp(Math.round(rawScore), 0, 100);

  // Alignment status
  let alignmentStatus = "aligned";
  if (score >= cfg.alignedThreshold) alignmentStatus = "aligned";
  else if (score >= cfg.tensionThreshold) alignmentStatus = "tension";
  else if (score >= cfg.misalignmentThreshold) alignmentStatus = "misalignment";
  else alignmentStatus = "structural_conflict";

  return { score, dispersion, conflict_penalty: conflictPenalty, volatility_divergence: volatilityDivergence, alignment_status: alignmentStatus, conflicts };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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

    // Use getClaims() for secure JWT validation
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { organization_id, trigger } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: isMember } = await serviceClient.rpc("is_org_member", {
      _user_id: userId, _org_id: organization_id,
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
    const dailyLimit = TIER_LIMITS[tier] ?? 0;

    if (dailyLimit === 0) {
      return new Response(JSON.stringify({ error: "Convergence analysis requires Growth or Enterprise plan" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check usage (skip for auto triggers)
    if (trigger !== "auto") {
      const today = new Date().toISOString().split("T")[0];
      const { data: usage } = await serviceClient
        .from("convergence_usage").select("call_count")
        .eq("organization_id", organization_id).eq("date", today).maybeSingle();
      if ((usage?.call_count || 0) >= dailyLimit) {
        return new Response(
          JSON.stringify({ error: `Daily convergence limit reached (${dailyLimit} for ${tier} tier)` }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await serviceClient.rpc("increment_convergence_usage" as any, { _org_id: organization_id });
    }

    // Fetch all role risk indices
    const { data: riskRows } = await serviceClient
      .from("executive_risk_index")
      .select("role_type, score, components")
      .eq("organization_id", organization_id);

    const roles: RoleRisk[] = (riskRows || []).map((r: any) => ({
      role_type: r.role_type,
      score: r.score,
      components: r.components as RiskComponents,
    }));

    if (roles.length < 2) {
      return new Response(JSON.stringify({
        error: "insufficient_data",
        message: "At least 2 role risk indices required for convergence analysis",
        roles_found: roles.length,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute convergence
    const result = computeConvergence(roles);

    // Store convergence index
    await serviceClient.from("executive_convergence_index").insert({
      organization_id,
      score: result.score,
      dispersion: result.dispersion,
      conflict_penalty: result.conflict_penalty,
      volatility_divergence: result.volatility_divergence,
      alignment_status: result.alignment_status,
    });

    // Store conflicts (mark old ones as resolved first)
    await serviceClient.from("executive_conflicts")
      .update({ resolved_at: new Date().toISOString() })
      .eq("organization_id", organization_id)
      .is("resolved_at", null);

    for (const c of result.conflicts) {
      await serviceClient.from("executive_conflicts").insert({
        organization_id,
        ...c,
      });
    }

    // Audit log
    console.log(JSON.stringify({
      event: trigger === "auto" ? "convergence_auto_triggered" : "convergence_manual_triggered",
      organization_id,
      user_id: userId,
      score: result.score,
      alignment_status: result.alignment_status,
      conflicts_count: result.conflicts.length,
    }));

    // AI narrative (enterprise only) with AbortController timeout
    let aiNarrative: any = null;
    if (tier === "enterprise" && lovableApiKey) {
      const contextBlock = `
CONVERGENCE ANALYSIS:
- ECI Score: ${result.score}/100
- Alignment: ${result.alignment_status}
- Dispersion: ${result.dispersion}
- Conflict Penalty: ${result.conflict_penalty}
- Volatility Divergence: ${result.volatility_divergence}

ROLE RISK SCORES:
${roles.map(r => `${r.role_type.toUpperCase()}: ${r.score}/100 (dev=${r.components.deviation}, trend=${r.components.trend}, vol=${r.components.volatility}, forecast=${r.components.forecast})`).join("\n")}

ACTIVE CONFLICTS:
${result.conflicts.length > 0 ? result.conflicts.map(c => `[${c.severity.toUpperCase()}] ${c.description}`).join("\n") : "None"}
`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are a board-level governance advisor. Analyze executive convergence data. Return ONLY valid JSON:
{
  "board_alignment_summary": "2-3 paragraph summary",
  "root_cause_analysis": "key driver of any misalignment",
  "realignment_strategy": ["action1", "action2", "action3"],
  "governance_risk_if_ignored": "1-2 sentence risk statement"
}
No markdown. No hallucinated data. Reference only supplied metrics.`,
              },
              { role: "user", content: contextBlock },
            ],
            tools: [{
              type: "function",
              function: {
                name: "convergence_narrative",
                description: "Return structured board governance narrative",
                parameters: {
                  type: "object",
                  properties: {
                    board_alignment_summary: { type: "string" },
                    root_cause_analysis: { type: "string" },
                    realignment_strategy: { type: "array", items: { type: "string" } },
                    governance_risk_if_ignored: { type: "string" },
                  },
                  required: ["board_alignment_summary", "root_cause_analysis", "realignment_strategy", "governance_risk_if_ignored"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "convergence_narrative" } },
          }),
        });
        clearTimeout(timeout);
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            aiNarrative = JSON.parse(toolCall.function.arguments);
          }
        } else {
          await aiResp.text(); // consume body
        }
      } catch (aiErr) {
        clearTimeout(timeout);
        console.error("AI convergence narrative error:", aiErr);
      }
    }

    return new Response(JSON.stringify({
      convergence_score: result.score,
      alignment_status: result.alignment_status,
      dispersion: result.dispersion,
      conflict_penalty: result.conflict_penalty,
      volatility_divergence: result.volatility_divergence,
      conflicts: result.conflicts,
      role_risks: roles,
      ai_narrative: aiNarrative,
      computed_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("executive-convergence error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
