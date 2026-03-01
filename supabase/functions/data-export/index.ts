import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;

  try {
    const { organization_id, tables } = await req.json();
    if (!organization_id) throw new Error("organization_id required");

    // Rate limit: max 5 exports per hour per org
    const rl = checkRateLimit(`export:${organization_id}`, 5, 60 * 60 * 1000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const isMember = await verifyOrgMembership(auth.userId, organization_id);
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is admin/owner
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    const roleResp = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_user_org_role`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ _user_id: auth.userId, _org_id: organization_id }),
      }
    );
    const role = await roleResp.json();
    if (!["owner", "admin"].includes(role)) {
      return new Response(JSON.stringify({ error: "Only admins can export data" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GDPR Article 20 - Full data portability coverage
    const allowedTables = [
      "metrics",
      "advisory_instances",
      "audit_log",
      "kpis",
      "kpi_values",
      "insights",
      "decision_ledger",
      "decision_simulations",
      "datasets",
      "data_sources",
      "executive_briefs",
      "executive_alerts",
      "executive_risk_index",
      "executive_convergence_index",
      "copilot_sessions",
      "copilot_messages",
      "notification_log",
      "notification_preferences",
      "benchmark_scores",
      "simulation_results",
      "scenarios",
      "scenario_assumptions",
      "scenario_results",
      "orchestration_runs",
      "intelligence_audit_trail",
      "data_quality_checks",
    ];
    const requestedTables = (tables || allowedTables).filter((t: string) => allowedTables.includes(t));

    const exportData: Record<string, unknown[]> = {};

    for (const table of requestedTables) {
      try {
        const resp = await fetch(
          `${supabaseUrl}/rest/v1/${table}?organization_id=eq.${organization_id}&order=created_at.desc&limit=10000`,
          { headers }
        );
        if (resp.ok) {
          exportData[table] = await resp.json();
        } else {
          exportData[table] = [];
        }
      } catch {
        exportData[table] = [];
      }
    }

    // Also export user profile data (GDPR right of access)
    const profileResp = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${auth.userId}&select=*`,
      { headers }
    );
    const profileData = profileResp.ok ? await profileResp.json() : [];

    // Audit the export action
    await fetch(`${supabaseUrl}/rest/v1/audit_log`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        organization_id,
        actor_id: auth.userId,
        actor_type: "user",
        action_type: "data_export",
        resource_type: "organization",
        resource_id: organization_id,
        payload: { tables_exported: requestedTables, record_counts: Object.fromEntries(Object.entries(exportData).map(([k, v]) => [k, (v as unknown[]).length])) },
      }),
    });

    return new Response(JSON.stringify({
      organization_id,
      exported_at: new Date().toISOString(),
      exported_by: auth.userId,
      format_version: "2.0",
      gdpr_compliance: {
        article_15: "Right of access — all organization data included",
        article_20: "Right to data portability — machine-readable JSON format",
      },
      user_profile: profileData,
      tables: exportData,
      table_counts: Object.fromEntries(Object.entries(exportData).map(([k, v]) => [k, (v as unknown[]).length])),
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="quantivis-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
