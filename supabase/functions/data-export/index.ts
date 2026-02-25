import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";

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

    const allowedTables = ["metrics", "advisory_instances", "audit_log", "kpis", "kpi_values", "insights"];
    const requestedTables = (tables || allowedTables).filter((t: string) => allowedTables.includes(t));

    const exportData: Record<string, unknown[]> = {};

    for (const table of requestedTables) {
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/${table}?organization_id=eq.${organization_id}&order=created_at.desc&limit=1000`,
        { headers }
      );
      exportData[table] = await resp.json();
    }

    return new Response(JSON.stringify({
      organization_id,
      exported_at: new Date().toISOString(),
      tables: exportData,
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
