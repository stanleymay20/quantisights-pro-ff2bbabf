import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { applyAdaptiveConfidenceWithFetch } from "../_shared/adaptive-confidence.ts";
import type { AdaptiveConfidenceMeta } from "../_shared/adaptive-confidence.ts";
import { enforceDatasetContract } from "../_shared/dataset-contract.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

interface MetricRow {
  metric_type: string;
  value: number;
  date: string;
  region: string | null;
  segment: string | null;
}

interface MetricStats {
  metric_type: string;
  data_points: number;
  latest_value: number;
  previous_value: number;
  period_change_pct: number;
  mean: number;
  std_dev: number;
  volatility_pct: number;
  slope_normalized_pct: number;
  trend_direction: string;
  min: number;
  max: number;
  date_range: string;
  segment_shifts: string[];
}

interface DiagnosticResult {
  metric_type: string;
  diagnosis: string;
  severity: "critical" | "warning" | "info";
  root_cause: string;
  causal_factors: string[];
  trend_direction: "improving" | "declining" | "stable" | "volatile";
  change_pct: number;
  recommendation: string;
  confidence: number;
  raw_confidence: number;
  capped_confidence: number;
  confidence_cap_reason: string;
  sample_size: number;
  data_sufficiency: string;
  variance_score: number | null;
  adaptive_calibration_applied: boolean;
  calibration_model_version: number | null;
  calibration_band_used: string | null;
  calibration_correction_applied_pp: number | null;
  calibration_low_sample_band: boolean;
  confidence_source: string;
}

function applyMeta(meta: AdaptiveConfidenceMeta): Pick<DiagnosticResult,
  "confidence" | "raw_confidence" | "capped_confidence" | "confidence_cap_reason" |
  "sample_size" | "data_sufficiency" | "variance_score" | "adaptive_calibration_applied" |
  "calibration_model_version" | "calibration_band_used" | "calibration_correction_applied_pp" |
  "calibration_low_sample_band" | "confidence_source"
> {
  return {
    confidence: meta.confidence,
    raw_confidence: meta.raw_confidence,
    capped_confidence: meta.capped_confidence,
    confidence_cap_reason: meta.confidence_cap_reason,
    sample_size: meta.sample_size,
    data_sufficiency: meta.data_sufficiency,
    variance_score: meta.variance_score,
    adaptive_calibration_applied: meta.adaptive_calibration_applied,
    calibration_model_version: meta.calibration_model_version,
    calibration_band_used: meta.calibration_band_used,
    calibration_correction_applied_pp: meta.calibration_correction_applied_pp,
    calibration_low_sample_band: meta.calibration_low_sample_band,
    confidence_source: meta.confidence_source,
  };
}

/** Compute pure statistics for each metric type — no hardcoded interpretations. */
function computeStats(metrics: MetricRow[]): { stats: MetricStats[]; skippedMetrics: string[] } {
  const grouped: Record<string, MetricRow[]> = {};
  for (const m of metrics) {
    if (!grouped[m.metric_type]) grouped[m.metric_type] = [];
    grouped[m.metric_type].push(m);
  }

  const results: MetricStats[] = [];
  const skippedMetrics: string[] = [];

  for (const [type, rows] of Object.entries(grouped)) {
    if (rows.length < 2) {
      skippedMetrics.push(type);
      continue;
    }

    const sorted = rows.sort((a, b) => a.date.localeCompare(b.date));
    const values = sorted.map(r => Number(r.value));
    const n = values.length;
    const latest = values[n - 1];
    const previous = values[n - 2];
    const changePct = previous !== 0 ? ((latest - previous) / Math.abs(previous)) * 100 : 0;

    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const volatility = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

    // Linear regression slope
    const xMean = (n - 1) / 2;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - mean);
      den += (i - xMean) ** 2;
    }
    const slope = den !== 0 ? num / den : 0;
    const slopeNorm = mean !== 0 ? (slope / Math.abs(mean)) * 100 : 0;

    let trend_direction = "stable";
    if (volatility > 30) trend_direction = "volatile";
    else if (slopeNorm > 5) trend_direction = "improving";
    else if (slopeNorm < -5) trend_direction = "declining";

    // Segment breakdown
    const segmentBreakdown: Record<string, number[]> = {};
    for (const r of sorted) {
      const seg = r.segment || r.region || "overall";
      if (!segmentBreakdown[seg]) segmentBreakdown[seg] = [];
      segmentBreakdown[seg].push(Number(r.value));
    }
    const segmentShifts: string[] = [];
    for (const [seg, vals] of Object.entries(segmentBreakdown)) {
      if (vals.length < 2 || seg === "overall") continue;
      const segChange = vals[vals.length - 1] - vals[0];
      const segChangePct = vals[0] !== 0 ? (segChange / Math.abs(vals[0])) * 100 : 0;
      if (Math.abs(segChangePct) > 10) {
        segmentShifts.push(`${seg}: ${segChangePct > 0 ? "+" : ""}${segChangePct.toFixed(1)}%`);
      }
    }

    results.push({
      metric_type: type,
      data_points: n,
      latest_value: Number(latest.toFixed(4)),
      previous_value: Number(previous.toFixed(4)),
      period_change_pct: Number(changePct.toFixed(2)),
      mean: Number(mean.toFixed(4)),
      std_dev: Number(stdDev.toFixed(4)),
      volatility_pct: Number(volatility.toFixed(2)),
      slope_normalized_pct: Number(slopeNorm.toFixed(2)),
      trend_direction,
      min: Number(values.reduce((a, b) => a < b ? a : b, values[0]).toFixed(4)),
      max: Number(values.reduce((a, b) => a > b ? a : b, values[0]).toFixed(4)),
      date_range: `${sorted[0].date} to ${sorted[n - 1].date}`,
      segment_shifts: segmentShifts,
    });
  }

  return { stats: results, skippedMetrics };
}

