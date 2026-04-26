import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const ALLOWED_ORIGINS = [
  "https://quantisights-pro.lovable.app",
  "https://id-preview--28b43e06-9231-4c54-bc18-a49be01a6516.lovable.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return origin;
  return ALLOWED_ORIGINS[0]; // fallback to production
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { priceId } = await req.json();
    if (!priceId) throw new Error("priceId is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Check if customer already had a trial (only offer trial to new subscribers)
    let hadTrial = false;
    if (customerId) {
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 10,
      });
      hadTrial = existingSubs.data.some(
        (s: any) => s.trial_start !== null || s.status === "trialing"
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: hadTrial ? undefined : { trial_period_days: 14 },
      success_url: `${getAllowedOrigin(req)}/dashboard?checkout=success`,
      cancel_url: `${getAllowedOrigin(req)}/pricing`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
