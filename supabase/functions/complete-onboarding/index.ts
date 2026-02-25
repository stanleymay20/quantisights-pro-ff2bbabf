import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(userError.message);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { organization_id, roles, kpi_template_id } = await req.json();
    if (!organization_id) throw new Error("organization_id required");

    // 1. Generate baseline risk indices for selected roles
    const selectedRoles = roles || ["ceo", "cfo", "cmo", "coo"];
    const baseScores: Record<string, number> = { ceo: 35, cfo: 40, cmo: 30, coo: 25 };

    for (const role of selectedRoles) {
      const score = baseScores[role] || 30;
      await supabase.from("executive_risk_index").upsert(
        {
          organization_id,
          role_type: role,
          score,
          components: { deviation: score * 0.3, trend: score * 0.25, volatility: score * 0.2, forecast: score * 0.25 },
          last_updated: new Date().toISOString(),
          escalation_required: false,
        },
        { onConflict: "organization_id,role_type", ignoreDuplicates: false }
      );

      // Create default executive mode
      await supabase.from("executive_modes").upsert(
        {
          organization_id,
          role_type: role,
          priority_kpis: [],
          alert_thresholds: { warning: 50, critical: 75 },
        },
        { onConflict: "organization_id,role_type", ignoreDuplicates: true }
      );
    }

    // 2. Generate initial convergence index
    const riskScores = selectedRoles.map((r: string) => baseScores[r] || 30);
    const mean = riskScores.reduce((a: number, b: number) => a + b, 0) / riskScores.length;
    const dispersion = Math.sqrt(riskScores.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / riskScores.length);
    const eciScore = Math.max(0, Math.min(100, Math.round(100 - dispersion * 3)));

    await supabase.from("executive_convergence_index").insert({
      organization_id,
      score: eciScore,
      dispersion: Math.round(dispersion * 100) / 100,
      conflict_penalty: 0,
      volatility_divergence: 0,
      alignment_status: eciScore >= 70 ? "aligned" : eciScore >= 40 ? "tension" : eciScore >= 20 ? "misalignment" : "structural_conflict",
    });

    // 3. Create KPIs from template if selected
    if (kpi_template_id) {
      const { data: template } = await supabase
        .from("kpi_templates")
        .select("kpis")
        .eq("id", kpi_template_id)
        .single();

      if (template?.kpis) {
        const kpis = template.kpis as any[];
        for (const kpi of kpis) {
          await supabase.from("kpis").insert({
            organization_id,
            name: kpi.name,
            formula: kpi.formula,
            aggregation_type: kpi.aggregation_type || "sum",
            description: kpi.description || "",
            created_by: user.id,
            metric_dependencies: [],
            status: "active",
          });
        }
      }
    }

    // 4. Mark onboarding complete
    await supabase
      .from("organizations")
      .update({ onboarding_completed: true })
      .eq("id", organization_id);

    return new Response(
      JSON.stringify({
        success: true,
        risk_indices: selectedRoles.length,
        convergence_score: eciScore,
        kpis_created: kpi_template_id ? "from_template" : "none",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
