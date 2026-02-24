import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RiskComponents {
  deviation: number;
  trend: number;
  volatility: number;
  forecast: number;
}

interface RoleRisk {
  role_type: string;
  score: number;
  components: RiskComponents;
}

interface Conflict {
  rule_triggered: string;
  severity: string;
  role_1: string;
  role_2: string;
  description: string;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function computeConvergence(roles: RoleRisk[]) {
  if (roles.length < 2) return null;

  const scores = roles.map(r => r.score);
  const dispersion = Math.round(stddev(scores) * 100) / 100;

  const conflicts: Conflict[] = [];
  let conflictPenalty = 0;

  const roleMap: Record<string, RoleRisk> = {};
  for (const r of roles) roleMap[r.role_type] = r;

  if (roleMap.ceo && roleMap.cfo && Math.abs(roleMap.ceo.score - roleMap.cfo.score) > 30) {
    conflicts.push({ rule_triggered: "strategic_financial_divergence", severity: "high", role_1: "ceo", role_2: "cfo",
      description: `CEO risk (${roleMap.ceo.score}) and CFO risk (${roleMap.cfo.score}) diverge by ${Math.abs(roleMap.ceo.score - roleMap.cfo.score)} points` });
    conflictPenalty += 15;
  }

  if (roleMap.cmo && roleMap.coo && roleMap.cmo.score < 40 && roleMap.coo.score > 70) {
    conflicts.push({ rule_triggered: "growth_execution_strain", severity: "medium", role_1: "cmo", role_2: "coo",
      description: `CMO low risk (${roleMap.cmo.score}) while COO elevated (${roleMap.coo.score}) — growth vs execution strain` });
    conflictPenalty += 8;
  }

  if (roleMap.cfo && roleMap.ceo && roleMap.cfo.score > 75 && roleMap.ceo.score < 50) {
    conflicts.push({ rule_triggered: "cash_expansion_mismatch", severity: "high", role_1: "cfo", role_2: "ceo",
      description: `CFO cash risk (${roleMap.cfo.score}) while CEO pursues expansion (${roleMap.ceo.score})` });
    conflictPenalty += 15;
  }

  for (const r of roles) {
    const vol = (r.components as any)?.volatility ?? 0;
    if (vol > 80) {
      const othersLow = roles.filter(o => o.role_type !== r.role_type).every(o => ((o.components as any)?.volatility ?? 0) < 40);
      if (othersLow) {
        conflicts.push({ rule_triggered: "operational_imbalance", severity: "critical", role_1: r.role_type, role_2: "all_others",
          description: `${r.role_type.toUpperCase()} volatility (${vol}) vastly exceeds others` });
        conflictPenalty += 25;
      }
    }
  }

  const volatilities = roles.map(r => (r.components as any)?.volatility ?? 0);
  let volatilityDivergence = 0;
  if (Math.max(...volatilities) - Math.min(...volatilities) > 35) volatilityDivergence = 10;

  const score = clamp(Math.round(100 - (dispersion + conflictPenalty + volatilityDivergence)), 0, 100);

  let alignmentStatus = "aligned";
  if (score >= 80) alignmentStatus = "aligned";
  else if (score >= 60) alignmentStatus = "tension";
  else if (score >= 40) alignmentStatus = "misalignment";
  else alignmentStatus = "structural_conflict";

  return { score, dispersion, conflict_penalty: conflictPenalty, volatility_divergence: volatilityDivergence, alignment_status: alignmentStatus, conflicts };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all orgs with active growth/enterprise subscriptions
    const { data: subs } = await serviceClient
      .from("subscriptions")
      .select("organization_id, tier")
      .eq("status", "active")
      .in("tier", ["growth", "enterprise"]);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: "No eligible organizations", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    // Process in batches of 5
    for (let i = 0; i < subs.length; i += 5) {
      const batch = subs.slice(i, i + 5);
      await Promise.all(batch.map(async (sub) => {
        const orgId = sub.organization_id;
        try {
          // Check if last convergence is recent enough
          const { data: latest } = await serviceClient
            .from("executive_convergence_index")
            .select("score, created_at")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Fetch role risk indices
          const { data: riskRows } = await serviceClient
            .from("executive_risk_index")
            .select("role_type, score, components")
            .eq("organization_id", orgId);

          const roles: RoleRisk[] = (riskRows || []).map((r: any) => ({
            role_type: r.role_type,
            score: r.score,
            components: r.components,
          }));

          if (roles.length < 2) {
            skipped++;
            return;
          }

          const result = computeConvergence(roles);
          if (!result) { skipped++; return; }

          // Skip if score unchanged and last update < 6h
          if (latest) {
            const lastAge = Date.now() - new Date(latest.created_at).getTime();
            if (latest.score === result.score && lastAge < SIX_HOURS_MS) {
              skipped++;
              return;
            }
          }

          // Store convergence
          await serviceClient.from("executive_convergence_index").insert({
            organization_id: orgId,
            score: result.score,
            dispersion: result.dispersion,
            conflict_penalty: result.conflict_penalty,
            volatility_divergence: result.volatility_divergence,
            alignment_status: result.alignment_status,
          });

          // Resolve old conflicts, insert new
          await serviceClient.from("executive_conflicts")
            .update({ resolved_at: new Date().toISOString() })
            .eq("organization_id", orgId)
            .is("resolved_at", null);

          for (const c of result.conflicts) {
            await serviceClient.from("executive_conflicts").insert({
              organization_id: orgId, ...c,
            });
          }

          console.log(JSON.stringify({
            event: "convergence_reconciled",
            organization_id: orgId,
            score: result.score,
            alignment_status: result.alignment_status,
            conflicts_count: result.conflicts.length,
          }));

          processed++;
        } catch (orgErr) {
          errors++;
          console.error(`Convergence reconcile error for org ${orgId}:`, orgErr);
        }
      }));
    }

    const duration = Date.now() - startTime;

    const summary = {
      event: "convergence_reconcile_batch",
      total_eligible: subs.length,
      processed,
      skipped,
      errors,
      duration_ms: duration,
      avg_per_org_ms: processed > 0 ? Math.round(duration / processed) : 0,
    };

    console.log(JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("convergence-reconcile error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
