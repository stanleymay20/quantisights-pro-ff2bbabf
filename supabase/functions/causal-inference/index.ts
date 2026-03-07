import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const svc = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, dataset_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await svc.rpc("is_org_member", { _user_id: user.id, _org_id: organization_id });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch metrics for causal analysis — scoped to dataset if provided
    let metricsQuery = svc.from("metrics")
      .select("metric_type, value, date")
      .eq("organization_id", organization_id)
      .order("date", { ascending: true })
      .limit(500);
    if (dataset_id) {
      metricsQuery = metricsQuery.eq("dataset_id", dataset_id);
    }
    const { data: metrics } = await metricsQuery;

    if (!metrics || metrics.length < 8) {
      return new Response(JSON.stringify({
        error: null,
        insufficient_data: true,
        message: "Minimum 8 data points required for causal inference",
        data_points: metrics?.length || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Group metrics by type and compute pairwise correlations
    const byType: Record<string, { values: number[]; dates: string[] }> = {};
    for (const m of metrics) {
      if (!byType[m.metric_type]) byType[m.metric_type] = { values: [], dates: [] };
      byType[m.metric_type].values.push(Number(m.value));
      byType[m.metric_type].dates.push(m.date);
    }

    const types = Object.keys(byType);
    
    // Compute Granger-like temporal precedence for causal edges
    const edges: { from: string; to: string; strength: number; lag: number; direction: string }[] = [];
    
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const a = byType[types[i]].values;
        const b = byType[types[j]].values;
        const minLen = Math.min(a.length, b.length);
        if (minLen < 4) continue;

        // Test if A predicts B (lag-1) vs B predicts A (lag-1)
        const abCorr = laggedCorrelation(a.slice(0, minLen), b.slice(0, minLen), 1);
        const baCorr = laggedCorrelation(b.slice(0, minLen), a.slice(0, minLen), 1);

        const strength = Math.max(Math.abs(abCorr), Math.abs(baCorr));
        const CAUSAL_THRESHOLD = parseFloat(Deno.env.get("CAUSAL_SIGNIFICANCE_THRESHOLD") || "0.3");
        if (strength > CAUSAL_THRESHOLD) {
          const causalDir = Math.abs(abCorr) > Math.abs(baCorr) ? "forward" : "reverse";
          edges.push({
            from: causalDir === "forward" ? types[i] : types[j],
            to: causalDir === "forward" ? types[j] : types[i],
            strength: Math.round(strength * 100) / 100,
            lag: 1,
            direction: abCorr > 0 || baCorr > 0 ? "positive" : "negative",
          });
        }
      }
    }

    // Build DAG nodes
    const nodes = types.map(t => ({
      id: t,
      label: t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      data_points: byType[t].values.length,
      mean: Math.round(byType[t].values.reduce((s, v) => s + v, 0) / byType[t].values.length * 100) / 100,
    }));

    // AI narrative
    let narrative = "";
    if (lovableApiKey && edges.length > 0) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are a causal inference specialist. Given a set of causal edges derived from temporal precedence analysis (Granger-like), explain the causal structure in 2-3 paragraphs. Distinguish between true causation vs. correlation. Highlight which variables are root causes vs. effects. Be specific about strengths and lag periods. Return plain text only.`,
              },
              {
                role: "user",
                content: `Causal DAG:\nNodes: ${JSON.stringify(nodes)}\nEdges: ${JSON.stringify(edges)}`,
              },
            ],
          }),
        });
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          narrative = aiData.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.error("AI causal narrative error:", e);
      }
    }

    // Confidence capping
    const sampleSize = metrics.length;
    const ceiling = sampleSize < 12 ? 60 : sampleSize < 30 ? 75 : 90;
    const rawConf = Math.min(edges.length > 0 ? 50 + edges.length * 5 : 30, 95);
    const cappedConf = Math.min(rawConf, ceiling);

    const result = {
      dag: { nodes, edges },
      narrative,
      confidence: cappedConf,
      sample_size: sampleSize,
      metric_types_analyzed: types.length,
      causal_chains: identifyCausalChains(edges),
    };

    // Store result
    await svc.from("causal_models").insert({
      organization_id,
      name: `Auto-generated ${new Date().toISOString().slice(0, 10)}`,
      dag_structure: result.dag,
      inference_results: result.causal_chains,
      confidence_score: cappedConf,
      sample_size: sampleSize,
      model_status: "computed",
      created_by: user.id,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("causal-inference error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function laggedCorrelation(x: number[], y: number[], lag: number): number {
  const n = x.length - lag;
  if (n < 3) return 0;
  const xSlice = x.slice(0, n);
  const ySlice = y.slice(lag, lag + n);
  const xMean = xSlice.reduce((s, v) => s + v, 0) / n;
  const yMean = ySlice.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - xMean;
    const dy = ySlice[i] - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : num / den;
}

function identifyCausalChains(edges: { from: string; to: string; strength: number }[]) {
  const chains: string[][] = [];
  const adj: Record<string, string[]> = {};
  for (const e of edges) {
    if (!adj[e.from]) adj[e.from] = [];
    adj[e.from].push(e.to);
  }
  const roots = Object.keys(adj).filter(n => !edges.some(e => e.to === n));
  for (const root of roots) {
    const visited = new Set<string>();
    const chain = [root];
    let current = root;
    while (adj[current]?.length && !visited.has(current)) {
      visited.add(current);
      current = adj[current][0];
      chain.push(current);
    }
    if (chain.length > 1) chains.push(chain);
  }
  return chains;
}
