import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { organization_id, dataset_id, metric_type, horizon_months = 6, dry_run } = await req.json();
    if (!organization_id || !metric_type) {
      return new Response(JSON.stringify({ error: "organization_id and metric_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!dataset_id) {
      return new Response(JSON.stringify({ error: "dataset_id required by Active Data Contract" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate dataset belongs to org
    const { data: dsCheck } = await serviceClient
      .from("datasets")
      .select("id")
      .eq("id", dataset_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (!dsCheck) {
      return new Response(JSON.stringify({ error: "dataset_id does not belong to this organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dry run: validate contract only
    if (dry_run) {
      return new Response(JSON.stringify({ dry_run: true, status: "PASS", dataset_id, organization_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch historical metrics — dataset-scoped (REQUIRED)
    const { data: metrics, error: mErr } = await userClient
      .from("metrics")
      .select("value, date")
      .eq("organization_id", organization_id)
      .eq("dataset_id", dataset_id)
      .eq("metric_type", metric_type)
      .order("date", { ascending: true });

    if (mErr) throw mErr;
    if (!metrics || metrics.length < 3) {
      return new Response(JSON.stringify({
        error: "Insufficient data",
        detail: `Need at least 3 data points for ${metric_type}, found ${metrics?.length || 0}`,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use AI to generate forecasts
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const historicalSummary = metrics.map((m: any) => `${m.date}: ${m.value}`).join("\n");

    const aiController = new AbortController();
    const aiTimeout = setTimeout(() => aiController.abort(), 30000);
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: aiController.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: `You are a quantitative analyst. Given the following monthly time series for "${metric_type}", produce a ${horizon_months}-month forecast.

Historical data:
${historicalSummary}

Return ONLY valid JSON with this exact structure:
{
  "predictions": [{"date": "YYYY-MM-DD", "value": <number>, "lower_bound": <number>, "upper_bound": <number>}],
  "trend_direction": "growing" | "declining" | "stable" | "volatile",
  "seasonality_detected": true | false,
  "seasonality_period": <number or null>,
  "growth_rate_pct": <number>,
  "confidence_narrative": "<one sentence about forecast reliability>",
  "mape_estimate": <number between 0 and 100>
}

Use exponential smoothing with trend and seasonal decomposition. Include 80% prediction intervals as lower/upper bounds.`,
        }],
      }),
    });

    clearTimeout(aiTimeout);
    if (!aiRes.ok) throw new Error(`AI service error: ${aiRes.status}`);
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI returned invalid format");

    const forecast = JSON.parse(jsonMatch[0]);

    // Store in database — dataset-scoped
    await serviceClient.from("forecast_results").insert({
      organization_id,
      dataset_id,
      metric_type,
      forecast_horizon_months: horizon_months,
      model_used: "ai-exponential-smoothing",
      predictions: forecast.predictions,
      seasonality_detected: forecast.seasonality_detected,
      trend_direction: forecast.trend_direction,
      mape: forecast.mape_estimate,
      created_by: user.id,
    });

    return new Response(JSON.stringify({
      ...forecast,
      historical: metrics,
      metric_type,
      horizon_months,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("predictive-forecast error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
