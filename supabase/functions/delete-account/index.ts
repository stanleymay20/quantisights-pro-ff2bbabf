import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limit: 3 delete attempts per hour per IP
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const rl = checkRateLimit(`delete:${clientIp}`, 3, 60 * 60 * 1000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabaseAnon.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Get user's org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", userId)
      .single();

    const orgId = profile?.organization_id;

    // Check if user is org owner and sole member
    let deleteOrg = false;
    if (orgId) {
      const { data: members } = await supabase
        .from("organization_members")
        .select("id, user_id")
        .eq("organization_id", orgId);

      // Only delete org data if user is the sole member
      deleteOrg = (members?.length === 1 && members[0].user_id === userId);
    }

    // Delete user-specific data (order matters for FK)
    if (orgId && deleteOrg) {
      // Delete all org data in correct order
      const tables = [
        "advisory_instances",
        "copilot_messages",
        "copilot_sessions",
        "notification_log",
        "notification_preferences",
        "executive_alerts",
        "executive_briefs",
        "executive_conflicts",
        "executive_convergence_index",
        "executive_modes",
        "executive_risk_index",
        "orchestration_runs",
        "intelligence_audit_trail",
        "scenario_results",
        "scenario_assumptions",
        "kpi_values",
        "kpi_targets",
        "data_quality_checks",
        "data_sync_jobs",
        "dataset_versions",
        "insights",
        "copilot_usage",
        "convergence_usage",
        "simulation_usage",
        "subscriptions",
        "team_invitations",
        "reports",
      ] as const;

      for (const table of tables) {
        await supabase.from(table).delete().eq("organization_id", orgId);
      }

      // Delete metrics, scenarios, kpis, datasets, data_sources
      await supabase.from("metrics").delete().eq("organization_id", orgId);
      await supabase.from("scenarios").delete().eq("organization_id", orgId);
      await supabase.from("kpis").delete().eq("organization_id", orgId);
      await supabase.from("datasets").delete().eq("organization_id", orgId);
      await supabase.from("data_sources").delete().eq("organization_id", orgId);

      // Anonymize audit logs (retain structure, remove PII)
      await supabase
        .from("audit_log")
        .update({ actor_id: null, ip_address: null, payload: { redacted: true, reason: "account_deletion" } })
        .eq("organization_id", orgId);

      // Remove org membership and org
      await supabase.from("organization_members").delete().eq("organization_id", orgId);
      await supabase.from("organizations").delete().eq("id", orgId);
    } else if (orgId) {
      // Just remove this user's membership, don't delete org
      await supabase.from("organization_members").delete().eq("user_id", userId).eq("organization_id", orgId);
    }

    // Delete profile
    await supabase.from("profiles").delete().eq("user_id", userId);
    await supabase.from("user_roles").delete().eq("user_id", userId);

    // Delete auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
