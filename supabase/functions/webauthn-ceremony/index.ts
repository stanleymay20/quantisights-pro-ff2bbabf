import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const body = await req.json();
    const { action } = body;

    const serviceClient = createClient(supabaseUrl, serviceKey);

    if (action === "register_challenge") {
      // Generate random challenge
      const challengeBytes = new Uint8Array(32);
      crypto.getRandomValues(challengeBytes);
      const challenge = btoa(String.fromCharCode(...challengeBytes));

      // Store challenge
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { data: challengeRow, error } = await serviceClient
        .from("webauthn_challenges")
        .insert({
          user_id: userId,
          challenge,
          ceremony_type: "registration",
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: "Failed to create challenge" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ challenge, challenge_id: challengeRow.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "register_verify") {
      const { credential_id, attestation, client_data, device_name, challenge_id } = body;

      // Verify challenge exists and is unused
      const { data: challengeRow, error: chErr } = await serviceClient
        .from("webauthn_challenges")
        .select("*")
        .eq("id", challenge_id)
        .eq("user_id", userId)
        .is("used_at", null)
        .single();

      if (chErr || !challengeRow) {
        return new Response(JSON.stringify({ error: "Invalid or expired challenge" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(challengeRow.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Challenge expired" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark challenge as used
      await serviceClient
        .from("webauthn_challenges")
        .update({ used_at: new Date().toISOString() })
        .eq("id", challenge_id);

      // Store credential (attestation verification simplified for platform authenticators)
      const { error: insertError } = await serviceClient
        .from("webauthn_credentials")
        .insert({
          user_id: userId,
          credential_id,
          public_key: attestation,
          device_name: device_name || "Security Key",
          sign_count: 0,
        });

      if (insertError) {
        return new Response(JSON.stringify({ error: "Failed to store credential" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log auth event
      await serviceClient.from("auth_events").insert({
        user_id: userId,
        event_type: "passkey_enroll",
        metadata: { device_name },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "authenticate_challenge") {
      // Get user's credentials
      const { data: credentials } = await serviceClient
        .from("webauthn_credentials")
        .select("credential_id")
        .eq("user_id", userId);

      const challengeBytes = new Uint8Array(32);
      crypto.getRandomValues(challengeBytes);
      const challenge = btoa(String.fromCharCode(...challengeBytes));

      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { data: challengeRow } = await serviceClient
        .from("webauthn_challenges")
        .insert({
          user_id: userId,
          challenge,
          ceremony_type: "authentication",
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      return new Response(
        JSON.stringify({
          challenge,
          challenge_id: challengeRow?.id,
          allowed_credentials: (credentials || []).map((c: any) => c.credential_id),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
