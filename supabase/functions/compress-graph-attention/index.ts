// Phase 5E — Executive Attention Compression with 4-level abstraction hierarchy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUDGETS: Record<string, number> = { executive: 5, operations: 12, governance: 8, board: 5 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { organization_id } = await req.json().catch(() => ({}));
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull top-scored nodes
    const { data: scores } = await supabase
      .from("graph_topology_scores")
      .select("node_id,centrality_score,propagation_risk,blast_radius_score,conflict_density,escalation_density,operational_criticality")
      .eq("organization_id", organization_id)
      .order("blast_radius_score", { ascending: false })
      .limit(60);
    const { data: nodes } = await supabase
      .from("operational_graph_nodes")
      .select("id,node_type,title,summary,operational_state")
      .eq("organization_id", organization_id);
    const nodeMap: Record<string, any> = {};
    for (const n of (nodes ?? []) as any[]) nodeMap[n.id] = n;

    if (!scores?.length) {
      return new Response(JSON.stringify({ ok: true, views: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Candidate priorities (composite)
    const candidates = (scores as any[]).map((s) => {
      const n = nodeMap[s.node_id];
      const priority =
        s.blast_radius_score * 0.35 +
        s.propagation_risk * 0.25 +
        s.operational_criticality * 0.2 +
        s.escalation_density * 0.1 +
        s.conflict_density * 0.1;
      return { score: s, node: n, priority };
    }).filter(c => c.node).sort((a, b) => b.priority - a.priority);

    // Suppress duplicates by node_type + title prefix
    const seenSig = new Set<string>();
    const deduped: typeof candidates = [];
    const suppressions: any[] = [];
    for (const c of candidates) {
      const sig = `${c.node.node_type}:${(c.node.title ?? "").slice(0, 32).toLowerCase()}`;
      if (seenSig.has(sig)) {
        suppressions.push({
          organization_id, node_id: c.node.id, event_type: "suppressed",
          reason: "duplicate signature in attention candidates", actor: "compress-graph-attention",
          new_state: { sig }, prior_state: {},
        });
        continue;
      }
      seenSig.add(sig);
      deduped.push(c);
    }

    // Low-impact suppression: priority < 25
    const filtered = deduped.filter((c) => {
      if (c.priority < 25) {
        suppressions.push({
          organization_id, node_id: c.node.id, event_type: "suppressed",
          reason: `low priority ${c.priority.toFixed(1)} < 25`, actor: "compress-graph-attention",
          new_state: { priority: c.priority }, prior_state: {},
        });
        return false;
      }
      return true;
    });

    // Materialize per-persona views with 4-level hierarchy
    const inserts: any[] = [];
    for (const persona of Object.keys(BUDGETS)) {
      const budget = BUDGETS[persona];
      const slice = filtered.slice(0, budget);
      let level1 = 0;
      for (const c of slice) {
        const lvl = level1 < Math.ceil(budget / 3) ? 1 : level1 < Math.ceil((budget * 2) / 3) ? 2 : 3;
        level1++;
        inserts.push({
          organization_id,
          persona,
          abstraction_level: lvl,
          title: c.node.title,
          compressed_summary:
            `${c.node.node_type.toUpperCase()} — blast radius ${c.score.blast_radius_score.toFixed(0)}, ` +
            `propagation risk ${c.score.propagation_risk.toFixed(0)}, criticality ${c.score.operational_criticality.toFixed(0)}`,
          priority_score: c.priority,
          supporting_nodes: [{ node_id: c.node.id, type: c.node.node_type }],
          supporting_edges: [],
        });
      }
    }

    // Replace today's views (idempotent)
    await supabase.from("graph_attention_views")
      .delete()
      .eq("organization_id", organization_id)
      .gt("expires_at", new Date().toISOString());

    if (inserts.length) await supabase.from("graph_attention_views").insert(inserts);
    if (suppressions.length) await supabase.from("graph_governance_events").insert(suppressions);

    const compression_ratio = candidates.length > 0 ? inserts.length / candidates.length : 0;
    await supabase.from("graph_observability").upsert(
      {
        organization_id,
        day: new Date().toISOString().slice(0, 10),
        compression_ratio,
      },
      { onConflict: "organization_id,day" },
    );

    return new Response(
      JSON.stringify({
        ok: true,
        views_generated: inserts.length,
        suppressed: suppressions.length,
        compression_ratio,
        duration_ms: Date.now() - started,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("compress-graph-attention error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
