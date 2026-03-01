import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConnectorConfig {
  connector_type: string;
  data_source_id: string;
  organization_id: string;
  date_from?: string;
  date_to?: string;
}

/* ──────────────────── STRIPE HELPERS ──────────────────── */

async function stripeFetchAll(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<{ data: any[]; errors: string[] }> {
  const allData: any[] = [];
  const errors: string[] = [];
  let startingAfter: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const qs = new URLSearchParams({ ...params, limit: "100" });
    if (startingAfter) qs.set("starting_after", startingAfter);

    const res = await fetch(`https://api.stripe.com/v1/${endpoint}?${qs}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const body = await res.text();
      errors.push(`Stripe ${endpoint} HTTP ${res.status}: ${body.substring(0, 200)}`);
      break;
    }

    const json = await res.json();
    if (!json.data || !Array.isArray(json.data)) {
      errors.push(`Stripe ${endpoint}: unexpected response shape`);
      break;
    }

    allData.push(...json.data);
    hasMore = json.has_more === true;
    if (hasMore && json.data.length > 0) {
      startingAfter = json.data[json.data.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  return { data: allData, errors };
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

  const fromTs = Math.floor(from.getTime() / 1000).toString();
  const toTs = Math.floor(to.getTime() / 1000).toString();

  try {
    // Fetch ALL charges with pagination
    const chargesResult = await stripeFetchAll("charges", {
      "created[gte]": fromTs,
      "created[lte]": toTs,
    }, STRIPE_KEY);
    errors.push(...chargesResult.errors);

    if (chargesResult.data.length > 0) {
      const byMonth: Record<string, number> = {};
      for (const c of chargesResult.data) {
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

    // Fetch ALL customers with pagination
    const custResult = await stripeFetchAll("customers", {
      "created[gte]": fromTs,
    }, STRIPE_KEY);
    errors.push(...custResult.errors);

    if (custResult.data.length > 0) {
      const byMonth: Record<string, number> = {};
      for (const c of custResult.data) {
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

  // UPSERT metrics (safe for re-runs — no duplicates)
  if (metrics.length > 0) {
    const { error } = await serviceClient.from("metrics").upsert(metrics, {
      onConflict: "organization_id,metric_type,date,source_id",
      ignoreDuplicates: false,
    });
    if (error) errors.push(`DB upsert: ${error.message}`);
  }

  // Update data source sync timestamp
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
