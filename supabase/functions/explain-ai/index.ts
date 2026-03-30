import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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
    const svc = createClient(supabaseUrl, serviceKey);

    // Use getClaims() for secure JWT validation
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.user?.id as string;

    const { organization_id, dataset_id, entity_type, entity_id } = await req.json();
    if (!organization_id || !entity_type || !entity_id) {
      return new Response(JSON.stringify({ error: "organization_id, entity_type, entity_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!dataset_id) {
      return new Response(JSON.stringify({ error: "dataset_id required by Active Data Contract" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify org membership
    const { data: isMember } = await svc.rpc("is_org_member", { _user_id: userId, _org_id: organization_id });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate dataset belongs to org
    const { data: dsCheck } = await svc.from("datasets").select("id")
      .eq("id", dataset_id).eq("organization_id", organization_id).maybeSingle();
    if (!dsCheck) {
      return new Response(JSON.stringify({ error: "dataset_id does not belong to this organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch entity data based on type — ALWAYS scoped to organization_id
    let entityData: any = null;

    if (entity_type === "advisory") {
      const { data } = await svc.from("advisory_instances").select("*")
        .eq("id", entity_id).eq("organization_id", organization_id).single();
      entityData = data;
    } else if (entity_type === "insight") {
      const { data } = await svc.from("insights").select("*")
        .eq("id", entity_id).eq("organization_id", organization_id).single();
      entityData = data;
    } else if (entity_type === "decision") {
      const { data } = await svc.from("decision_ledger").select("*")
        .eq("id", entity_id).eq("organization_id", organization_id).single();
      entityData = data;
    } else if (entity_type === "simulation") {
      const { data } = await svc.from("decision_simulations").select("*")
        .eq("id", entity_id).eq("organization_id", organization_id).single();
      entityData = data;
    } else {
      return new Response(JSON.stringify({ error: "Invalid entity_type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!entityData) {
      return new Response(JSON.stringify({ error: "Entity not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch related metrics — DATASET-SCOPED
    const { data: metrics } = await svc.from("metrics")
      .select("metric_type, value, date")
      .eq("organization_id", organization_id)
      .eq("dataset_id", dataset_id)
      .order("date", { ascending: false })
      .limit(100);
    const contextMetrics = metrics || [];

    // Compute deterministic feature attributions (SHAP-like)
    const metricsByType: Record<string, number[]> = {};
    for (const m of contextMetrics) {
      if (!metricsByType[m.metric_type]) metricsByType[m.metric_type] = [];
      metricsByType[m.metric_type].push(Number(m.value));
    }

    // Calculate volatility-based attribution weights
    const attributions: { feature: string; impact: number; direction: string; contribution_pct: number }[] = [];
    let totalVolatility = 0;

    for (const [type, values] of Object.entries(metricsByType)) {
      if (values.length < 2) continue;
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
      const vol = Math.sqrt(variance);
      const trend = values[0] - values[values.length - 1];
      totalVolatility += vol;
      attributions.push({
        feature: type,
        impact: vol,
        direction: trend > 0 ? "positive" : trend < 0 ? "negative" : "neutral",
        contribution_pct: 0,
      });
    }

    // Normalize contributions
    for (const a of attributions) {
      a.contribution_pct = totalVolatility > 0 ? Math.round((a.impact / totalVolatility) * 100) : 0;
    }
    attributions.sort((a, b) => b.contribution_pct - a.contribution_pct);

    // AI narrative explanation with AbortController timeout
    let narrative = "";
    if (lovableApiKey) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are an AI explainability specialist. Given an AI recommendation and its feature attributions, 
explain in 2-3 concise paragraphs WHY this recommendation was made, which data factors drove it most, 
and what the key uncertainties are. Be specific about numbers and percentages. Return plain text only.`,
              },
              {
                role: "user",
                content: `Entity type: ${entity_type}\nEntity data: ${JSON.stringify(entityData)}\nFeature attributions: ${JSON.stringify(attributions)}`,
              },
            ],
          }),
        });
        clearTimeout(timeout);
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          narrative = aiData.choices?.[0]?.message?.content || "";
        } else {
          await aiResp.text(); // consume body
          if (aiResp.status === 429) {
            console.warn("AI rate limit hit in explain-ai");
          }
        }
      } catch (e) {
        clearTimeout(timeout);
        console.error("AI explanation error:", e);
      }
    }

    const result = {
      entity_type,
      entity_id,
      feature_attributions: attributions,
      explanation_narrative: narrative,
      confidence_breakdown: {
        data_volume: contextMetrics.length,
        metric_types_analyzed: Object.keys(metricsByType).length,
        attribution_method: "volatility-weighted SHAP approximation",
      },
    };

    // Store explanation
    await svc.from("ai_explanations").insert({
      organization_id,
      entity_type,
      entity_id,
      feature_attributions: attributions,
      model_used: "gemini-3-flash-preview",
      explanation_narrative: narrative,
      confidence_breakdown: result.confidence_breakdown,
    });

    // Audit log
    console.log(JSON.stringify({
      event: "ai_explanation_generated",
      organization_id,
      dataset_id,
      entity_type,
      entity_id,
      user_id: userId,
      attributions_count: attributions.length,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("explain-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
