import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Adaptive Calibration Engine
 * 
 * This is the layer that makes Quantivis cross from "interprets" to "learns."
 * 
 * It analyzes completed decisions with measured outcomes, fits a calibration
 * curve per confidence band, computes correction factors, and stores them
 * so future confidence outputs are automatically adjusted.
 * 
 * The correction formula:
 *   adjusted_confidence = raw_confidence + band_correction[band]
 * 
 * Where band_correction = actual_success_rate - mean_predicted_confidence
 * for each 10-point confidence band.
 */

interface BandData {
  predicted_sum: number;
  actual_successes: number;
  count: number;
}

function computeCalibrationModel(decisions: any[]) {
  // Filter to completed decisions with confidence and outcome data
  const calibrated = decisions.filter(
    (d) =>
      d.execution_status === "completed" &&
      d.capped_confidence != null &&
      d.outcome_delta != null
  );

  if (calibrated.length < 5) {
    return { insufficient: true, count: calibrated.length };
  }

  // Build 10-point confidence bands: 0-10, 10-20, ..., 90-100
  const bands: Record<string, BandData> = {};
  for (let b = 0; b < 100; b += 10) {
    const key = `${b}-${b + 10}`;
    bands[key] = { predicted_sum: 0, actual_successes: 0, count: 0 };
  }

  calibrated.forEach((d) => {
    const conf = Math.min(99, Math.max(0, Number(d.capped_confidence ?? d.raw_confidence ?? 50)));
    const bandStart = Math.floor(conf / 10) * 10;
    const key = `${bandStart}-${bandStart + 10}`;
    const wasPositive = (Number(d.outcome_delta) || 0) >= 0 ? 1 : 0;

    bands[key].predicted_sum += conf;
    bands[key].actual_successes += wasPositive;
    bands[key].count++;
  });

  // Compute corrections per band
  const band_corrections: Record<string, number> = {};
  const band_sample_sizes: Record<string, number> = {};
  let totalAbsError = 0;
  let bandsWithData = 0;
  let overconfidentBands = 0;
  let underconfidentBands = 0;

  for (const [key, band] of Object.entries(bands)) {
    if (band.count < 2) continue; // Need minimum 2 decisions per band

    const meanPredicted = band.predicted_sum / band.count;
    const actualRate = (band.actual_successes / band.count) * 100;
    const correction = Math.round((actualRate - meanPredicted) * 10) / 10;

    band_corrections[key] = correction;
    band_sample_sizes[key] = band.count;
    totalAbsError += Math.abs(correction);
    bandsWithData++;

    if (correction < -3) overconfidentBands++;
    if (correction > 3) underconfidentBands++;
  }

  const mae = bandsWithData > 0 ? Math.round((totalAbsError / bandsWithData) * 10) / 10 : 0;

  // Overall bias direction
  let biasDirection = "neutral";
  if (overconfidentBands > underconfidentBands && overconfidentBands >= 2) {
    biasDirection = "overconfident";
  } else if (underconfidentBands > overconfidentBands && underconfidentBands >= 2) {
    biasDirection = "underconfident";
  }

  // Overall calibration score: 100 - MAE (higher = better calibrated)
  const calibrationScore = Math.max(0, Math.round(100 - mae));

  return {
    insufficient: false,
    band_corrections,
    band_sample_sizes,
    overall_calibration_score: calibrationScore,
    overall_bias_direction: biasDirection,
    mean_absolute_error: mae,
    total_decisions_analyzed: calibrated.length,
    confidence_bands_count: bandsWithData,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const svc = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await svc.rpc("is_org_member", {
      _user_id: user.id,
      _org_id: organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all decisions for this org
    const { data: decisions } = await svc
      .from("decision_ledger")
      .select("*")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: true })
      .limit(500);

    if (!decisions || decisions.length === 0) {
      return new Response(
        JSON.stringify({
          model: null,
          insufficient_data: true,
          message: "No decisions found",
          decisions_count: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = computeCalibrationModel(decisions);

    if (result.insufficient) {
      return new Response(
        JSON.stringify({
          model: null,
          insufficient_data: true,
          message: `Need at least 5 completed decisions with outcomes. Currently: ${result.count}`,
          decisions_count: result.count,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate AI narrative about the calibration pattern
    let aiNarrative = "";
    if (lovableApiKey) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: `You are an expert in decision science calibration. Given calibration band corrections and overall stats, write a concise 2-3 sentence executive summary explaining: 1) Whether the organization tends to be overconfident or underconfident, 2) Which confidence bands need the most correction, 3) One specific actionable recommendation. Be direct and quantitative. Return plain text only.`,
              },
              {
                role: "user",
                content: JSON.stringify({
                  band_corrections: result.band_corrections,
                  band_sample_sizes: result.band_sample_sizes,
                  overall_bias: result.overall_bias_direction,
                  calibration_score: result.overall_calibration_score,
                  mae: result.mean_absolute_error,
                  total_decisions: result.total_decisions_analyzed,
                }),
              },
            ],
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiNarrative = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("AI narrative error:", e);
      }
    }

    // Get current model version
    const { data: existing } = await svc
      .from("calibration_models")
      .select("model_version")
      .eq("organization_id", organization_id)
      .order("computed_at", { ascending: false })
      .limit(1);

    const nextVersion = (existing?.[0]?.model_version ?? 0) + 1;

    // Store the new calibration model
    const modelRecord = {
      organization_id,
      band_corrections: result.band_corrections,
      band_sample_sizes: result.band_sample_sizes,
      overall_calibration_score: result.overall_calibration_score,
      overall_bias_direction: result.overall_bias_direction,
      total_decisions_analyzed: result.total_decisions_analyzed,
      model_version: nextVersion,
      confidence_bands_count: result.confidence_bands_count,
      mean_absolute_error: result.mean_absolute_error,
      ai_narrative: aiNarrative || null,
    };

    const { error: insertError } = await svc
      .from("calibration_models")
      .insert(modelRecord);

    if (insertError) {
      console.error("Failed to store calibration model:", insertError);
    }

    return new Response(
      JSON.stringify({
        model: {
          ...modelRecord,
          ai_narrative: aiNarrative,
        },
        insufficient_data: false,
        computed_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("adaptive-calibration error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
