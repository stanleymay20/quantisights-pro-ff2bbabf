/**
 * predict-outcome — Predict decision success probability using historical patterns.
 * 
 * This is NOT an LLM call. It uses:
 * 1. Base rate statistics from completed decisions
 * 2. Confidence calibration adjustment
 * 3. Decision type pattern matching
 * 4. Semantic similarity to past decisions (via vector search)
 * 5. Bayesian calibration model corrections
 * 
 * This is genuine predictive AI — learned from the organization's own data.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { generateEmbedding, searchSimilar } from "../_shared/embeddings.ts";
import { predictOutcome } from "../_shared/outcome-predictor.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, decision_id } = await req.json();
    if (!organization_id || !decision_id) {
      return new Response(JSON.stringify({ error: "organization_id and decision_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(supabaseUrl, serviceKey);

    // Verify membership
    const { data: isMember } = await svc.rpc("is_org_member", {
      _user_id: user.id, _org_id: organization_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the decision
    const { data: decision } = await svc
      .from("decision_ledger")
      .select("id, recommended_action, decision_type, capped_confidence, predicted_net_impact, notes")
      .eq("id", decision_id)
      .eq("organization_id", organization_id)
      .single();

    if (!decision) {
      return new Response(JSON.stringify({ error: "Decision not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Find semantically similar past decisions via vector search
    let similarDecisionIds: string[] = [];
    if (lovableApiKey) {
      try {
        const decisionText = `${decision.recommended_action} | ${decision.decision_type} | ${decision.notes || ""}`;
        const queryEmbedding = await generateEmbedding(decisionText, lovableApiKey);
        const similar = await searchSimilar(supabaseUrl, serviceKey, organization_id, queryEmbedding, {
          entityTypes: ["decision", "outcome"],
          limit: 10,
          minSimilarity: 0.3,
        });
        similarDecisionIds = similar.map(s => s.entity_id);
      } catch (e) {
        console.warn("Vector search failed, falling back to stats-only prediction:", e);
      }
    }

    // Step 2: Run predictive model
    const prediction = await predictOutcome(
      supabaseUrl,
      serviceKey,
      organization_id,
      decision,
      similarDecisionIds
    );

    // Step 3: Store prediction
    await svc.from("outcome_predictions").upsert({
      organization_id,
      decision_id,
      predicted_success_probability: prediction.predicted_success_probability,
      similar_decisions_count: prediction.similar_decisions_count,
      similar_decisions_avg_outcome: prediction.similar_decisions_avg_outcome,
      similar_decisions_success_rate: prediction.similar_decisions_success_rate,
      confidence_factors: prediction.confidence_factors as any,
      model_version: prediction.model_version,
    }, { onConflict: "decision_id" });

    return new Response(JSON.stringify(prediction), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predict-outcome error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
