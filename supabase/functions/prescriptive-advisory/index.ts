import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { capConfidence, dataSufficiencyRating, fetchCalibrationModel } from "../_shared/confidence-cap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;

  try {
    const { organization_id, dataset_id, role_type, decision_context_id, dry_run } = await req.json();
    if (!organization_id) throw new Error("organization_id required");
    if (!dataset_id) throw new Error("dataset_id required by Active Data Contract");

    const isMember = await verifyOrgMembership(auth.userId, organization_id);
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // Dataset contract: verify dataset belongs to org
    const dsCheckResp = await fetch(
      `${supabaseUrl}/rest/v1/datasets?id=eq.${dataset_id}&organization_id=eq.${organization_id}&select=id`,
      { headers }
    );
    const dsCheck = await dsCheckResp.json();
    if (!dsCheck || dsCheck.length === 0) {
      return new Response(JSON.stringify({ error: "dataset_id does not belong to this organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dry_run) {
      return new Response(JSON.stringify({ dry_run: true, status: "PASS", dataset_id, organization_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metricsUrl = `${supabaseUrl}/rest/v1/metrics?organization_id=eq.${organization_id}&dataset_id=eq.${dataset_id}&order=date.asc&limit=1000`;
    const insightsUrl = `${supabaseUrl}/rest/v1/insights?organization_id=eq.${organization_id}&dataset_id=eq.${dataset_id}&severity=in.(high,medium)&order=created_at.desc&limit=20`;

    const [metricsResp, riskResp, insightsResp, calibrationModel] = await Promise.all([
      fetch(metricsUrl, { headers }),
      fetch(`${supabaseUrl}/rest/v1/executive_risk_index?organization_id=eq.${organization_id}&select=score,role_type,components`, { headers }),
      fetch(insightsUrl, { headers }),
      fetchCalibrationModel(supabaseUrl, serviceKey, organization_id),
    ]);

    const metrics = await metricsResp.json();
    const riskIndices = await riskResp.json();
    const insights = await insightsResp.json();

    const totalSampleSize = (metrics || []).length;

    // Data quality gate
    const qualityMetrics = (metrics || []).filter((m: any) => (m.quality_score ?? 100) >= 60);
    if (qualityMetrics.length < 8) {
      return new Response(JSON.stringify({
        advisories: [],
        total_advisories: 0,
        critical_count: 0,
        message: `Insufficient quality data (${qualityMetrics.length} records with quality ≥60). Minimum 8 required.`,
        generated_at: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group metrics by type with time series
    const metricsByType: Record<string, { values: number[]; dates: string[]; regions: Set<string> }> = {};
    for (const m of qualityMetrics) {
      if (!metricsByType[m.metric_type]) {
        metricsByType[m.metric_type] = { values: [], dates: [], regions: new Set() };
      }
      metricsByType[m.metric_type].values.push(Number(m.value));
      metricsByType[m.metric_type].dates.push(m.date);
      if (m.region) metricsByType[m.metric_type].regions.add(m.region);
    }

    // Build summary for AI
    const metricSummaries = Object.entries(metricsByType).map(([type, data]) => {
      const vals = data.values;
      const n = vals.length;
      const mean = vals.reduce((s, v) => s + v, 0) / n;
      const latest = vals[n - 1];
      const earliest = vals[0];
      const changePct = earliest !== 0 ? ((latest - earliest) / Math.abs(earliest)) * 100 : 0;
      const half = Math.floor(n / 2);
      const recentHalf = vals.slice(half);
      const earlyHalf = vals.slice(0, half);
      const recentAvg = recentHalf.reduce((s, v) => s + v, 0) / recentHalf.length;
      const earlyAvg = earlyHalf.length > 0 ? earlyHalf.reduce((s, v) => s + v, 0) / earlyHalf.length : recentAvg;
      const trendPct = earlyAvg !== 0 ? ((recentAvg - earlyAvg) / Math.abs(earlyAvg)) * 100 : 0;
      const max = vals.reduce((a, b) => a > b ? a : b, vals[0]);
      const min = vals.reduce((a, b) => a < b ? a : b, vals[0]);
      const volatility = mean !== 0 ? (Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n) / Math.abs(mean)) * 100 : 0;

      return {
        metric_type: type,
        data_points: n,
        date_range: `${data.dates[0]} to ${data.dates[n - 1]}`,
        latest_value: latest,
        earliest_value: earliest,
        total_change_pct: Number(changePct.toFixed(2)),
        recent_trend_pct: Number(trendPct.toFixed(2)),
        mean: Number(mean.toFixed(2)),
        min: Number(min.toFixed(2)),
        max: Number(max.toFixed(2)),
        volatility_pct: Number(volatility.toFixed(2)),
        regions: [...data.regions],
      };
    });

    // Use AI to generate domain-agnostic advisories
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const riskSummary = (riskIndices || []).map((r: any) => ({
      role: r.role_type,
      score: r.score,
      components: r.components,
    }));

    const insightSummary = (insights || []).slice(0, 10).map((i: any) => ({
      message: i.message,
      severity: i.severity,
      category: i.category,
    }));

    // Fetch decision context if provided
    let contextBlock = "";
    if (decision_context_id) {
      const ctxResp = await fetch(
        `${supabaseUrl}/rest/v1/decision_contexts?id=eq.${decision_context_id}&organization_id=eq.${organization_id}&select=name,decision_type,objective,industry,target_metrics`,
        { headers }
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
Target Metrics: ${JSON.stringify(ctx.target_metrics || [])}

IMPORTANT: Generate advisories specifically relevant to this "${ctx.decision_type}" decision. Prioritize actions that advance the stated objective. Every advisory must explain its relevance to the decision context.
`;
      }
    }

    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 30000);
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: aiController.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: `You are an enterprise decision intelligence advisor for a $1B+ company.
${contextBlock}
Analyze the following dataset metrics and generate strategic advisories.

METRIC SUMMARIES:
${JSON.stringify(metricSummaries, null, 2)}

EXISTING RISK INDICES:
${JSON.stringify(riskSummary, null, 2)}

RECENT INSIGHTS:
${JSON.stringify(insightSummary, null, 2)}

Generate 3-7 strategic advisories. For EACH advisory, return ONLY valid JSON array with this structure:
[
  {
    "title": "Clear advisory title",
    "category": "cost_optimization" | "revenue_growth" | "risk_mitigation" | "operational" | "strategic",
    "priority": "critical" | "high" | "medium" | "low",
    "action": "Specific recommended action (1-2 sentences)",
    "expected_impact": "Quantified expected impact",
    "timeframe": "e.g. Immediate, 30 days, 30-90 days",
    "raw_confidence": 60-90,
    "rationale": "Evidence-based rationale referencing specific metrics and trends",
    "kpi_affected": ["list", "of", "affected", "KPIs"],
    "playbook_steps": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"]
  }
]

Rules:
- Be domain-agnostic: these could be economic, financial, industrial, SaaS, or any domain metrics
- Reference actual metric names and values from the data
- Prioritize based on magnitude of change, volatility, and risk
- Do NOT generate filler advisories if metrics are stable
- Critical = immediate action needed, High = within 30 days, Medium = 30-90 days, Low = monitoring
- Return ONLY the JSON array, no other text`,
        }],
      }),
    });

    clearTimeout(aiTimeout);

    if (!aiRes.ok) {
      console.error("AI advisory error:", aiRes.status);
      // Fallback: return empty advisories rather than failing
      return new Response(JSON.stringify({
        advisories: [],
        total_advisories: 0,
        critical_count: 0,
        data_sufficiency: dataSufficiencyRating(totalSampleSize),
        sample_size: totalSampleSize,
        confidence_ceiling: totalSampleSize < 12 ? 60 : totalSampleSize < 30 ? 75 : 90,
        adaptive_calibration_applied: !!calibrationModel,
        calibration_model_version: calibrationModel?.model_version ?? null,
        generated_at: new Date().toISOString(),
        ai_error: "AI service temporarily unavailable",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    let aiAdvisories: any[] = [];
    if (jsonMatch) {
      try {
        aiAdvisories = JSON.parse(jsonMatch[0]);
      } catch {
        console.error("Failed to parse AI advisory JSON");
      }
    }

    // Apply confidence capping to each advisory
    const advisories = aiAdvisories.map((a: any, i: number) => ({
      id: `adv-${i + 1}`,
      title: a.title || "Strategic Advisory",
      category: a.category || "strategic",
      priority: a.priority || "medium",
      action: a.action || "",
      expected_impact: a.expected_impact || "",
      timeframe: a.timeframe || "30-90 days",
      confidence: capConfidence(a.raw_confidence || 70, totalSampleSize, undefined, calibrationModel),
      rationale: a.rationale || "",
      kpi_affected: a.kpi_affected || [],
      playbook_steps: a.playbook_steps || [],
    }));

    // Add risk-based advisories from risk index (these are always relevant)
    for (const risk of (riskIndices || [])) {
      if (risk.score >= 70) {
        const role = risk.role_type || "executive";
        advisories.push({
          id: `adv-risk-${role}`,
          title: `${role.toUpperCase()} Risk Escalation Protocol`,
          category: "strategic",
          priority: risk.score >= 85 ? "critical" : "high",
          action: `Initiate board-level review of ${role} risk factors and implement mitigation plan`,
          expected_impact: `Reduce ${role} risk score from ${risk.score} to below 50 within 60 days`,
          timeframe: risk.score >= 85 ? "Immediate" : "30 days",
          confidence: capConfidence(85, totalSampleSize, undefined, calibrationModel),
          rationale: `${role.toUpperCase()} strategic risk index at ${risk.score}/100.`,
          kpi_affected: ["Strategic Risk Index", "Board Confidence"],
          playbook_steps: [
            `Schedule emergency ${role} strategy review`,
            "Identify top 3 risk contributors",
            "Develop contingency plans",
            "Establish weekly risk monitoring",
            "Report mitigation progress within 14 days",
          ],
        });
      }
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    advisories.sort((a: any, b: any) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

    // Deduplication: close existing open advisories for this dataset before inserting new ones
    const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" };

    await fetch(
      `${supabaseUrl}/rest/v1/advisory_instances?organization_id=eq.${organization_id}&dataset_id=eq.${dataset_id}&advisory_type=eq.prescriptive&status=in.(open)`,
      {
        method: "PATCH",
        headers: serviceHeaders,
        body: JSON.stringify({ status: "dismissed", resolution_summary: "Superseded by newer analysis run" }),
      }
    );

    if (advisories.length > 0) {
      const rows = advisories.map((a: any) => ({
        organization_id,
        dataset_id,
        title: a.title,
        action: a.action,
        advisory_type: "prescriptive",
        category: a.category,
        priority: a.priority,
        confidence: a.confidence,
        capped_confidence: a.confidence,
        rationale: a.rationale,
        expected_impact: a.expected_impact,
        timeframe: a.timeframe,
        kpi_affected: a.kpi_affected,
        playbook_steps: a.playbook_steps,
        status: "open",
      }));

      await fetch(`${supabaseUrl}/rest/v1/advisory_instances`, {
        method: "POST",
        headers: serviceHeaders,
        body: JSON.stringify(rows),
      });
    }

    return new Response(JSON.stringify({
      advisories,
      total_advisories: advisories.length,
      critical_count: advisories.filter((a: any) => a.priority === "critical").length,
      data_sufficiency: dataSufficiencyRating(totalSampleSize),
      sample_size: totalSampleSize,
      confidence_ceiling: totalSampleSize < 12 ? 60 : totalSampleSize < 30 ? 75 : 90,
      adaptive_calibration_applied: !!calibrationModel,
      calibration_model_version: calibrationModel?.model_version ?? null,
      generated_at: new Date().toISOString(),
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
