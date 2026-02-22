import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_LIMITS: Record<string, number> = {
  starter: 3,
  growth: 25,
  enterprise: 999999,
};

// Safe formula evaluator — supports +, -, *, / on metric variables
function evaluateFormula(
  formula: string,
  variables: Record<string, number>
): number {
  // Replace variable names with values
  let expr = formula;
  for (const [name, val] of Object.entries(variables)) {
    expr = expr.replaceAll(name, String(val));
  }

  // Validate: only digits, operators, whitespace, decimal points, parens
  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    throw new Error(`Invalid formula expression: ${expr}`);
  }

  // Use Function for safe math eval (no access to globals)
  const fn = new Function(`"use strict"; return (${expr});`);
  const result = fn();
  if (typeof result !== "number" || !isFinite(result)) {
    throw new Error("Formula produced non-finite result");
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Get authenticated user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { kpi_id, date_from, date_to } = await req.json();
    if (!kpi_id) {
      return new Response(JSON.stringify({ error: "kpi_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch KPI definition
    const { data: kpi, error: kpiError } = await serviceClient
      .from("kpis")
      .select("*")
      .eq("id", kpi_id)
      .single();

    if (kpiError || !kpi) {
      return new Response(JSON.stringify({ error: "KPI not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify org membership
    const { data: isMember } = await serviceClient.rpc("is_org_member", {
      _user_id: user.id,
      _org_id: kpi.organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check subscription tier limits
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("tier, status")
      .eq("organization_id", kpi.organization_id)
      .eq("status", "active")
      .maybeSingle();

    const tier = sub?.tier || "starter";
    const limit = TIER_LIMITS[tier] || 3;

    // Count org KPIs
    const { count } = await serviceClient
      .from("kpis")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", kpi.organization_id)
      .eq("status", "active");

    if ((count || 0) > limit) {
      return new Response(
        JSON.stringify({ error: `KPI limit exceeded for ${tier} tier (max ${limit})` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine date range
    const endDate = date_to || new Date().toISOString().split("T")[0];
    const startDate = date_from || new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

    // Fetch metrics for dependencies
    const deps: string[] = Array.isArray(kpi.metric_dependencies)
      ? kpi.metric_dependencies
      : [];

    if (deps.length === 0) {
      return new Response(
        JSON.stringify({ error: "No metric dependencies defined for this KPI" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: metrics, error: mErr } = await serviceClient
      .from("metrics")
      .select("metric_type, date, value")
      .eq("organization_id", kpi.organization_id)
      .in("metric_type", deps)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (mErr) throw mErr;

    // Group metrics by date
    const byDate: Record<string, Record<string, number[]>> = {};
    for (const m of metrics || []) {
      if (!byDate[m.date]) byDate[m.date] = {};
      if (!byDate[m.date][m.metric_type]) byDate[m.date][m.metric_type] = [];
      byDate[m.date][m.metric_type].push(Number(m.value));
    }

    // Compute KPI for each date
    const results: { date: string; value: number }[] = [];
    for (const [date, typeMap] of Object.entries(byDate)) {
      const variables: Record<string, number> = {};
      for (const dep of deps) {
        const vals = typeMap[dep] || [];
        if (vals.length === 0) continue;
        // Aggregate based on type
        if (kpi.aggregation_type === "avg") {
          variables[dep] = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
        } else {
          variables[dep] = vals.reduce((a: number, b: number) => a + b, 0);
        }
      }

      // Only compute if all deps have values
      if (Object.keys(variables).length < deps.length) continue;

      try {
        const value = evaluateFormula(kpi.formula, variables);
        results.push({ date, value });
      } catch {
        // Skip dates where formula fails
      }
    }

    // Upsert kpi_values
    if (results.length > 0) {
      // Delete existing values in range
      await serviceClient
        .from("kpi_values")
        .delete()
        .eq("kpi_id", kpi_id)
        .gte("date", startDate)
        .lte("date", endDate);

      const inserts = results.map((r) => ({
        kpi_id,
        organization_id: kpi.organization_id,
        date: r.date,
        value: r.value,
        computed_at: new Date().toISOString(),
      }));

      const { error: insertErr } = await serviceClient
        .from("kpi_values")
        .insert(inserts);

      if (insertErr) throw insertErr;
    }

    console.log(JSON.stringify({
      event: "kpi_computed",
      kpi_id,
      organization_id: kpi.organization_id,
      results_count: results.length,
      date_range: { from: startDate, to: endDate },
    }));

    return new Response(
      JSON.stringify({ success: true, values: results, count: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("compute-kpi error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
