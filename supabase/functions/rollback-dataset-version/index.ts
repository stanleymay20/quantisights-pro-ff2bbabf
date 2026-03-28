import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
  const corsHeaders = getCorsHeaders(req);

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // Authenticate user from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dataset_id, version_number } = await req.json();
    if (!dataset_id || !version_number) {
      return new Response(JSON.stringify({ error: "dataset_id and version_number required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get dataset and verify org
    const { data: dataset, error: dsErr } = await supabase
      .from("datasets")
      .select("id, organization_id, current_version")
      .eq("id", dataset_id)
      .single();

    if (dsErr || !dataset) {
      return new Response(JSON.stringify({ error: "Dataset not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin/owner role
    const { data: role } = await supabase.rpc("get_user_org_role", {
      _user_id: user.id,
      _org_id: dataset.organization_id,
    });

    if (!role || !["owner", "admin"].includes(role)) {
      return new Response(JSON.stringify({ error: "Admin or owner role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify version exists
    const { data: version, error: vErr } = await supabase
      .from("dataset_versions")
      .select("id, version_number")
      .eq("dataset_id", dataset_id)
      .eq("version_number", version_number)
      .single();

    if (vErr || !version) {
      return new Response(JSON.stringify({ error: `Version ${version_number} not found` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deactivate all versions, activate target
    await supabase
      .from("dataset_versions")
      .update({ is_active: false })
      .eq("dataset_id", dataset_id);

    await supabase
      .from("dataset_versions")
      .update({ is_active: true })
      .eq("id", version.id);

    // Update dataset current_version
    await supabase
      .from("datasets")
      .update({ current_version: version_number })
      .eq("id", dataset_id);

    console.log(JSON.stringify({
      fn: "rollback-dataset-version",
      step: "complete",
      dataset_id,
      from_version: dataset.current_version,
      to_version: version_number,
      user_id: user.id,
    }));

    return new Response(
      JSON.stringify({ success: true, dataset_id, rolled_back_to: version_number }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
