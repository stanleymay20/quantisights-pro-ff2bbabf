// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * Auto-Create Decisions from Advisory Instances
 * 
 * Book-aligned SUDAL Decision Engine:
 * 1. EWMA anomaly detection with Z-score quantification
 * 2. Externalized decision rules from DB (DaaS pattern)
 * 3. Shadow rule execution for A/B testing
 * 4. Full explanation metadata for transparency
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    ) as any;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { organization_id, dataset_id } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    ) as any;

    // ── Step 1: Fetch open advisories ──
    let advisoryQuery = serviceSupabase
      .from("advisory_instances")
      .select("id, title, action, category, priority, confidence, capped_confidence, raw_confidence, confidence_cap_reason, expected_impact, rationale, kpi_affected, dataset_id, advisory_type, source_evidence, data_quality_index, data_snapshot_date, variance_score")
      .eq("organization_id", organization_id)
      .eq("status", "open")
      .in("priority", ["critical", "high", "medium"])
      .order("priority", { ascending: true })
      .limit(20);

    if (dataset_id) {
      advisoryQuery = advisoryQuery.eq("dataset_id", dataset_id);
    }

    const { data: advisories, error: advError } = await advisoryQuery;
    if (advError) throw new Error(`Failed to fetch advisories: ${advError.message}`);
    if (!advisories || advisories.length === 0) {
      return new Response(JSON.stringify({ message: "No open advisories to convert", created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedup against existing decisions
    const advisoryIds = advisories.map(a => a.id);
    const { data: existingDecisions } = await serviceSupabase
      .from("decision_ledger")
      .select("advisory_instance_id")
      .eq("organization_id", organization_id)
      .in("advisory_instance_id", advisoryIds);

    const existingAdvisoryIds = new Set((existingDecisions ?? []).map(d => d.advisory_instance_id));
    const newAdvisories = advisories.filter(a => !existingAdvisoryIds.has(a.id));

    if (newAdvisories.length === 0) {
      return new Response(JSON.stringify({ message: "All advisories already have decisions", created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 2: EWMA anomaly quantification ──
    // For each advisory with a dataset, compute EWMA baseline and Z-score
    const datasetIds = [...new Set(newAdvisories.map(a => a.dataset_id).filter(Boolean))];
    const metricsCache: Record<string, number[]> = {};

    if (datasetIds.length > 0) {
      for (const dsId of datasetIds) {
        const { data: recentMetrics } = await serviceSupabase
          .from("metrics")
          .select("value, metric_type")
          .eq("organization_id", organization_id)
          .eq("dataset_id", dsId)
          .order("date", { ascending: true })
          .limit(200);

        if (recentMetrics) {
          // Group by metric_type
          for (const m of recentMetrics) {
            const key = `${dsId}:${m.metric_type}`;
            if (!metricsCache[key]) metricsCache[key] = [];
            metricsCache[key].push(Number(m.value));
          }
        }
      }
    }

    // Compute EWMA stats for each advisory
    const ewmaResults = new Map<string, EWMAResult>();
    for (const a of newAdvisories) {
      const primaryMetric = extractPrimaryMetric(a.kpi_affected);
      if (a.dataset_id && primaryMetric) {
        const key = `${a.dataset_id}:${primaryMetric}`;
        const values = metricsCache[key];
        if (values && values.length >= 10) {
          const result = computeEWMA(values, 0.2);
          ewmaResults.set(a.id, result);

          // Build canonical Insight Object (Book Ch.3)
          const insightObject = {
            insightID: a.id,
            timestampUTC: new Date().toISOString(),
            metricName: primaryMetric,
            currentValue: values[values.length - 1],
            expectedValue: result.ewmaBaseline,
            deviationMagnitude: result.deviationMagnitude,
            deviationScore: result.zScore,
            severityLevel: Math.abs(result.zScore) >= 3 ? "CRITICAL" : Math.abs(result.zScore) >= 2 ? "WARNING" : "INFO",
            detectionModel: result.detectionModel,
            modelParameters: result.modelParameters,
            labels: [a.category, a.priority].filter(Boolean),
          };

          // Update advisory with EWMA stats + Insight Object
          await serviceSupabase
            .from("advisory_instances")
            .update({
              deviation_score: result.deviationMagnitude,
              z_score: result.zScore,
              detection_model: result.detectionModel,
              model_parameters: result.modelParameters,
              ewma_baseline: result.ewmaBaseline,
              ewma_std: result.ewmaStd,
              insight_object: insightObject,
            })
            .eq("id", a.id);
        }
      }
    }

    // ── Step 3: Load externalized decision rules from DB ──
    const { data: activeRules } = await serviceSupabase
      .from("decision_rules")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    const productionRules = (activeRules ?? []).filter(r => !r.is_shadow);
    const shadowRules = (activeRules ?? []).filter(r => r.is_shadow);

    // ── Step 4: Build decisions using rule engine or fallback ──
    let datasetMap: Record<string, { name: string; row_count: number | null }> = {};
    if (datasetIds.length > 0) {
      const { data: datasets } = await serviceSupabase
        .from("datasets")
        .select("id, name, row_count")
        .in("id", datasetIds);
      if (datasets) {
        datasetMap = Object.fromEntries(datasets.map(d => [d.id, { name: d.name, row_count: d.row_count }]));
      }
    }

    const decisionRows = [];
    const shadowLogRows = [];

    for (const a of newAdvisories) {
      const dsInfo = a.dataset_id ? datasetMap[a.dataset_id] : null;
      const ewma = ewmaResults.get(a.id);
      const logicType = detectLogicType(a.advisory_type, a.title, a.action);

      // Try production rules first
      const matchedRule = evaluateRules(productionRules, a);
      const ruleAction = matchedRule?.actions ?? {};

      // Build explanation metadata with EWMA quantification
      const explanationMetadata = buildExplanationMetadata(a, dsInfo, logicType, ewma, matchedRule);

      decisionRows.push({
        organization_id,
        advisory_instance_id: a.id,
        decision_type: ruleAction.decision_type ?? a.category ?? "strategic",
        recommended_action: ruleAction.recommended_action ?? `${a.title}: ${a.action}`,
        decision_status: "pending",
        execution_status: "not_started",
        raw_confidence: a.raw_confidence,
        capped_confidence: a.capped_confidence,
        confidence_at_decision: a.enriched_confidence ?? a.capped_confidence ?? a.confidence,
        confidence_cap_reason: a.confidence_cap_reason,
        predicted_net_impact: parseImpactEstimate(ruleAction.expected_impact ?? a.expected_impact),
        notes: a.rationale,
        decision_origin: "ai_generated",
        source_insight_summary: a.title,
        recommendation_logic_type: matchedRule ? `rule:${matchedRule.name}` : logicType,
        explanation_metadata: explanationMetadata,
        evidence_sources: Array.isArray(a.evidence_sources) ? a.evidence_sources : [],
      });

      // ── Step 5: Shadow rule execution ──
      for (const shadowRule of shadowRules) {
        const shadowMatch = evaluateRules([shadowRule], a);
        if (shadowMatch) {
          shadowLogRows.push({
            organization_id,
            rule_id: shadowRule.id,
            rule_version: shadowRule.version,
            advisory_instance_id: a.id,
            shadow_decision: {
              would_create: true,
              decision_type: shadowMatch.actions.decision_type ?? a.category,
              recommended_action: shadowMatch.actions.recommended_action ?? a.action,
              confidence: a.capped_confidence ?? a.confidence,
            },
            would_have_created: true,
            discrepancy_detected: matchedRule
              ? (shadowMatch.actions.recommended_action !== (matchedRule.actions?.recommended_action ?? a.action))
              : true,
          });
        }
      }
    }

    // Insert decisions
    const { data: createdDecisions, error: insertError } = await serviceSupabase
      .from("decision_ledger")
      .insert(decisionRows)
      .select("id");

    if (insertError) throw new Error(`Failed to create decisions: ${insertError.message}`);

    // Insert shadow logs
    if (shadowLogRows.length > 0) {
      // Link production decision IDs to shadow logs
      const linkedShadowLogs = shadowLogRows.map((sl, i) => ({
        ...sl,
        production_decision_id: createdDecisions?.[i]?.id ?? null,
      }));
      await serviceSupabase.from("decision_shadow_log").insert(linkedShadowLogs);
    }

    // ── Email notifications (unchanged) ──
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@quantivis.com";
    let emailsSent = 0;

    if (resendKey && createdDecisions && createdDecisions.length > 0) {
      emailsSent = await sendNotificationEmails(
        serviceSupabase, organization_id, newAdvisories, createdDecisions.length, fromEmail, resendKey
      );
    }

    // Audit log
    await serviceSupabase.from("audit_log").insert({
      organization_id,
      actor_id: user.id,
      actor_type: "system",
      action_type: "auto_decisions_created",
      resource_type: "decision_ledger",
      payload: {
        count: createdDecisions?.length ?? 0,
        emails_sent: emailsSent,
        shadow_rules_evaluated: shadowRules.length,
        shadow_discrepancies: shadowLogRows.filter(s => s.discrepancy_detected).length,
        ewma_quantified: ewmaResults.size,
        production_rules_used: productionRules.length,
        source: "auto_create_decisions_v2",
      },
    });

    return new Response(JSON.stringify({
      created: createdDecisions?.length ?? 0,
      emails_sent: emailsSent,
      ewma_quantified: ewmaResults.size,
      shadow_comparisons: shadowLogRows.length,
      decisions: createdDecisions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("auto-create-decisions error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

/* ──────────────────────────────────────────────────────────────
   EWMA Anomaly Detection Engine (Book Ch.3: EWMA + Z-Score)
   ────────────────────────────────────────────────────────────── */

interface EWMAResult {
  ewmaBaseline: number;
  ewmaStd: number;
  zScore: number;
  deviationMagnitude: number;
  isAnomaly: boolean;
  detectionModel: string;
  modelParameters: Record<string, number>;
}

function computeEWMA(values: number[], alpha: number = 0.2, kSigma: number = 3.0): EWMAResult {
  const n = values.length;
  if (n < 2) {
    return {
      ewmaBaseline: values[0] ?? 0, ewmaStd: 0, zScore: 0,
      deviationMagnitude: 0, isAnomaly: false,
      detectionModel: "ewma_insufficient_data",
      modelParameters: { alpha, k_sigma: kSigma, data_points: n },
    };
  }

  // Compute EWMA recursively
  let ewma = values[0];
  let ewmVar = 0; // Exponentially weighted variance

  for (let i = 1; i < n; i++) {
    const diff = values[i] - ewma;
    ewma = alpha * values[i] + (1 - alpha) * ewma;
    ewmVar = (1 - alpha) * (ewmVar + alpha * diff * diff);
  }

  const ewmStd = Math.sqrt(ewmVar);
  const latestValue = values[n - 1];
  const zScore = ewmStd > 0 ? (latestValue - ewma) / ewmStd : 0;
  const isAnomaly = Math.abs(zScore) >= kSigma;

  return {
    ewmaBaseline: ewma,
    ewmaStd: ewmStd,
    zScore,
    deviationMagnitude: latestValue - ewma,
    isAnomaly,
    detectionModel: isAnomaly ? "ewma_anomaly_detected" : "ewma_within_bounds",
    modelParameters: { alpha, k_sigma: kSigma, data_points: n },
  };
}

/* ──────────────────────────────────────────────────────────────
   Externalized Rule Engine (Book Ch.4: DaaS / Fact-Rule-Action)
   ────────────────────────────────────────────────────────────── */

interface DecisionRule {
  id: string;
  name: string;
  version: number;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  is_shadow: boolean;
  priority: number;
}

function evaluateRules(
  rules: DecisionRule[],
  advisory: Record<string, unknown>
): DecisionRule | null {
  for (const rule of rules) {
    if (matchConditions(rule.conditions, advisory)) {
      return rule;
    }
  }
  return null;
}

function matchConditions(conditions: Record<string, unknown>, facts: Record<string, unknown>): boolean {
  for (const [key, condition] of Object.entries(conditions)) {
    const factValue = facts[key];
    if (typeof condition === "object" && condition !== null) {
      const cond = condition as Record<string, unknown>;
      if ("eq" in cond && factValue !== cond.eq) return false;
      if ("in" in cond && Array.isArray(cond.in) && !cond.in.includes(factValue)) return false;
      if ("gt" in cond && (typeof factValue !== "number" || factValue <= (cond.gt as number))) return false;
      if ("gte" in cond && (typeof factValue !== "number" || factValue < (cond.gte as number))) return false;
      if ("lt" in cond && (typeof factValue !== "number" || factValue >= (cond.lt as number))) return false;
      if ("contains" in cond && typeof factValue === "string" && !factValue.toLowerCase().includes((cond.contains as string).toLowerCase())) return false;
    } else {
      if (factValue !== condition) return false;
    }
  }
  return true;
}

/* ──────────────────────────────────────────────────────────────
   Explanation Builder
   ────────────────────────────────────────────────────────────── */

function buildExplanationMetadata(
  a: Record<string, unknown>,
  dsInfo: { name: string; row_count: number | null } | null,
  logicType: string,
  ewma: EWMAResult | undefined,
  matchedRule: DecisionRule | null,
) {
  return {
    source_data: {
      dataset_name: dsInfo?.name ?? "Unknown dataset",
      dataset_id: a.dataset_id,
      time_range: a.data_snapshot_date
        ? `Up to ${a.data_snapshot_date}`
        : "Latest available data",
      rows_analyzed: dsInfo?.row_count ?? null,
      key_metrics: extractKeyMetrics(a.kpi_affected),
    },
    statistical_basis: ewma ? {
      method: "EWMA + Dynamic σ Envelope",
      ewma_baseline: Number(ewma.ewmaBaseline.toFixed(4)),
      ewma_std: Number(ewma.ewmaStd.toFixed(4)),
      z_score: Number(ewma.zScore.toFixed(2)),
      deviation_magnitude: Number(ewma.deviationMagnitude.toFixed(4)),
      is_anomaly: ewma.isAnomaly,
      alpha: ewma.modelParameters.alpha,
      k_sigma: ewma.modelParameters.k_sigma,
      data_points_used: ewma.modelParameters.data_points,
    } : {
      method: "threshold_only",
      note: "Insufficient metric history for EWMA computation (requires ≥10 data points)",
    },
    triggering_insight: {
      pattern_type: logicType,
      description: a.title as string,
      metric_name: extractPrimaryMetric(a.kpi_affected),
      change_value: extractChangeValue(a.title as string, a.action as string),
      change_direction: detectDirection(a.title as string, a.action as string),
    },
    reasoning: {
      what_happened: a.title as string,
      why_it_matters: buildWhyItMatters(a as { priority: string; expected_impact: string | null; category: string }),
      why_this_recommendation: (a.rationale ?? a.action) as string,
    },
    recommendation_logic: {
      method: matchedRule ? "externalized_rule_engine" : logicType,
      rule_name: matchedRule?.name ?? null,
      rule_version: matchedRule?.version ?? null,
      description: matchedRule
        ? `Matched rule "${matchedRule.name}" v${matchedRule.version} (priority: ${matchedRule.priority})`
        : describeLogic(logicType),
    },
    expected_impact: {
      range: a.expected_impact ?? null,
      basis: a.source_evidence
        ? "Based on historical data patterns and statistical analysis"
        : "Based on detected trend analysis",
    },
    confidence_explanation: {
      score: (a.capped_confidence ?? a.confidence) as number | null,
      meaning: describeConfidence((a.capped_confidence ?? a.confidence) as number | null),
      capped: a.raw_confidence != null && a.capped_confidence != null && a.raw_confidence !== a.capped_confidence,
      cap_reason: a.confidence_cap_reason,
    },
    assumptions: buildAssumptions(a as { data_quality_index: number | null; data_snapshot_date: string | null }),
    limitations: buildLimitations(a as { data_quality_index: number | null; variance_score: number | null }),
    evidence_classification: classifyEvidence(ewma, matchedRule),
    // Dual-layer enrichment (Layer A + Layer B → Layer C synthesis)
    dual_layer_enrichment: a.decision_enrichment_id ? {
      enrichment_id: a.decision_enrichment_id,
      client_evidence_summary: a.client_evidence_summary ?? null,
      internal_context_summary: a.internal_context_summary ?? null,
      combined_interpretation: a.combined_interpretation ?? null,
      client_confidence: a.client_confidence ?? null,
      enriched_confidence: a.enriched_confidence ?? null,
      confidence_delta: a.confidence_delta ?? null,
      blending_rule: a.blending_rule ?? "no_context",
    } : null,
  };
}

function classifyEvidence(ewma: EWMAResult | undefined, rule: DecisionRule | null): string {
  if (ewma?.isAnomaly && rule) return "OBSERVED_FACT + RULE_BASED_ACTION";
  if (ewma?.isAnomaly) return "STATISTICAL_INFERENCE";
  if (rule) return "RULE_BASED_ACTION";
  return "HEURISTIC_ESTIMATE";
}

/* ──────────────────────────────────────────────────────────────
   Email Notification (extracted for clarity)
   ────────────────────────────────────────────────────────────── */

async function sendNotificationEmails(
  serviceSupabase: ReturnType<typeof createClient>,
  organization_id: string,
  newAdvisories: Record<string, unknown>[],
  decisionCount: number,
  fromEmail: string,
  resendKey: string,
): Promise<number> {
  let emailsSent = 0;

  const { data: members } = await serviceSupabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organization_id)
    .in("role", ["owner", "admin", "executive"]);

  if (!members?.length) return 0;

  const { data: orgData } = await serviceSupabase
    .from("organizations")
    .select("name")
    .eq("id", organization_id)
    .single();

  const criticalCount = newAdvisories.filter(a => a.priority === "critical").length;
  const summaryItems = newAdvisories.slice(0, 5).map(a =>
    `<li style="margin-bottom: 8px; color: #e2e8f0;">
      <strong style="color: ${a.priority === 'critical' ? '#ef4444' : a.priority === 'high' ? '#f59e0b' : '#94a3b8'};">
        [${(a.priority as string).toUpperCase()}]
      </strong> ${a.title}
    </li>`
  ).join("");

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #0f172a; color: #e2e8f0;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #38bdf8; font-size: 20px; margin: 0;">Quantivis</h1>
      </div>
      <div style="background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155;">
        <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">
          ${decisionCount} New Decision${decisionCount > 1 ? 's' : ''} Need${decisionCount === 1 ? 's' : ''} Your Review
        </h2>
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 20px;">
          ${orgData?.name || 'Your organization'} · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        ${criticalCount > 0 ? `<div style="background: #7f1d1d; border-radius: 8px; padding: 12px; margin-bottom: 16px; border: 1px solid #991b1b;">
          <p style="color: #fca5a5; font-size: 13px; margin: 0; font-weight: 600;">⚠️ ${criticalCount} critical decision${criticalCount > 1 ? 's' : ''} requiring immediate attention</p>
        </div>` : ''}
        <ul style="padding-left: 20px; margin: 0 0 24px;">${summaryItems}</ul>
        ${newAdvisories.length > 5 ? `<p style="color: #64748b; font-size: 13px;">...and ${newAdvisories.length - 5} more</p>` : ''}
        <a href="https://quantisights-pro.lovable.app/decisions" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Review Decisions →
        </a>
      </div>
      <p style="color: #475569; font-size: 12px; text-align: center; margin-top: 24px;">
        You're receiving this because you're an admin of ${orgData?.name || 'this organization'} on Quantivis.
      </p>
    </div>
  `;

  for (const member of members) {
    try {
      const { data: authUser } = await serviceSupabase.auth.admin.getUserById(member.user_id);
      if (authUser?.user?.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [authUser.user.email],
            subject: `${criticalCount > 0 ? '🔴 ' : ''}${decisionCount} decision${decisionCount > 1 ? 's' : ''} need${decisionCount === 1 ? 's' : ''} your review — ${orgData?.name || 'Quantivis'}`,
            html: emailHtml,
          }),
        });
        emailsSent++;
      }
    } catch (emailErr) {
      console.error(`Failed to send email to member ${member.user_id}:`, emailErr);
    }
  }

  return emailsSent;
}

/* ──────────────────────────────────────────────────────────────
   Helper Functions
   ────────────────────────────────────────────────────────────── */

function parseImpactEstimate(impact: string | null): number | null {
  if (!impact) return null;
  const match = String(impact).match(/([+-]?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function detectLogicType(advisoryType: string | null, title: string, action: string): string {
  const combined = `${title} ${action} ${advisoryType ?? ""}`.toLowerCase();
  if (combined.includes("trend") || combined.includes("declining") || combined.includes("increasing")) return "trend_detection";
  if (combined.includes("threshold") || combined.includes("breach") || combined.includes("exceeded")) return "threshold_breach";
  if (combined.includes("forecast") || combined.includes("deviation") || combined.includes("projected")) return "forecast_deviation";
  if (combined.includes("anomal") || combined.includes("unusual") || combined.includes("spike")) return "anomaly_detection";
  if (combined.includes("correlat") || combined.includes("relationship")) return "correlation_analysis";
  return "statistical_inference";
}

function describeLogic(logicType: string): string {
  const descriptions: Record<string, string> = {
    trend_detection: "Sustained directional change detected across ≥3 periods",
    threshold_breach: "Metric crossed predefined performance boundary",
    forecast_deviation: "Actual values diverged >2σ from forecast model",
    anomaly_detection: "Value outside historical ±2σ range (EWMA envelope)",
    correlation_analysis: "Statistically significant inter-metric relationship (p<0.05)",
    statistical_inference: "Pattern detected via statistical significance test",
  };
  return descriptions[logicType] ?? "Rule-based pattern detection";
}

function describeConfidence(score: number | null): string {
  if (score == null) return "No score available";
  if (score >= 85) return `${score}% — Strong signal: ≥30 data points, low variance, consistent trend`;
  if (score >= 70) return `${score}% — Moderate signal: sufficient data, some variance`;
  if (score >= 50) return `${score}% — Weak signal: <30 data points or high variance`;
  return `${score}% — Insufficient data for reliable inference`;
}

function extractKeyMetrics(kpiAffected: unknown): string[] {
  if (!kpiAffected) return [];
  if (Array.isArray(kpiAffected)) return kpiAffected.map(String).slice(0, 5);
  if (typeof kpiAffected === "object") return Object.keys(kpiAffected as Record<string, unknown>).slice(0, 5);
  return [String(kpiAffected)];
}

function extractPrimaryMetric(kpiAffected: unknown): string | null {
  const metrics = extractKeyMetrics(kpiAffected);
  return metrics.length > 0 ? metrics[0] : null;
}

function extractChangeValue(title: string, action: string): string | null {
  const match = (title + " " + action).match(/(\d+(?:\.\d+)?%)/);
  return match ? match[1] : null;
}

function detectDirection(title: string, action: string): string | null {
  const combined = `${title} ${action}`.toLowerCase();
  if (combined.includes("drop") || combined.includes("declin") || combined.includes("decrease") || combined.includes("fell")) return "decrease";
  if (combined.includes("increase") || combined.includes("grew") || combined.includes("rise") || combined.includes("spike")) return "increase";
  return null;
}

function buildWhyItMatters(a: { priority: string; expected_impact: string | null; category: string }): string {
  const parts: string[] = [];
  if (a.priority === "critical") parts.push("Critical priority");
  else if (a.priority === "high") parts.push("High priority");
  else parts.push("Medium priority");
  parts.push(`Category: ${a.category}`);
  if (a.expected_impact) parts.push(`Impact: ${a.expected_impact}`);
  return parts.join(" · ");
}

function buildAssumptions(a: { data_quality_index: number | null; data_snapshot_date: string | null }): string[] {
  const assumptions: string[] = [];
  if (a.data_snapshot_date) {
    assumptions.push(`Data snapshot: ${a.data_snapshot_date}`);
  }
  if (a.data_quality_index != null) {
    assumptions.push(`Data quality index: ${(a.data_quality_index * 100).toFixed(0)}%`);
  }
  assumptions.push("Assumes stable business conditions over evaluation window");
  return assumptions;
}

function buildLimitations(a: { data_quality_index: number | null; variance_score: number | null }): string[] {
  const limitations: string[] = [];
  if (a.data_quality_index != null && a.data_quality_index < 0.7) {
    limitations.push(`Data quality ${(a.data_quality_index * 100).toFixed(0)}% — below 70% threshold`);
  }
  if (a.variance_score != null && a.variance_score > 0.5) {
    limitations.push(`Variance score ${(a.variance_score * 100).toFixed(0)}% — high uncertainty`);
  }
  limitations.push("Probabilistic estimate, not financial advice");
  return limitations;
}
