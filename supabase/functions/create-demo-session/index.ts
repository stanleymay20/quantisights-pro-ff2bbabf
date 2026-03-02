import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Create a unique demo user
    const demoId = crypto.randomUUID().slice(0, 8);
    const email = `demo-${demoId}@demo.quantivis.io`;
    const password = crypto.randomUUID();

    // Create user with auto-confirm
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Demo User", is_demo: true },
    });
    if (authErr) throw authErr;
    const userId = authData.user.id;

    // Wait briefly for the handle_new_user trigger to fire
    await new Promise(r => setTimeout(r, 1500));

    // Get the org created by the trigger
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.organization_id) throw new Error("Profile not created");
    const orgId = profile.organization_id;

    // Update org name
    await admin.from("organizations").update({
      name: "Acme Corp (Demo)",
      industry: "SaaS / B2B Software",
      revenue_band: "$5M-$20M",
      size_band: "51-200",
      onboarding_completed: true,
    }).eq("id", orgId);

    // ─── Seed demo data (inlined for speed) ───

    // Metrics (15 months)
    const metricTypes = ["revenue", "cost", "churn_rate", "customer_count", "mrr", "nps"];
    const metricRows: any[] = [];
    const now = new Date();
    for (let m = 14; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const dateStr = d.toISOString().split("T")[0];
      const base: Record<string, number> = {
        revenue: 850000 + m * 12000 + Math.round((Math.random() - 0.4) * 40000),
        cost: 520000 + m * 5000 + Math.round((Math.random() - 0.5) * 20000),
        churn_rate: 4.2 + (Math.random() - 0.5) * 1.5,
        customer_count: 420 + m * 8 + Math.round(Math.random() * 15),
        mrr: 71000 + m * 1000 + Math.round((Math.random() - 0.4) * 5000),
        nps: 42 + Math.round((Math.random() - 0.3) * 12),
      };
      for (const mt of metricTypes) {
        metricRows.push({
          organization_id: orgId,
          metric_type: mt,
          date: dateStr,
          value: Math.round(base[mt] * 100) / 100,
          source_type: "demo_seed",
          quality_score: 85 + Math.round(Math.random() * 15),
        });
      }
    }
    await admin.from("metrics").insert(metricRows);

    // Executive Risk Index
    await admin.from("executive_risk_index").insert([
      { organization_id: orgId, role_type: "ceo", score: 62, components: { deviation: 18, trend: 22, volatility: 12, forecast: 10 }, escalation_required: false },
      { organization_id: orgId, role_type: "cfo", score: 78, components: { deviation: 25, trend: 18, volatility: 20, forecast: 15 }, escalation_required: true, escalation_reason: "Cash burn rate accelerating beyond Q3 projections" },
      { organization_id: orgId, role_type: "cmo", score: 45, components: { deviation: 12, trend: 8, volatility: 15, forecast: 10 }, escalation_required: false },
      { organization_id: orgId, role_type: "coo", score: 54, components: { deviation: 14, trend: 15, volatility: 10, forecast: 15 }, escalation_required: false },
    ]);

    // Convergence Index
    await admin.from("executive_convergence_index").insert({
      organization_id: orgId, score: 64, alignment_status: "partial_alignment",
      dispersion: 18.3, conflict_penalty: 8, volatility_divergence: 12.5,
    });

    // Conflicts
    await admin.from("executive_conflicts").insert([
      {
        organization_id: orgId, role_1: "cfo", role_2: "cmo", severity: "high",
        rule_triggered: "budget_allocation_conflict",
        description: "CFO recommends 15% marketing budget reduction while CMO projects require 20% increase for Q3 pipeline targets.",
      },
      {
        organization_id: orgId, role_1: "ceo", role_2: "coo", severity: "medium",
        rule_triggered: "capacity_growth_mismatch",
        description: "CEO growth targets imply 30% headcount increase but COO capacity models show diminishing returns beyond 15%.",
      },
    ]);

    // Decision Ledger
    await admin.from("decision_ledger").insert([
      {
        organization_id: orgId, recommended_action: "Expand enterprise sales team by 4 AEs focused on $100K+ ACV deals",
        decision_type: "growth", decision_status: "approved", execution_status: "in_progress",
        chosen_action: "Approved with modified timeline — hiring 3 AEs in Q2, 1 in Q3",
        capped_confidence: 68, raw_confidence: 82, predicted_net_impact: 420000,
        confidence_cap_reason: "Limited historical data on enterprise segment conversion rates",
      },
      {
        organization_id: orgId, recommended_action: "Implement automated onboarding reducing time-to-value from 14 days to 3 days",
        decision_type: "retention", decision_status: "approved", execution_status: "completed",
        chosen_action: "Deployed self-serve onboarding with guided tutorial",
        capped_confidence: 74, raw_confidence: 88, predicted_net_impact: 180000,
        outcome_delta: 145000, actual_value: 995000, baseline_value: 850000, prediction_accuracy_score: 80,
        confidence_cap_reason: "Churn attribution model has moderate variance",
      },
      {
        organization_id: orgId, recommended_action: "Reduce infrastructure costs by migrating to serverless architecture",
        decision_type: "cost_optimization", decision_status: "pending", execution_status: "not_started",
        capped_confidence: 55, raw_confidence: 71, predicted_net_impact: 95000,
        confidence_cap_reason: "Migration complexity estimates based on comparable companies",
      },
    ]);

    // Advisory Instances
    await admin.from("advisory_instances").insert([
      {
        organization_id: orgId, title: "CFO Risk Score Approaching Escalation Threshold",
        action: "Review cash burn projections and schedule CFO-CEO alignment meeting",
        advisory_type: "prescriptive", priority: "high", category: "risk_management", status: "open",
        rationale: "CFO risk index increased 23 points over 60 days. Escalation threshold (85) will be breached within 3 weeks.",
        impact_score: 78, capped_confidence: 72, raw_confidence: 84, data_quality_index: 88,
        confidence_cap_reason: "Cost trajectory extrapolation based on 4-month trend",
      },
      {
        organization_id: orgId, title: "Churn Velocity Anomaly in Mid-Market Segment",
        action: "Deploy targeted retention campaign for mid-market accounts with usage decline >20%",
        advisory_type: "prescriptive", priority: "high", category: "retention", status: "open",
        rationale: "Mid-market churn velocity increased 1.8x vs trailing 6-month average. 14 accounts showing pre-churn patterns.",
        impact_score: 65, capped_confidence: 64, raw_confidence: 78, data_quality_index: 82,
        confidence_cap_reason: "Churn prediction model accuracy is 73% on validation set",
      },
    ]);

    // Simulation Results
    await admin.from("simulation_results").insert([
      {
        organization_id: orgId, metric_type: "revenue", expected_value: 1250000, median_value: 1220000,
        p10_value: 980000, p25_value: 1080000, p75_value: 1380000, p90_value: 1520000,
        probability_negative: 8, sample_size: 90, data_sufficiency: "sufficient", simulation_runs: 10000,
        forecast_horizon: 6, raw_confidence: 82, capped_confidence: 72, volatility: 0.18,
        mean_growth_rate: 0.04, variance_score: 15.2, created_by: userId,
        confidence_cap_reason: "Revenue growth assumptions incorporate macro uncertainty",
      },
    ]);

    // Sign in as the demo user to return credentials
    const { data: signIn, error: signErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    // Use signInWithPassword instead for immediate access
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey);
    const { data: session, error: sessErr } = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (sessErr) throw sessErr;

    return new Response(JSON.stringify({
      success: true,
      access_token: session.session?.access_token,
      refresh_token: session.session?.refresh_token,
      email,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Demo session error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
