import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Native connector pull — fetches data from external APIs (Stripe, GA4, HubSpot)
 * and normalizes into the metrics table.
 * 
 * Required secrets per connector:
 * - Stripe: STRIPE_SECRET_KEY (already configured)
 * - GA4: GA4_PROPERTY_ID, GA4_CREDENTIALS_JSON
 * - HubSpot: HUBSPOT_API_KEY
 */

interface ConnectorConfig {
  connector_type: string;
  data_source_id: string;
  organization_id: string;
  date_from?: string;
  date_to?: string;
}

/* ──────────────────── STRIPE PULL ──────────────────── */

async function pullStripe(
  config: ConnectorConfig,
  serviceClient: any,
): Promise<{ records: number; errors: string[] }> {
  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_KEY) return { records: 0, errors: ["STRIPE_SECRET_KEY not configured"] };

  const errors: string[] = [];
  const metrics: any[] = [];
  const now = new Date();
  const from = config.date_from ? new Date(config.date_from) : new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const to = config.date_to ? new Date(config.date_to) : now;

  try {
    // Fetch charges
    const chargesRes = await fetch(
      `https://api.stripe.com/v1/charges?created[gte]=${Math.floor(from.getTime() / 1000)}&created[lte]=${Math.floor(to.getTime() / 1000)}&limit=100`,
      { headers: { Authorization: `Bearer ${STRIPE_KEY}` } },
    );
    const charges = await chargesRes.json();

    if (charges.data) {
      // Group by month
      const byMonth: Record<string, number> = {};
      for (const c of charges.data) {
        if (c.status !== "succeeded") continue;
        const d = new Date(c.created * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        byMonth[key] = (byMonth[key] || 0) + c.amount / 100;
      }

      for (const [date, value] of Object.entries(byMonth)) {
        metrics.push({
          organization_id: config.organization_id,
          metric_type: "revenue",
          value,
          date,
          source_type: "connector",
          source_id: config.data_source_id,
          quality_score: 95,
        });
      }
    }

    // Fetch customers count
    const custRes = await fetch(
      `https://api.stripe.com/v1/customers?created[gte]=${Math.floor(from.getTime() / 1000)}&limit=100`,
      { headers: { Authorization: `Bearer ${STRIPE_KEY}` } },
    );
    const custs = await custRes.json();
    if (custs.data) {
      const byMonth: Record<string, number> = {};
      for (const c of custs.data) {
        const d = new Date(c.created * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        byMonth[key] = (byMonth[key] || 0) + 1;
      }
      for (const [date, value] of Object.entries(byMonth)) {
        metrics.push({
          organization_id: config.organization_id,
          metric_type: "customers",
          value,
          date,
          source_type: "connector",
          source_id: config.data_source_id,
          quality_score: 95,
        });
      }
    }
  } catch (err: unknown) {
    errors.push(`Stripe fetch error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Upsert metrics
  if (metrics.length > 0) {
    const { error } = await serviceClient.from("metrics").insert(metrics);
    if (error) errors.push(`DB insert: ${error.message}`);
  }

  // Update sync job
  await serviceClient.from("data_sources").update({
    last_synced_at: new Date().toISOString(),
  }).eq("id", config.data_source_id);

  return { records: metrics.length, errors };
}

/* ──────────────────── MAIN HANDLER ──────────────────── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config: ConnectorConfig = await req.json();
    const { connector_type, data_source_id, organization_id } = config;

    if (!connector_type || !data_source_id || !organization_id) {
      return new Response(JSON.stringify({ error: "connector_type, data_source_id, organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create sync job
    const { data: job } = await serviceClient.from("data_sync_jobs").insert({
      data_source_id,
      organization_id,
      status: "running",
      started_at: new Date().toISOString(),
    }).select().single();

    let result: { records: number; errors: string[] };

    switch (connector_type) {
      case "stripe":
        result = await pullStripe(config, serviceClient);
        break;
      default:
        result = { records: 0, errors: [`Unknown connector: ${connector_type}`] };
    }

    // Update sync job
    if (job) {
      await serviceClient.from("data_sync_jobs").update({
        status: result.errors.length > 0 ? "failed" : "completed",
        records_synced: result.records,
        error_message: result.errors.length > 0 ? result.errors.join("; ") : null,
        completed_at: new Date().toISOString(),
      }).eq("id", job.id);
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("connector-pull error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
