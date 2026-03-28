import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const { organization_id, role_type } = await req.json();

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const testPayload = {
      organization_id,
      role_type: role_type || "ceo",
      risk_score: 78,
      alerts: [
        {
          title: "Revenue: Below target warning (-18% deviation)",
          severity: "warning",
        },
      ],
      escalation_required: false,
      escalation_reason: null,
      top_action: "Review Q1 pipeline and adjust revenue forecast assumptions.",
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const res = await fetch(`${supabaseUrl}/functions/v1/send-executive-alert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(testPayload),
    });

    const result = await res.json();

    console.log(
      JSON.stringify({
        event: "test_executive_alert",
        organization_id,
        role_type: testPayload.role_type,
        result,
      }),
    );

    return new Response(
      JSON.stringify({
        test: true,
        payload_sent: testPayload,
        email_sent: result?.results?.email ?? null,
        slack_sent: result?.results?.slack ?? null,
        escalation_sent: result?.results?.escalation ?? null,
        raw_response: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("test-executive-alert error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
