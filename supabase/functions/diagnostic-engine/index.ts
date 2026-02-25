import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MetricRow {
  metric_type: string;
  value: number;
  date: string;
  region: string | null;
  segment: string | null;
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
}

function computeDiagnostics(metrics: MetricRow[]): DiagnosticResult[] {
  const grouped: Record<string, MetricRow[]> = {};
  for (const m of metrics) {
    if (!grouped[m.metric_type]) grouped[m.metric_type] = [];
    grouped[m.metric_type].push(m);
  }

  const results: DiagnosticResult[] = [];

  for (const [type, rows] of Object.entries(grouped)) {
    // STATISTICAL DEPTH GATE: require minimum 8 data points for credible diagnostics
    if (rows.length < 8) {
      if (rows.length >= 2) {
        results.push({
          metric_type: type,
          diagnosis: `Insufficient data (${rows.length} points). Minimum 8 required for credible analysis.`,
          severity: "info",
          root_cause: "Data depth insufficient for statistical validity.",
          causal_factors: [`Only ${rows.length} data points available`],
          trend_direction: "stable",
          change_pct: 0,
          recommendation: "Upload more historical data to enable diagnostics.",
          confidence: 0,
        });
      }
      continue;
    }

    const sorted = rows.sort((a, b) => a.date.localeCompare(b.date));
    const values = sorted.map(r => Number(r.value));
    const latest = values[values.length - 1];
    const previous = values[values.length - 2];
    const oldest = values[0];
    const changePct = previous !== 0 ? ((latest - previous) / Math.abs(previous)) * 100 : 0;
    const totalChangePct = oldest !== 0 ? ((latest - oldest) / Math.abs(oldest)) * 100 : 0;

    // Volatility: std deviation / mean
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const volatility = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

    // Trend detection via simple linear regression
    const n = values.length;
    const xMean = (n - 1) / 2;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (values[i] - mean);
      den += (i - xMean) ** 2;
    }
    const slope = den !== 0 ? num / den : 0;
    const slopeNorm = mean !== 0 ? (slope / Math.abs(mean)) * 100 : 0;

    // Determine trend
    let trend_direction: DiagnosticResult["trend_direction"] = "stable";
    if (volatility > 30) trend_direction = "volatile";
    else if (slopeNorm > 5) trend_direction = "improving";
    else if (slopeNorm < -5) trend_direction = "declining";

    // Segment analysis for causal factors
    const segmentBreakdown: Record<string, number[]> = {};
    for (const r of sorted) {
      const seg = r.segment || r.region || "overall";
      if (!segmentBreakdown[seg]) segmentBreakdown[seg] = [];
      segmentBreakdown[seg].push(Number(r.value));
    }

    const causalFactors: string[] = [];
    for (const [seg, vals] of Object.entries(segmentBreakdown)) {
      if (vals.length < 2 || seg === "overall") continue;
      const segChange = vals[vals.length - 1] - vals[0];
      const segChangePct = vals[0] !== 0 ? (segChange / Math.abs(vals[0])) * 100 : 0;
      if (Math.abs(segChangePct) > 15) {
        causalFactors.push(`${seg}: ${segChangePct > 0 ? "+" : ""}${segChangePct.toFixed(1)}% shift`);
      }
    }

    // Generate diagnosis
    let severity: DiagnosticResult["severity"] = "info";
    let diagnosis = "";
    let rootCause = "";
    let recommendation = "";
    // Confidence scales with sample size, variance stability, and data freshness
    const sampleBonus = Math.min((n - 8) * 2, 20); // 0-20 bonus for more data
    const stabilityBonus = volatility < 15 ? 10 : volatility < 30 ? 5 : 0;
    let confidence = 50 + sampleBonus + stabilityBonus; // base 50, max ~90

    if (type === "revenue") {
      if (changePct < -10) {
        severity = "critical";
        diagnosis = `Revenue dropped ${Math.abs(changePct).toFixed(1)}% — immediate investigation required.`;
        rootCause = volatility > 25
          ? "High revenue volatility suggests inconsistent sales pipeline or seasonal dependency."
          : "Sustained decline indicates structural demand erosion or competitive displacement.";
        recommendation = "Conduct segment-level revenue audit. Identify churning customer cohorts and run retention campaigns.";
        confidence = 85;
      } else if (changePct < -5) {
        severity = "warning";
        diagnosis = `Revenue declined ${Math.abs(changePct).toFixed(1)}% — trend requires monitoring.`;
        rootCause = "Moderate decline may indicate market softening or pricing pressure.";
        recommendation = "Review pricing strategy and customer acquisition cost trends.";
        confidence = 75;
      } else if (changePct > 15) {
        severity = "info";
        diagnosis = `Revenue surged ${changePct.toFixed(1)}% — validate sustainability.`;
        rootCause = "Sharp growth may be driven by one-time deals or seasonal factors.";
        recommendation = "Verify growth is recurring. Stress-test capacity and unit economics.";
        confidence = 80;
      } else {
        diagnosis = `Revenue is ${trend_direction} with ${changePct.toFixed(1)}% recent change.`;
        rootCause = "No significant anomalies detected in revenue trajectory.";
        recommendation = "Continue monitoring. Consider growth acceleration strategies.";
      }
    } else if (type === "churn") {
      if (latest > 8) {
        severity = "critical";
        diagnosis = `Churn rate at ${latest.toFixed(1)}% — exceeds sustainable threshold.`;
        rootCause = "Elevated churn suggests product-market fit erosion, support failures, or competitive pressure.";
        recommendation = "Launch exit-survey analysis. Implement proactive retention for at-risk accounts.";
        confidence = 85;
      } else if (latest > 5) {
        severity = "warning";
        diagnosis = `Churn at ${latest.toFixed(1)}% — approaching risk threshold.`;
        rootCause = "Rising churn often correlates with onboarding friction or unmet feature expectations.";
        recommendation = "Review NPS scores and support ticket patterns for recurring issues.";
        confidence = 75;
      } else {
        diagnosis = `Churn is healthy at ${latest.toFixed(1)}%.`;
        rootCause = "Retention metrics within expected range.";
        recommendation = "Maintain current retention programs.";
      }
    } else if (type === "cost") {
      if (changePct > 15) {
        severity = "warning";
        diagnosis = `Costs increased ${changePct.toFixed(1)}% — margin compression risk.`;
        rootCause = "Cost escalation may stem from scaling inefficiencies, vendor price increases, or uncontrolled hiring.";
        recommendation = "Conduct cost-per-unit analysis. Identify top 3 cost drivers and negotiate or optimize.";
        confidence = 75;
      } else {
        diagnosis = `Costs are ${trend_direction} with ${changePct.toFixed(1)}% change.`;
        rootCause = "Cost structure appears stable.";
        recommendation = "Continue monitoring burn rate relative to revenue growth.";
      }
    } else if (type === "customers") {
      if (changePct < -5) {
        severity = "warning";
        diagnosis = `Customer base contracted ${Math.abs(changePct).toFixed(1)}%.`;
        rootCause = "Customer loss may indicate market contraction, competitor gains, or product issues.";
        recommendation = "Analyze lost customers by segment. Identify common churn triggers.";
        confidence = 75;
      } else if (changePct > 20) {
        severity = "info";
        diagnosis = `Customer base grew ${changePct.toFixed(1)}% — validate unit economics.`;
        rootCause = "Rapid growth needs validation that CAC and LTV remain healthy.";
        recommendation = "Monitor CAC payback period and ensure support capacity scales.";
        confidence = 80;
      } else {
        diagnosis = `Customer base is ${trend_direction} with ${changePct.toFixed(1)}% change.`;
        rootCause = "Customer growth within normal parameters.";
        recommendation = "Focus on improving activation and expansion revenue.";
      }
    } else {
      diagnosis = `${type} shows ${changePct.toFixed(1)}% change (${trend_direction}).`;
      rootCause = `${type} trajectory is ${volatility > 25 ? "volatile" : "steady"}.`;
      recommendation = `Review ${type} drivers and set monitoring thresholds.`;
    }

    if (causalFactors.length === 0) {
      causalFactors.push(`Overall ${trend_direction} trend over ${n} data points`);
      if (volatility > 20) causalFactors.push(`High volatility (${volatility.toFixed(0)}% CV)`);
    }

    results.push({
      metric_type: type,
      diagnosis,
      severity,
      root_cause: rootCause,
      causal_factors: causalFactors,
      trend_direction,
      change_pct: Math.round(changePct * 10) / 10,
      recommendation,
      confidence: Math.min(confidence, 95),
    });
  }

  // Sort: critical first
  results.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth guard
  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;

  try {
    const { organization_id } = await req.json();
    if (!organization_id) throw new Error("organization_id required");

    // Verify org membership
    const isMember = await verifyOrgMembership(auth.userId, organization_id);
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Fetch metrics
    const metricsResp = await fetch(
      `${supabaseUrl}/rest/v1/metrics?organization_id=eq.${organization_id}&order=date.asc&limit=500`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    const metrics: MetricRow[] = await metricsResp.json();

    if (!metrics || metrics.length < 2) {
      return new Response(JSON.stringify({ diagnostics: [], message: "Insufficient data for diagnosis" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const diagnostics = computeDiagnostics(metrics);

    return new Response(JSON.stringify({ diagnostics, analyzed_metrics: metrics.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