/**
 * Paginated fetch: retrieves ALL metric rows for the dataset, not just the first 1000.
 */
async function fetchAllMetrics(
  supabaseUrl: string,
  serviceKey: string,
  organizationId: string,
  datasetId: string,
): Promise<MetricRow[]> {
  const PAGE_SIZE = 1000;
  const all: MetricRow[] = [];
  let offset = 0;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  while (true) {
    const url = `${supabaseUrl}/rest/v1/metrics?organization_id=eq.${organizationId}&dataset_id=eq.${datasetId}&order=date.asc&limit=${PAGE_SIZE}&offset=${offset}`;
    const resp = await fetch(url, { headers });
    const page: MetricRow[] = await resp.json();
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

/** Use AI to generate real diagnostic intelligence from computed statistics. */
async function generateAIDiagnostics(stats: MetricStats[], contextBlock: string = "", datasetName: string = "dataset"): Promise<any[]> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey || stats.length === 0) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: `You are an enterprise diagnostic intelligence engine performing root cause analysis on metrics from the dataset "${datasetName}".
${contextBlock}
METRIC STATISTICS (computed from real data):
${JSON.stringify(stats, null, 2)}

For EACH metric, generate a diagnostic assessment. Return ONLY a JSON array:
[
  {
    "metric_type": "exact metric_type from input",
    "diagnosis": "1-2 sentence clinical diagnosis referencing specific values and percentages from the statistics",
    "severity": "critical" | "warning" | "info",
    "root_cause": "2-3 sentence root cause analysis explaining WHY this pattern exists, referencing volatility, trend slope, and segment shifts",
    "causal_factors": ["factor1", "factor2", "factor3"],
    "trend_direction": "improving" | "declining" | "stable" | "volatile",
    "change_pct": <number from period_change_pct>,
    "recommendation": "1-2 sentence actionable recommendation for decision-makers to address the diagnosed pattern",
    "raw_confidence": <60-90 based on data quality>
  }
]

Rules:
- Be domain-agnostic. These metrics could be economic, financial, SaaS, industrial, or any domain.
- Reference ACTUAL values, percentages, and data point counts from the statistics.
- severity "critical": |period_change_pct| > 10% OR volatility > 40% OR clear structural instability (applies to both spikes AND drops)
- severity "warning": |period_change_pct| between 5-10%, emerging instability, threshold approaches
- severity "info": stable metrics with |period_change_pct| < 5% and volatility < 25%
- causal_factors MUST reference specific statistical evidence (segment shifts, volatility levels, trend slopes)
- recommendation MUST be concrete and actionable, referencing the specific metric and its diagnosed issue
- raw_confidence should reflect data_points count: <12 pts = max 60, <30 pts = max 75, 30+ pts = max 90 (aligned with platform epistemic standard)
- Do NOT invent data not present in the statistics
- Every diagnosis MUST reference the dataset name "${datasetName}" and specific metric values
- Return ONLY the JSON array`,
        }],
      }),
    });

    clearTimeout(timeout);

    if (!resp.ok) return [];

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    try {
      return JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("AI returned malformed JSON, falling back to rule engine:", parseErr);
      return [];
    }
  } catch (e) {
    clearTimeout(timeout);
    console.error("AI diagnostic generation error:", e);
    return [];
  }
}

