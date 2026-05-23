/**
 * Executive Brief Generator
 *
 * Synthesizes executive operational intelligence from the prior 7 days:
 *   - high-pressure intelligence items
 *   - unresolved advisories
 *   - routed decisions
 *   - operational failures
 *
 * Produces:
 *   - executive brief stored in executive_briefs (role_type='ceo', generated_by='ai')
 *   - executive_interventions for items above pressure tiers
 *   - executive_cross_domain_narratives (combined-pressure narratives)
 *   - executive_exposure_snapshots (per-org)
 *   - executive_intel_observability snapshot for today
 *
 * Confidence capped at 85%. LLM only for narrative prose; structure is deterministic.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { isValidUUID } from "../_shared/input-validation.ts";

interface Item {
  id: string;
  severity: string;
  urgency: string;
  domain: string | null;
  geography: string[];
  entities: unknown[];
  title: string | null;
  summary: string | null;
  ingested_at: string;
  global_criticality_score: number;
  status: string;
  intelligence_relevance_scores?:
    | { decision_pressure_score: number; business_impact_score: number; operational_urgency_score: number; organization_relevance_score: number }
    | { decision_pressure_score: number; business_impact_score: number; operational_urgency_score: number; organization_relevance_score: number }[]
    | null;
}

const SEV_RANK = { low: 1, medium: 2, high: 3, critical: 4 } as const;
const URG_RANK = { low: 1, normal: 2, high: 3, immediate: 4 } as const;

function tierFor(score: number): "low" | "elevated" | "high" | "critical" {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "elevated";
  return "low";
}

function pickScore(it: Item): { pressure: number; impact: number; urgency: number; relevance: number } {
  const s = Array.isArray(it.intelligence_relevance_scores)
    ? it.intelligence_relevance_scores[0]
    : it.intelligence_relevance_scores;
  return {
    pressure: s?.decision_pressure_score ?? 0,
    impact: s?.business_impact_score ?? 0,
    urgency: s?.operational_urgency_score ?? 0,
    relevance: s?.organization_relevance_score ?? 0,
  };
}

async function llmNarrative(prompt: string, fallback: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return fallback;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return fallback;
    const j = await r.json();
    return String(j.choices?.[0]?.message?.content || fallback).slice(0, 1200);
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const cors = getCorsHeaders(req);
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;

  let body: { organization_id: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!isValidUUID(body.organization_id)) return json({ error: "Invalid organization_id" }, 400);
  if (!(await verifyOrgMembership(auth.userId, body.organization_id))) return json({ error: "Not a member" }, 403);

  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const orgId = body.organization_id;
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();

  // 1. High-pressure intelligence items (last 7 days)
  const { data: rawItems } = await svc
    .from("aicis_intelligence_items")
    .select("id,severity,urgency,domain,geography,entities,title,summary,ingested_at,global_criticality_score,status,intelligence_relevance_scores(decision_pressure_score,business_impact_score,operational_urgency_score,organization_relevance_score)")
    .eq("organization_id", orgId)
    .gte("ingested_at", since)
    .not("status", "in", "(resolved,archived)")
    .order("ingested_at", { ascending: false })
    .limit(400);

  const items = (rawItems || []) as unknown as Item[];

  // 2. Unresolved advisories
  const { data: advisories } = await svc
    .from("intelligence_advisories")
    .select("id,title,body,kind,intelligence_item_id,confidence,created_at")
    .eq("organization_id", orgId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  // 3. Routed decisions (recent ledger)
  const { data: decisions } = await svc
    .from("decision_ledger")
    .select("id,title,status,execution_status,created_at,outcome_delta")
    .eq("organization_id", orgId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  // 4. Operational failures (execution interventions, last 7d)
  const { data: failures } = await svc
    .from("execution_interventions")
    .select("id,intervention_type,trigger_reason,created_at,resolved")
    .eq("organization_id", orgId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50);

  // ─── Decision Pressure Engine ───
  type Ranked = { it: Item; pressure: number; tier: ReturnType<typeof tierFor>; factors: Record<string, number> };
  const ranked: Ranked[] = items.map((it) => {
    const s = pickScore(it);
    // Uncertainty multiplier from data freshness (newer = more uncertain action window)
    const ageHrs = (Date.now() - new Date(it.ingested_at).getTime()) / 3600_000;
    const uncertainty = Math.max(0.7, Math.min(1.2, 1.2 - Math.log10(1 + ageHrs) * 0.05));
    // Composite: severity * urgency * impact * relevance * uncertainty, normalized
    const sev = SEV_RANK[it.severity as keyof typeof SEV_RANK] ?? 1;
    const urg = URG_RANK[it.urgency as keyof typeof URG_RANK] ?? 1;
    const composite = (sev / 4) * (urg / 4) * (s.impact / 100) * Math.max(s.relevance / 100, 0.1) * uncertainty;
    const pressure = Math.round(Math.min(100, composite * 100 + s.pressure * 0.2));
    return {
      it,
      pressure,
      tier: tierFor(pressure),
      factors: {
        severity: sev, urgency: urg,
        business_impact: s.impact, organizational_relevance: s.relevance,
        upstream_pressure: s.pressure, uncertainty_multiplier: Number(uncertainty.toFixed(2)),
      },
    };
  });
  ranked.sort((a, b) => b.pressure - a.pressure);

  const top = ranked.slice(0, 12);
  const criticalCount = ranked.filter((r) => r.tier === "critical").length;
  const highCount = ranked.filter((r) => r.tier === "high").length;

  // ─── Interventions: top items at high/critical pressure (idempotent by intelligence id) ───
  const interventionRows: Array<Record<string, unknown>> = [];
  for (const r of ranked.filter((x) => x.tier === "high" || x.tier === "critical").slice(0, 10)) {
    const { data: existing } = await svc
      .from("executive_interventions")
      .select("id")
      .eq("organization_id", orgId)
      .contains("supporting_intelligence_ids", [r.it.id])
      .in("escalation_status", ["pending", "acknowledged", "assigned"])
      .limit(1);
    if (existing && existing.length > 0) continue;

    interventionRows.push({
      organization_id: orgId,
      intervention_type: r.it.domain || "operational",
      severity: r.tier === "critical" ? "critical" : "high",
      recommended_action:
        r.tier === "critical"
          ? `Escalate "${(r.it.title ?? "intelligence signal").slice(0, 80)}" to executive sponsor within 24h.`
          : `Acknowledge and assign owner for "${(r.it.title ?? "intelligence signal").slice(0, 80)}" within 72h.`,
      rationale: `Pressure ${r.pressure}/100. Severity=${r.it.severity}, urgency=${r.it.urgency}, impact=${r.factors.business_impact}, relevance=${r.factors.organizational_relevance}.`,
      supporting_intelligence_ids: [r.it.id],
      decision_pressure_score: r.pressure,
      pressure_tier: r.tier,
      scoring_factors: r.factors,
    });
  }
  let interventionsInserted = 0;
  if (interventionRows.length > 0) {
    const { data: ins } = await svc.from("executive_interventions").insert(interventionRows).select("id");
    interventionsInserted = ins?.length ?? 0;
  }

  // ─── Cross-domain narrative ───
  const domainGroups = new Map<string, Ranked[]>();
  for (const r of ranked) {
    const d = (r.it.domain || "general").toLowerCase();
    if (!domainGroups.has(d)) domainGroups.set(d, []);
    domainGroups.get(d)!.push(r);
  }
  const activeDomains = [...domainGroups.entries()]
    .filter(([_, arr]) => arr.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4);

  let narrativeRowId: string | null = null;
  if (activeDomains.length >= 2) {
    const combinedPressure = Math.round(
      activeDomains.reduce((s, [_, arr]) => s + arr.reduce((a, r) => a + r.pressure, 0) / arr.length, 0) /
      activeDomains.length
    );
    const supportingIds = activeDomains.flatMap(([_, arr]) => arr.slice(0, 5).map((r) => r.it.id));
    const fallbackText = `${activeDomains.map(([d, arr]) => `${d} (${arr.length} signals)`).join(" + ")} are compounding. Combined pressure: ${combinedPressure}/100. Projected window: ${Math.max(7, 30 - combinedPressure / 5)} days.`;
    const narrative = await llmNarrative(
      `Write a single concise executive risk narrative (max 2 sentences, no preamble, no markdown) describing how these domains compound: ${activeDomains.map(([d, arr]) => `${d}=${arr.length}`).join(", ")}. Combined pressure ${combinedPressure}/100. Sample signals: ${top.slice(0, 5).map((r) => r.it.title).filter(Boolean).join("; ")}.`,
      fallbackText
    );
    const { data: nrow } = await svc
      .from("executive_cross_domain_narratives")
      .insert({
        organization_id: orgId,
        narrative,
        narrative_strength: Math.min(100, combinedPressure + activeDomains.length * 5),
        affected_domains: activeDomains.map(([d]) => d),
        supporting_signal_ids: supportingIds,
        projected_window_days: Math.max(7, Math.round(30 - combinedPressure / 5)),
        combined_pressure_score: combinedPressure,
        metadata: { domain_counts: Object.fromEntries(activeDomains.map(([d, arr]) => [d, arr.length])) },
        expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
      })
      .select("id")
      .single();
    narrativeRowId = nrow?.id ?? null;
  }

  // ─── Exposure snapshot ───
  const geoCounts: Record<string, number> = {};
  const entityCounts: Record<string, number> = {};
  for (const it of items) {
    for (const g of it.geography || []) geoCounts[g] = (geoCounts[g] ?? 0) + 1;
    for (const e of (it.entities as Array<{ name?: string }>) || []) {
      const n = e?.name; if (n) entityCounts[n] = (entityCounts[n] ?? 0) + 1;
    }
  }
  const exposureScore = Math.min(
    100,
    Math.round(
      criticalCount * 12 + highCount * 6 +
      Object.keys(geoCounts).length * 2 +
      Object.keys(entityCounts).length
    )
  );
  await svc.from("executive_exposure_snapshots").insert({
    organization_id: orgId,
    exposure_score: exposureScore,
    exposure_reasoning: `Critical=${criticalCount}, High=${highCount}, Geographies=${Object.keys(geoCounts).length}, Entities=${Object.keys(entityCounts).length}`,
    geography_exposure: geoCounts,
    entity_exposure: entityCounts,
    sector_exposure: Object.fromEntries([...domainGroups.entries()].map(([d, arr]) => [d, arr.length])),
    dependency_graph: { nodes: [...domainGroups.keys()], domain_counts: Object.fromEntries([...domainGroups.entries()].map(([d, a]) => [d, a.length])) },
  });

  // ─── Executive Brief (stored in executive_briefs as role_type='ceo') ───
  const briefSummary = {
    headline: `Executive intelligence — ${criticalCount} critical, ${highCount} high-pressure signals in last 7 days.`,
    why_it_matters: top.length > 0
      ? `Top pressure (${top[0].pressure}/100): ${top[0].it.title ?? "untitled signal"} [${top[0].it.domain ?? "general"}].`
      : "No high-pressure signals; system in steady-state.",
    likely_business_impact: exposureScore >= 70
      ? "Severe — multi-domain exposure with concentrated entity/geography risk."
      : exposureScore >= 40
      ? "Moderate — elevated exposure across one or two domains."
      : "Limited — exposure within tolerated thresholds.",
    affected_areas: [...new Set(items.flatMap((i) => i.geography || []))].slice(0, 10),
    projected_time_horizon_days: narrativeRowId ? Math.max(7, Math.round(30 - exposureScore / 5)) : 30,
    recommended_executive_actions: top.slice(0, 5).map((r) => ({
      label: r.tier.toUpperCase(),
      value: `Pressure ${r.pressure}: ${(r.it.title ?? "review signal").slice(0, 90)}`,
    })),
    confidence: Math.min(85, 40 + Math.min(items.length, 50)),
    escalation_recommended: criticalCount > 0,
    provenance: {
      window_days: 7,
      items_evaluated: items.length,
      advisories_considered: advisories?.length ?? 0,
      decisions_considered: decisions?.length ?? 0,
      failures_considered: failures?.length ?? 0,
      top_signal_ids: top.slice(0, 10).map((r) => r.it.id),
    },
    pressure_tiers: { critical: criticalCount, high: highCount, elevated: ranked.filter((r) => r.tier === "elevated").length },
  };

  const { data: brief } = await svc
    .from("executive_briefs")
    .insert({
      organization_id: orgId,
      role_type: "ceo",
      summary_json: briefSummary,
      risk_score: Math.min(100, exposureScore),
      generated_by: "ai",
    })
    .select("id")
    .single();

  // ─── Observability snapshot ───
  const itemsToDecisionRate = items.length > 0
    ? Math.round((items.filter((i) => ["routed", "acted_on", "resolved"].includes(i.status)).length / items.length) * 1000) / 10
    : 0;
  const advisoryAdoption = (advisories?.length ?? 0) > 0 && (decisions?.length ?? 0) > 0
    ? Math.round(((decisions?.length ?? 0) / (advisories?.length ?? 1)) * 1000) / 10
    : 0;
  const { count: openIntv } = await svc
    .from("executive_interventions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("pressure_tier", "critical")
    .in("escalation_status", ["pending", "acknowledged", "assigned"]);
  const { data: resolvedIntv } = await svc
    .from("executive_interventions")
    .select("id,created_at,resolved_at")
    .eq("organization_id", orgId)
    .not("resolved_at", "is", null)
    .gte("created_at", since)
    .limit(200);
  const intvResolutionRate = (resolvedIntv?.length ?? 0) > 0
    ? Math.round(((resolvedIntv!.length) / ((resolvedIntv!.length) + (openIntv ?? 0) || 1)) * 1000) / 10
    : 0;
  const avgLatencyHours = (resolvedIntv && resolvedIntv.length > 0)
    ? resolvedIntv.reduce((s, r) => s + ((new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 3600_000), 0) / resolvedIntv.length
    : 0;
  const { data: memEff } = await svc
    .from("intelligence_memory")
    .select("effectiveness_rating")
    .eq("organization_id", orgId)
    .gte("recorded_at", since)
    .limit(200);
  const memScore = (memEff && memEff.length > 0)
    ? Math.round(memEff.reduce((s, r) => s + (r.effectiveness_rating ?? 0), 0) / memEff.length)
    : 0;

  await svc.from("executive_intel_observability").upsert({
    organization_id: orgId,
    snapshot_day: new Date().toISOString().slice(0, 10),
    items_to_decision_rate: itemsToDecisionRate,
    advisory_adoption_rate: Math.min(100, advisoryAdoption),
    intervention_resolution_rate: intvResolutionRate,
    unresolved_critical_pressure: openIntv ?? 0,
    avg_response_latency_hours: Math.round(avgLatencyHours * 10) / 10,
    memory_effectiveness_score: memScore,
    computed_at: new Date().toISOString(),
  }, { onConflict: "organization_id,snapshot_day" });

  return json({
    brief_id: brief?.id ?? null,
    narrative_id: narrativeRowId,
    interventions_created: interventionsInserted,
    items_evaluated: items.length,
    advisories_considered: advisories?.length ?? 0,
    decisions_considered: decisions?.length ?? 0,
    failures_considered: failures?.length ?? 0,
    exposure_score: exposureScore,
    critical_pressure: criticalCount,
    high_pressure: highCount,
  });
});
