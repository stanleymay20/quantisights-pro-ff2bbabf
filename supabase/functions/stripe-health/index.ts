import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const out: Record<string, unknown> = {
    key_present: !!key,
    key_prefix: key ? key.slice(0, 7) : null,
    mode: key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : key.startsWith("rk_") ? "restricted" : "unknown",
  };
  try {
    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
    const acct = await stripe.accounts.retrieve();
    out.ok = true;
    out.account_id = acct.id;
    out.country = acct.country;
    out.charges_enabled = acct.charges_enabled;
    out.details_submitted = acct.details_submitted;
  } catch (e) {
    out.ok = false;
    out.error = e instanceof Error ? e.message : String(e);
    out.type = (e as any)?.type ?? null;
    out.code = (e as any)?.code ?? null;
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
