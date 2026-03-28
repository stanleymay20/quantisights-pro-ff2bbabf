import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

const TIERS: Record<string, string> = {
  "prod_U4SdCda1dcZAtu": "starter",
  "prod_U4SdjQfflN6R1d": "growth",
  "prod_U1oN5CDeptb9uY": "enterprise",
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature")!;
    const event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);

    logStep("Event received", { type: event.type, id: event.id });

    // Idempotency: check if this Stripe event was already processed
    const { data: existingEvent } = await supabase
      .from("audit_log")
      .select("id")
      .eq("resource_type", "stripe_event")
      .eq("resource_id", event.id)
      .maybeSingle();

    if (existingEvent) {
      logStep("Duplicate event, skipping", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Record event processing in audit log for idempotency
    // Resolve org from event metadata when possible; use system org as fallback
    let auditOrgId: string | null = null;
    const eventObj = event.data?.object as any;
    if (eventObj?.metadata?.organization_id) {
      auditOrgId = eventObj.metadata.organization_id;
    }

    // Defer audit_log insert until org is resolved (after processing)
    const markEventProcessed = async (resolvedOrgId?: string) => {
      const orgId = resolvedOrgId || auditOrgId;
      if (!orgId) return; // Skip audit if no org can be resolved — idempotency still handled by check above
      await supabase.from("audit_log").insert({
        organization_id: orgId,
        actor_type: "system",
        action_type: "stripe_webhook",
        resource_type: "stripe_event",
        resource_id: event.id,
        payload: { event_type: event.type },
      }).then(({ error }) => {
        if (error) logStep("Audit log insert warning", { error: error.message });
      });
    };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const customerEmail = session.customer_details?.email ?? session.customer_email;

        if (!customerEmail) {
          logStep("No customer email found, skipping");
          break;
        }

        // Look up user by email using getUserByEmail (O(1) instead of listing all users)
        let authUser: any = null;
        try {
          const { data: userByEmail } = await supabase.auth.admin.getUserByEmail(customerEmail);
          authUser = userByEmail?.user;
        } catch {
          logStep("getUserByEmail lookup failed for", { customerEmail });
        }

        if (!authUser) {
          logStep("No auth user found for email", { customerEmail });
          break;
        }

        const { data: userProfile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", authUser.id)
          .single();

        if (!userProfile?.organization_id) {
          logStep("No org found for user", { userId: authUser.id });
          break;
        }

        // Fetch subscription details from Stripe
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const productId = sub.items.data[0].price.product as string;
        const tier = TIERS[productId] ?? "starter";
        const isTrial = sub.status === "trialing";

        const { error } = await supabase.from("subscriptions").upsert(
          {
            organization_id: userProfile.organization_id,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            tier,
            status: sub.status, // "active" or "trialing"
            price_id: sub.items.data[0].price.id,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            is_trial: isTrial,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          },
          { onConflict: "stripe_subscription_id" }
        );

        if (error) logStep("Upsert error", error);
        else logStep("Subscription upserted", { tier, orgId: userProfile.organization_id });
        await markEventProcessed(userProfile.organization_id);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const productId = sub.items.data[0].price.product as string;
        const tier = TIERS[productId] ?? "starter";
        const isTrial = sub.status === "trialing";

        const { error } = await supabase
          .from("subscriptions")
          .update({
            tier,
            status: sub.status,
            price_id: sub.items.data[0].price.id,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            is_trial: isTrial,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          })
          .eq("stripe_subscription_id", sub.id);

        if (error) logStep("Update error", error);
        else logStep("Subscription updated", { tier, status: sub.status });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", sub.id);

        if (error) logStep("Delete-update error", error);
        else logStep("Subscription canceled", { subId: sub.id });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
