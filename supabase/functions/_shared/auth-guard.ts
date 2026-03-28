import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";

const corsHeaders = getCorsHeaders();

/**
 * Validates the caller's JWT and returns their user ID.
 * Returns null + sends 401 response if auth fails.
 */
export async function authenticateRequest(
  req: Request
): Promise<{ userId: string; response?: never } | { userId?: never; response: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return {
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  return { userId: user.id };
}

/**
 * Verifies that the authenticated user is a member of the given organization.
 * Uses service role to check org membership.
 */
export async function verifyOrgMembership(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const resp = await fetch(
    `${supabaseUrl}/rest/v1/organization_members?user_id=eq.${userId}&organization_id=eq.${organizationId}&select=id&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );

  const members = await resp.json();
  return Array.isArray(members) && members.length > 0;
}
