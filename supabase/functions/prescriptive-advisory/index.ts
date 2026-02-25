import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { capConfidence, dataSufficiencyRating } from "../_shared/confidence-cap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Advisory {
  id: string;
  title: string;
  category: "cost_optimization" | "revenue_growth" | "risk_mitigation" | "operational" | "strategic";
  priority: "critical" | "high" | "medium" | "low";
  action: string;
  expected_impact: string;
  timeframe: string;
  confidence: number;
  rationale: string;
  kpi_affected: string[];
  playbook_steps: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth guard
  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;

  try {
    const { organization_id, role_type } = await req.json();
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
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    // Fetch data in parallel
    const [metricsResp, riskResp, insightsResp, kpisResp] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/metrics?organization_id=eq.${organization_id}&order=date.asc&limit=500`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/executive_risk_index?organization_id=eq.${organization_id}&select=score,role_type,components`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/insights?organization_id=eq.${organization_id}&severity=in.(high,medium)&order=created_at.desc&limit=20`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/kpis?organization_id=eq.${organization_id}&status=eq.active&limit=20`, { headers }),
    ]);

    const metrics = await metricsResp.json();
    const riskIndices = await riskResp.json();
    const insights = await insightsResp.json();
    const kpis = await kpisResp.json();

    const advisories: Advisory[] = [];
    let advId = 0;
    const totalSampleSize = (metrics || []).length;

    // Data quality gate: check quality scores
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

    // Analyze metrics for patterns
    const metricsByType: Record<string, number[]> = {};
    for (const m of qualityMetrics) {
      if (!metricsByType[m.metric_type]) metricsByType[m.metric_type] = [];
      metricsByType[m.metric_type].push(Number(m.value));
    }

    // Revenue analysis
    const revValues = metricsByType["revenue"] || [];
    if (revValues.length >= 8) {
      const latest = revValues[revValues.length - 1];
      const prev = revValues[revValues.length - 2];
      const changePct = prev !== 0 ? ((latest - prev) / Math.abs(prev)) * 100 : 0;

      if (changePct < -10) {
        advisories.push({
          id: `adv-${++advId}`,
          title: "Revenue Recovery Plan Required",
          category: "revenue_growth",
          priority: "critical",
          action: "Implement emergency revenue recovery program targeting top 20% accounts",
          expected_impact: `Recover ${Math.abs(changePct * 0.5).toFixed(0)}% of lost revenue within 60 days`,
          timeframe: "Immediate — 60 days",
          confidence: capConfidence(82, revValues.length),
          rationale: `Revenue declined ${Math.abs(changePct).toFixed(1)}% period-over-period. Without intervention, compounding losses project ${(changePct * 3).toFixed(0)}% annual impact.`,
          kpi_affected: ["Revenue", "MRR", "Net Revenue Retention"],
          playbook_steps: [
            "Identify top 20 accounts by revenue contribution",
            "Conduct account health scoring (usage, support tickets, engagement)",
            "Deploy dedicated account managers for at-risk accounts",
            "Launch win-back campaign for recently churned customers",
            "Review and adjust pricing for competitive segments",
          ],
        });
      }

      if (changePct > 0 && changePct < 5) {
        advisories.push({
          id: `adv-${++advId}`,
          title: "Growth Acceleration Opportunity",
          category: "revenue_growth",
          priority: "medium",
          action: "Implement expansion revenue program to accelerate from steady to high growth",
          expected_impact: "Increase growth rate by 2-3x within 90 days",
          timeframe: "30-90 days",
          confidence: capConfidence(70, revValues.length),
          rationale: `Current growth at ${changePct.toFixed(1)}% is stable but below potential. Market conditions support aggressive expansion.`,
          kpi_affected: ["Revenue Growth Rate", "ARPU", "Expansion Revenue"],
          playbook_steps: [
            "Analyze upsell opportunities within existing customer base",
            "Launch tiered feature gates to drive plan upgrades",
            "Implement usage-based pricing for high-consumption accounts",
            "Create cross-sell bundles for complementary products",
          ],
        });
      }
    }

    // Cost analysis
    const costValues = metricsByType["cost"] || [];
    if (costValues.length >= 8) {
      const latest = costValues[costValues.length - 1];
      const prev = costValues[costValues.length - 2];
      const costChange = prev !== 0 ? ((latest - prev) / Math.abs(prev)) * 100 : 0;

      if (costChange > 10) {
        advisories.push({
          id: `adv-${++advId}`,
          title: "Cost Optimization Program",
          category: "cost_optimization",
          priority: "high",
          action: "Launch structured cost reduction targeting top 3 expense categories",
          expected_impact: `Reduce operating costs by ${Math.min(costChange * 0.4, 15).toFixed(0)}% within 90 days`,
          timeframe: "30-90 days",
          confidence: capConfidence(78, costValues.length),
          rationale: `Costs increased ${costChange.toFixed(1)}% while revenue growth hasn't matched. Gross margin is compressing.`,
          kpi_affected: ["Operating Costs", "Gross Margin", "Burn Rate"],
          playbook_steps: [
            "Audit top 10 vendor contracts for renegotiation opportunities",
            "Review headcount ROI by department",
            "Identify automation opportunities for manual processes",
            "Implement spend approval workflows for discretionary expenses",
            "Set department-level budget caps with variance alerts",
          ],
        });
      }
    }

    // Churn analysis
    const churnValues = metricsByType["churn"] || [];
    if (churnValues.length >= 8) {
      const latestChurn = churnValues[churnValues.length - 1];
      if (latestChurn > 5) {
        advisories.push({
          id: `adv-${++advId}`,
          title: "Customer Retention Crisis Response",
          category: "risk_mitigation",
          priority: latestChurn > 8 ? "critical" : "high",
          action: "Deploy multi-channel retention program targeting at-risk customer segments",
          expected_impact: `Reduce churn by ${Math.min(latestChurn * 0.3, 5).toFixed(1)} percentage points within 90 days`,
          timeframe: "Immediate — 90 days",
          confidence: capConfidence(80, churnValues.length),
          rationale: `Churn rate at ${latestChurn.toFixed(1)}% exceeds the 5% healthy threshold. Each point of churn represents significant lifetime value loss.`,
          kpi_affected: ["Churn Rate", "Net Revenue Retention", "Customer LTV"],
          playbook_steps: [
            "Implement predictive churn scoring using usage patterns",
            "Launch automated health check emails for low-engagement users",
            "Create dedicated success team for enterprise accounts",
            "Offer targeted retention incentives (discounts, feature previews)",
            "Establish quarterly business reviews for top accounts",
          ],
        });
      }
    }

    // Risk-based advisories from risk index
    for (const risk of (riskIndices || [])) {
      if (risk.score >= 70) {
        const role = risk.role_type || "executive";
        advisories.push({
          id: `adv-${++advId}`,
          title: `${role.toUpperCase()} Risk Escalation Protocol`,
          category: "strategic",
          priority: risk.score >= 85 ? "critical" : "high",
          action: `Initiate board-level review of ${role} risk factors and implement mitigation plan`,
          expected_impact: `Reduce ${role} risk score from ${risk.score} to below 50 within 60 days`,
          timeframe: risk.score >= 85 ? "Immediate" : "30 days",
          confidence: capConfidence(85, totalSampleSize),
          rationale: `${role.toUpperCase()} strategic risk index at ${risk.score}/100 — ${risk.score >= 85 ? "critical" : "elevated"} territory. Components: deviation=${risk.components?.deviation || 0}, trend=${risk.components?.trend || 0}, volatility=${risk.components?.volatility || 0}.`,
          kpi_affected: ["Strategic Risk Index", "Board Confidence", "Operational Stability"],
          playbook_steps: [
            `Schedule emergency ${role} strategy review session`,
            "Identify top 3 risk contributors from component breakdown",
            "Develop contingency plans for each high-risk scenario",
            "Establish weekly risk monitoring cadence",
            "Report mitigation progress to board within 14 days",
          ],
        });
      }
    }

    // Insight-driven advisories
    const highInsights = (insights || []).filter((i: any) => i.severity === "high");
    if (highInsights.length >= 3) {
      advisories.push({
        id: `adv-${++advId}`,
        title: "Systemic Issue Detection — Multiple High Alerts",
        category: "operational",
        priority: "high",
        action: "Conduct cross-functional root cause analysis for clustered anomalies",
        expected_impact: "Identify and resolve systemic operational issues within 30 days",
        timeframe: "Immediate — 30 days",
        confidence: capConfidence(72, highInsights.length),
        rationale: `${highInsights.length} high-severity insights detected simultaneously, suggesting interconnected operational failures rather than isolated incidents.`,
        kpi_affected: ["Operational Health", "System Reliability", "Executive Confidence"],
        playbook_steps: [
          "Map all high-severity insights to common root causes",
          "Assign cross-functional investigation team",
          "Implement daily stand-ups until resolution",
          "Create incident timeline and impact assessment",
          "Develop preventive measures and monitoring enhancements",
        ],
      });
    }

    // No filler advisories — if nothing is wrong, return empty.
    // Trust > synthetic intelligence.

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    advisories.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return new Response(JSON.stringify({
      advisories,
      total_advisories: advisories.length,
      critical_count: advisories.filter(a => a.priority === "critical").length,
      data_sufficiency: dataSufficiencyRating(totalSampleSize),
      sample_size: totalSampleSize,
      confidence_ceiling: totalSampleSize < 12 ? 60 : totalSampleSize < 30 ? 75 : 90,
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