/** Rule-based fallback when AI is unavailable — still data-driven, not hardcoded per metric. */
function fallbackDiagnostics(stats: MetricStats[]): any[] {
  return stats.map(s => {
    let severity: "critical" | "warning" | "info" = "info";
    if (Math.abs(s.period_change_pct) > 10 || s.volatility_pct > 40) severity = "critical";
    else if (Math.abs(s.period_change_pct) > 5 || s.volatility_pct > 25) severity = "warning";

    const factors = [
      `${s.trend_direction} trend over ${s.data_points} data points`,
      ...(s.volatility_pct > 20 ? [`${s.volatility_pct.toFixed(0)}% coefficient of variation`] : []),
      ...s.segment_shifts.slice(0, 3),
    ];

    let recommendation = "";
    if (severity === "critical") {
      recommendation = `Investigate ${s.metric_type.replace(/_/g, " ")} immediately: ${Math.abs(s.period_change_pct).toFixed(1)}% period change with ${s.volatility_pct.toFixed(0)}% volatility indicates structural instability requiring root cause intervention.`;
    } else if (severity === "warning") {
      recommendation = `Monitor ${s.metric_type.replace(/_/g, " ")} closely and prepare contingency plans. The ${s.trend_direction} trend at ${s.slope_normalized_pct.toFixed(1)}% normalized slope may accelerate.`;
    } else {
      recommendation = `${s.metric_type.replace(/_/g, " ")} is within normal parameters. Continue current approach and review at next reporting cycle.`;
    }

    return {
      metric_type: s.metric_type,
      diagnosis: `${s.metric_type.replace(/_/g, " ")} changed ${s.period_change_pct > 0 ? "+" : ""}${s.period_change_pct.toFixed(1)}% (latest: ${s.latest_value}, mean: ${s.mean.toFixed(2)}). Trend is ${s.trend_direction} with ${s.volatility_pct.toFixed(0)}% volatility across ${s.data_points} observations.`,
      severity,
      root_cause: `Regression analysis shows a normalized slope of ${s.slope_normalized_pct.toFixed(1)}% with ${s.volatility_pct.toFixed(0)}% volatility. ${s.segment_shifts.length > 0 ? `Segment-level shifts detected: ${s.segment_shifts.join(", ")}.` : "No significant segment-level divergences found."}`,
      causal_factors: factors.length > 0 ? factors : [`Overall ${s.trend_direction} pattern`],
      trend_direction: s.trend_direction,
      change_pct: s.period_change_pct,
      recommendation,
      raw_confidence: Math.min(50 + Math.min((s.data_points - 2) * 2, 20) + (s.volatility_pct < 15 ? 10 : s.volatility_pct < 30 ? 5 : 0), 85),
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);const auth = await authenticateRequest(req);
  const corsHeaders = getCorsHeaders(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const { organization_id, dataset_id, decision_context_id, dry_run } = body;
    if (!organization_id) throw new Error("organization_id required");

    const isMember = await verifyOrgMembership(auth.userId, organization_id);
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!dataset_id) throw new Error("dataset_id required by Active Data Contract");

    // Enforce dataset contract (validates dataset belongs to org, supports dry_run)
    const contract = await enforceDatasetContract(
      { organization_id, dataset_id, dry_run },
      { from: (table: string) => {
        const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
        return {
          select: (cols: string) => ({
            eq: (col: string, val: string) => ({
              eq: (col2: string, val2: string) => ({
                maybeSingle: async () => {
                  const url = `${supabaseUrl}/rest/v1/${table}?select=${cols}&${col}=eq.${val}&${col2}=eq.${val2}&limit=1`;
                  const resp = await fetch(url, { headers });
                  const arr = await resp.json();
                  return { data: arr?.[0] || null, error: null };
                },
              }),
            }),
          }),
        };
      }},
    );

    if (contract.response) return contract.response;

    // Paginated fetch: retrieve ALL metrics, not just first 1000
    const [metrics, dsResp] = await Promise.all([
      fetchAllMetrics(supabaseUrl, serviceKey, organization_id, dataset_id),
      fetch(
        `${supabaseUrl}/rest/v1/datasets?id=eq.${dataset_id}&organization_id=eq.${organization_id}&select=name&limit=1`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      ),
    ]);
    const dsArr = await dsResp.json();
    const datasetName = dsArr?.[0]?.name || "dataset";

    if (!metrics || metrics.length < 2) {
      return new Response(JSON.stringify({
        diagnostics: [],
        analyzed_metrics: metrics?.length || 0,
        message: "Insufficient data for diagnosis (minimum 2 data points required)",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 1: Compute pure statistics from real data
    const { stats, skippedMetrics } = computeStats(metrics);

    // Fetch decision context if provided (no duplicate serviceKey declaration)
    let contextBlock = "";
    if (decision_context_id) {
      const ctxResp = await fetch(
        `${supabaseUrl}/rest/v1/decision_contexts?id=eq.${decision_context_id}&organization_id=eq.${organization_id}&select=name,decision_type,objective,industry,target_metrics`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      const ctxArr = await ctxResp.json();
      if (ctxArr?.[0]) {
        const ctx = ctxArr[0];
        contextBlock = `
DECISION CONTEXT:
Name: ${ctx.name}
Type: ${ctx.decision_type}
Objective: ${ctx.objective || "Not specified"}
Industry: ${ctx.industry || "Not specified"}

IMPORTANT: Frame all diagnoses through this decision context. Explain how each finding impacts the "${ctx.decision_type}" decision and the stated objective.
`;
      }
    }

    // Step 2: Generate AI-driven diagnostics from statistics
    let aiResults = await generateAIDiagnostics(stats, contextBlock, datasetName);

    // Step 3: Fallback to data-driven rule engine if AI unavailable
    if (aiResults.length === 0) {
      aiResults = fallbackDiagnostics(stats);
    } else {
      // Reconcile: backfill any metrics the AI omitted with fallback diagnostics
      const aiMetricTypes = new Set(aiResults.map((r: any) => r.metric_type));
      const missingStats = stats.filter(s => !aiMetricTypes.has(s.metric_type));
      if (missingStats.length > 0) {
        const backfilled = fallbackDiagnostics(missingStats);
        aiResults.push(...backfilled);
      }
    }

    // Step 4: Apply epistemic confidence capping + adaptive calibration (parallelized)
    const diagnosticPromises = aiResults.map(async (ai) => {
      const matchingStat = stats.find(s => s.metric_type === ai.metric_type);
      const sampleSize = matchingStat?.data_points || 2;
      const volatility = matchingStat?.volatility_pct || 0;

      if (sampleSize < 8) {
        const meta = await applyAdaptiveConfidenceWithFetch(
          { rawConfidence: 0, sampleSize },
          supabaseUrl, serviceKey, organization_id,
        );
        return {
          metric_type: ai.metric_type,
          diagnosis: `Insufficient data (${sampleSize} points). Minimum 8 required for credible analysis.`,
          severity: "info" as const,
          root_cause: "Data depth insufficient for statistical validity.",
          causal_factors: [`Only ${sampleSize} data points available`],
          trend_direction: (matchingStat?.trend_direction as DiagnosticResult["trend_direction"]) || "stable",
          change_pct: Number((matchingStat?.period_change_pct || 0).toFixed(1)),
          recommendation: "Collect more historical data to enable diagnostic intelligence.",
          ...applyMeta(meta),
        } as DiagnosticResult;
      }

      const meta = await applyAdaptiveConfidenceWithFetch(
        { rawConfidence: ai.raw_confidence || 60, sampleSize, variance: volatility },
        supabaseUrl, serviceKey, organization_id,
      );

      // Always use the authoritative computed stat value, not the AI's approximation
      const normalizedChangePct = Number((matchingStat?.period_change_pct ?? ai.change_pct ?? 0).toFixed(1));

      return {
        metric_type: ai.metric_type,
        diagnosis: ai.diagnosis || "",
        severity: ai.severity || "info",
        root_cause: ai.root_cause || "",
        causal_factors: Array.isArray(ai.causal_factors) ? ai.causal_factors : [],
        trend_direction: ai.trend_direction || matchingStat?.trend_direction || "stable",
        change_pct: normalizedChangePct,
        recommendation: ai.recommendation || "",
        ...applyMeta(meta),
      } as DiagnosticResult;
    });

    const diagnostics = await Promise.all(diagnosticPromises);

    // Sort: critical first, then warning, then info
    diagnostics.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });

    return new Response(JSON.stringify({
      diagnostics,
      analyzed_metrics: metrics.length,
      metric_types_analyzed: stats.map(s => s.metric_type),
      skipped_metrics: skippedMetrics,
      adaptive_calibration_applied: diagnostics.some(d => d.adaptive_calibration_applied),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
