import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";

/**
 * Validates the caller's JWT and returns their user ID.
 * Accepts the original request to produce correct CORS headers.
 */
export async function authenticateRequest(
  req: Request
): Promise<{ userId: string; response?: never } | { userId?: never; response: Response }> {
  const corsHeaders = getCorsHeaders(req);
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
 * Uses service role to check org membership via RPC for safety.
 */
export async function verifyOrgMembership(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  const { data } = await svc.rpc("is_org_member", {
    _user_id: userId,
    _org_id: organizationId,
  });

  return data === true;
}