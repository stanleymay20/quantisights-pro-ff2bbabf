import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { ip_address, user_agent } = await req.json();

    // Get user's recent login history
    const { data: recentLogins } = await supabase
      .from("audit_log")
      .select("ip_address, payload, created_at")
      .eq("actor_id", user.id)
      .eq("action_type", "login")
      .order("created_at", { ascending: false })
      .limit(20);

    const anomalies: string[] = [];

    if (recentLogins && recentLogins.length > 0) {
      // Check for new IP
      const knownIPs = new Set(recentLogins.map((l) => l.ip_address).filter(Boolean));
      if (ip_address && knownIPs.size > 0 && !knownIPs.has(ip_address)) {
        anomalies.push("new_ip");
      }

      // Check for new user agent
      const knownAgents = new Set(
        recentLogins.map((l) => (l.payload as any)?.user_agent).filter(Boolean)
      );
      if (user_agent && knownAgents.size > 0 && !knownAgents.has(user_agent)) {
        anomalies.push("new_device");
      }

      // Check for rapid logins (>5 in last hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recentCount = recentLogins.filter((l) => l.created_at > oneHourAgo).length;
      if (recentCount >= 5) {
        anomalies.push("rapid_logins");
      }
    }

    // Log the current login
    const orgId = user.user_metadata?.organization_id;
    if (orgId) {
      await supabase.from("audit_log").insert({
        organization_id: orgId,
        actor_id: user.id,
        actor_type: "user",
        action_type: "login",
        resource_type: "session",
        ip_address: ip_address || null,
        payload: { user_agent: user_agent || null, anomalies },
      });
    }

    return new Response(
      JSON.stringify({
        anomalies,
        is_anomalous: anomalies.length > 0,
        message: anomalies.length > 0
          ? `Unusual login detected: ${anomalies.join(", ")}`
          : "Login looks normal",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
