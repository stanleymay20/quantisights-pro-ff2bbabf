/**
 * similar-decisions — Retrieve similar past decisions using deterministic embeddings.
 * Returns similar decisions/outcomes with historical performance metadata.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { generateEmbedding, searchSimilar } from "../_shared/embeddings.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;

  try {
    const { organization_id, query_text } = await req.json();
    if (!organization_id || !query_text) {
      return new Response(JSON.stringify({ error: "organization_id and query_text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMember = await verifyOrgMembership(auth.userId, organization_id);
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const queryEmbedding = await generateEmbedding(query_text);
    const results = await searchSimilar(supabaseUrl, serviceKey, organization_id, queryEmbedding, {
      entityTypes: ["decision", "outcome", "insight"],
      limit: 10,
      minSimilarity: 0.35,
    });

    // Compute historical performance from outcomes
    const outcomes = results.filter(r => r.entity_type === "outcome");
    let historicalSuccessRate: number | null = null;
    let avgAccuracy: number | null = null;
    let confidenceAdjustment = 0;

    if (outcomes.length >= 2) {
      const successCount = outcomes.filter(r => {
        const delta = (r.metadata as any)?.outcome_delta;
        return delta != null && delta > 0;
      }).length;
      historicalSuccessRate = Math.round((successCount / outcomes.length) * 100);

      const accuracies = outcomes
        .map(r => (r.metadata as any)?.accuracy_score)
        .filter((a): a is number => a != null);
      if (accuracies.length > 0) {
        avgAccuracy = Math.round(accuracies.reduce((s, v) => s + v, 0) / accuracies.length);
        if (avgAccuracy < 50) confidenceAdjustment = -10;
        else if (avgAccuracy < 70) confidenceAdjustment = -5;
        else if (avgAccuracy > 85) confidenceAdjustment = 5;
      }
    }

    return new Response(JSON.stringify({
      similar: results,
      historical_success_rate: historicalSuccessRate,
      avg_accuracy: avgAccuracy,
      confidence_adjustment: confidenceAdjustment,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
