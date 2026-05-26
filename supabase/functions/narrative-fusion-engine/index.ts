// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type AnyRec = Record<string, any>;

const STALE_HOURS = 72;
const MAX_CLUSTERS_PER_ORG = 25;

function norm(s?: string | null): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
}
function tokens(s?: string | null): Set<string> {
  return new Set(norm(s).split(" ").filter((w) => w.length > 3));
}
function clamp(n: number, min = 0, max = 100): number { return Math.max(min, Math.min(max, n)); }
function avg(arr: number[]): number { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

interface InputSignal {
  source: "item" | "intervention" | "advisory";
  id: string;
  title: string;
  text: string;
  domain?: string | null;
  geography?: string[];
  entities?: string[];
  severity?: string | null;
  pressure?: number;
  velocity?: number;
  ts: string;
}

function severityWeight(s?: string | null): number {
  switch ((s || "").toLowerCase()) {
    case "critical": return 95;
    case "high": return 75;
    case "elevated": return 55;
    case "medium": case "moderate": return 40;
    case "low": return 20;
    default: return 30;
  }
}

function clusterSignature(domains: string[], geos: string[], type: string): string {
  return [type, [...domains].sort().join("|"), [...geos].sort().join("|")].join("::");
}

function buildNarrative(c: {
  title: string;
  domains: string[];
  geographies: string[];
  entities: string[];
  signals: InputSignal[];
  pressure: number;
  velocity: number;
  trend: string;
}): string {
  const parts: string[] = [];
  const dom = c.domains.slice(0, 3).join(", ") || "multiple domains";
  const geo = c.geographies.slice(0, 3).join(", ");
  const trendVerb = c.trend === "rising" ? "Escalating" : c.trend === "falling" ? "Easing" : "Sustained";
  parts.push(`${trendVerb} pressure in ${dom}${geo ? ` across ${geo}` : ""}.`);
  const itemCount = c.signals.filter((s) => s.source === "item").length;
  const intvCount = c.signals.filter((s) => s.source === "intervention").length;
  const advCount = c.signals.filter((s) => s.source === "advisory").length;
  parts.push(`Fused from ${itemCount} intelligence items, ${intvCount} interventions, ${advCount} advisories.`);
  if (c.entities.length) parts.push(`Affecting ${c.entities.slice(0, 3).join(", ")}.`);
  parts.push(`Pressure: ${Math.round(c.pressure)} / Velocity: ${c.velocity.toFixed(1)}.`);
  return parts.join(" ");
}

async function gatherInputs(sb: any, orgId: string): Promise<InputSignal[]> {
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
  const [items, intvs, advs] = await Promise.all([
    sb.from("aicis_intelligence_items").select("id,title,summary,domain,geography,entities,severity,global_criticality_score,ingested_at").eq("organization_id", orgId).gte("ingested_at", since).limit(500),
    sb.from("executive_interventions").select("id,title,summary,intervention_type,severity,decision_pressure_score,intervention_priority_score,created_at,status").eq("organization_id", orgId).neq("status", "resolved").gte("created_at", since).limit(300),
    sb.from("intelligence_advisories").select("id,title,summary,domain,severity,created_at").eq("organization_id", orgId).gte("created_at", since).limit(300),
  ]);
  const out: InputSignal[] = [];
  for (const r of (items.data ?? [])) {
    out.push({
      source: "item", id: r.id, title: r.title ?? "Intelligence item",
      text: `${r.title ?? ""} ${r.summary ?? ""}`,
      domain: r.domain, geography: r.geography ?? [],
      entities: (r.entities ?? []).map((e: any) => typeof e === "string" ? e : e?.name).filter(Boolean),
      severity: r.severity, pressure: Number(r.global_criticality_score ?? severityWeight(r.severity)),
      ts: r.ingested_at,
    });
  }
  for (const r of (intvs.data ?? [])) {
    out.push({
      source: "intervention", id: r.id, title: r.title,
      text: `${r.title} ${r.summary ?? ""}`,
      domain: r.intervention_type, geography: [], entities: [],
      severity: r.severity, pressure: Number(r.intervention_priority_score ?? r.decision_pressure_score ?? severityWeight(r.severity)),
      ts: r.created_at,
    });
  }
  for (const r of (advs.data ?? [])) {
    out.push({
      source: "advisory", id: r.id, title: r.title ?? "Advisory",
      text: `${r.title ?? ""} ${r.summary ?? ""}`,
      domain: r.domain, geography: [], entities: [],
      severity: r.severity, pressure: severityWeight(r.severity),
      ts: r.created_at,
    });
  }
  return out;
}

function clusterize(signals: InputSignal[]): InputSignal[][] {
  const groups: InputSignal[][] = [];
  const tokSets = signals.map((s) => tokens(s.text));
  const used = new Set<number>();
  for (let i = 0; i < signals.length; i++) {
    if (used.has(i)) continue;
    const g: number[] = [i];
    used.add(i);
    for (let j = i + 1; j < signals.length; j++) {
      if (used.has(j)) continue;
      const a = signals[i], b = signals[j];
      const domMatch = !!a.domain && a.domain === b.domain ? 1 : 0;
      const geoOverlap = jaccard(new Set(a.geography ?? []), new Set(b.geography ?? []));
      const entOverlap = jaccard(new Set(a.entities ?? []), new Set(b.entities ?? []));
      const txt = jaccard(tokSets[i], tokSets[j]);
      const dt = Math.abs(new Date(a.ts).getTime() - new Date(b.ts).getTime()) / (3600 * 1000);
      const temporal = dt < 48 ? 1 : dt < 168 ? 0.5 : 0;
      const score = txt * 0.5 + entOverlap * 0.2 + geoOverlap * 0.15 + domMatch * 0.1 + temporal * 0.05;
      if (score >= 0.35) { g.push(j); used.add(j); }
    }
    groups.push(g.map((k) => signals[k]));
  }
  return groups;
}

function pressureBuckets(clusters: { domain?: string | null; pressure: number }[]): AnyRec {
  const buckets: Record<string, number[]> = {
    operational: [], strategic: [], geopolitical: [], cyber: [],
    supply_chain: [], regulatory: [], execution: [],
  };
  for (const c of clusters) {
    const d = (c.domain || "").toLowerCase();
    if (/cyber|security|breach/.test(d)) buckets.cyber.push(c.pressure);
    else if (/supply|logistic|vendor/.test(d)) buckets.supply_chain.push(c.pressure);
    else if (/regulat|compliance|legal|tax|policy/.test(d)) buckets.regulatory.push(c.pressure);
    else if (/geopol|sanction|war|tariff/.test(d)) buckets.geopolitical.push(c.pressure);
    else if (/execution|delivery|delay|operations/.test(d)) buckets.execution.push(c.pressure);
    else if (/strategy|market|competit|portfolio/.test(d)) buckets.strategic.push(c.pressure);
    else buckets.operational.push(c.pressure);
  }
  const out: AnyRec = {};
  for (const k of Object.keys(buckets)) out[`${k}_pressure`] = clamp(avg(buckets[k]));
  return out;
}

async function fuseForOrg(sb: any, orgId: string): Promise<AnyRec> {
  const t0 = Date.now();
  const signals = await gatherInputs(sb, orgId);
  if (!signals.length) {
    return { organization_id: orgId, inputs_count: 0, clusters_count: 0, message: "no signals" };
  }
  const groups = clusterize(signals);

  // Load existing active clusters to merge/dedupe
  const { data: existing } = await sb
    .from("intelligence_fusion_clusters")
    .select("id,cluster_signature,supporting_item_ids,supporting_intervention_ids,supporting_advisory_ids,pressure_score,generated_at")
    .eq("organization_id", orgId)
    .eq("status", "active");
  const existingBySig = new Map<string, AnyRec>();
  for (const e of (existing ?? [])) if (e.cluster_signature) existingBySig.set(e.cluster_signature, e);

  let duplicates = 0;
  const upserts: AnyRec[] = [];
  const writtenSigs = new Set<string>();

  for (const grp of groups) {
    if (grp.length < 2) continue; // require at least 2 signals to fuse
    const domains = Array.from(new Set(grp.map((g) => g.domain).filter(Boolean))) as string[];
    const geographies = Array.from(new Set(grp.flatMap((g) => g.geography ?? [])));
    const entities = Array.from(new Set(grp.flatMap((g) => g.entities ?? []))).slice(0, 25);
    const type = domains[0] || "operational";

    const pressures = grp.map((g) => g.pressure ?? severityWeight(g.severity));
    const pressure = clamp(avg(pressures) + Math.min(20, grp.length * 1.5));
    const tsSorted = grp.map((g) => new Date(g.ts).getTime()).sort((a, b) => a - b);
    const span = (tsSorted[tsSorted.length - 1] - tsSorted[0]) / (3600 * 1000) || 1;
    const velocity = +(grp.length / Math.max(span / 24, 0.5)).toFixed(2); // signals per day
    const trend = velocity > 1.5 ? "rising" : velocity < 0.4 ? "falling" : "stable";
    const narrativeStrength = clamp(grp.length * 8 + pressure * 0.4);
    const confidence = clamp(40 + grp.length * 4 + (domains.length === 1 ? 10 : 0));

    const title = `${type.charAt(0).toUpperCase() + type.slice(1)} pressure cluster${geographies.length ? ` — ${geographies[0]}` : ""}`;
    const signature = clusterSignature(domains, geographies, type);
    if (writtenSigs.has(signature)) { duplicates++; continue; }
    writtenSigs.add(signature);

    const narrative = buildNarrative({
      title, domains, geographies, entities, signals: grp, pressure, velocity, trend,
    });

    const supporting_item_ids = grp.filter((g) => g.source === "item").map((g) => g.id);
    const supporting_intervention_ids = grp.filter((g) => g.source === "intervention").map((g) => g.id);
    const supporting_advisory_ids = grp.filter((g) => g.source === "advisory").map((g) => g.id);

    const row: AnyRec = {
      organization_id: orgId,
      cluster_type: type,
      title,
      canonical_summary: narrative.split(".").slice(0, 2).join(".") + ".",
      narrative,
      supporting_item_ids,
      supporting_intervention_ids,
      supporting_advisory_ids,
      affected_domains: domains,
      affected_geographies: geographies,
      affected_entities: entities,
      trend_direction: trend,
      escalation_velocity: velocity,
      narrative_strength: narrativeStrength,
      confidence_score: confidence,
      pressure_score: pressure,
      status: "active",
      cluster_signature: signature,
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + STALE_HOURS * 3600 * 1000).toISOString(),
    };

    const prior = existingBySig.get(signature);
    if (prior) {
      duplicates++;
      await sb.from("intelligence_fusion_clusters").update(row).eq("id", prior.id);
    } else {
      upserts.push(row);
    }
  }

  // Bound cluster volume
  const trimmed = upserts.sort((a, b) => b.pressure_score - a.pressure_score).slice(0, MAX_CLUSTERS_PER_ORG);
  if (trimmed.length) await sb.from("intelligence_fusion_clusters").insert(trimmed);

  // Expire stale clusters
  await sb.from("intelligence_fusion_clusters").update({ status: "expired" })
    .eq("organization_id", orgId).eq("status", "active")
    .lt("generated_at", new Date(Date.now() - STALE_HOURS * 3600 * 1000).toISOString());

  // Pressure model
  const { data: activeClusters } = await sb
    .from("intelligence_fusion_clusters")
    .select("id,affected_domains,pressure_score,escalation_velocity")
    .eq("organization_id", orgId).eq("status", "active");

  const flat = (activeClusters ?? []).map((c: AnyRec) => ({
    domain: (c.affected_domains ?? [])[0] ?? null,
    pressure: Number(c.pressure_score ?? 0),
    velocity: Number(c.escalation_velocity ?? 0),
  }));
  const buckets = pressureBuckets(flat);
  const overall = clamp(avg(flat.map((c: AnyRec) => c.pressure)));
  const velocity = avg(flat.map((c: AnyRec) => c.velocity));

  // Compare to prior snapshot for acceleration
  const { data: prevSnap } = await sb
    .from("organizational_pressure_models")
    .select("pressure_score,pressure_velocity,snapshot_at")
    .eq("organization_id", orgId).order("snapshot_at", { ascending: false }).limit(1).maybeSingle();
  const prevVel = Number(prevSnap?.pressure_velocity ?? 0);
  const accel = +(velocity - prevVel).toFixed(2);
  const stabilization = clamp(100 - overall - Math.abs(accel) * 5);

  await sb.from("organizational_pressure_models").insert({
    organization_id: orgId,
    pressure_score: overall,
    pressure_velocity: velocity,
    pressure_acceleration: accel,
    stabilization_indicator: stabilization,
    breakdown: buckets,
    contributing_cluster_ids: (activeClusters ?? []).map((c: AnyRec) => c.id),
    ...buckets,
  });

  // Observability
  const latency = Date.now() - t0;
  const inputs = signals.length;
  const clustersCount = (activeClusters ?? []).length;
  const compression = inputs > 0 ? +(clustersCount / inputs).toFixed(3) : 0;

  // Conversion + ignored from narrative_memory
  const { data: mem } = await sb.from("narrative_memory")
    .select("led_to_decision,ignored,outcome_effective,narrative_resolution_rate")
    .eq("organization_id", orgId).limit(500);
  const memArr = mem ?? [];
  const conv = memArr.length ? (memArr.filter((m: AnyRec) => m.led_to_decision).length / memArr.length) * 100 : 0;
  const ignored = memArr.length ? (memArr.filter((m: AnyRec) => m.ignored).length / memArr.length) * 100 : 0;
  const effective = memArr.length ? (memArr.filter((m: AnyRec) => m.outcome_effective === true).length / memArr.length) * 100 : 0;

  await sb.from("fusion_observability").upsert({
    organization_id: orgId,
    day: new Date().toISOString().slice(0, 10),
    inputs_count: inputs,
    clusters_count: clustersCount,
    compression_ratio: compression,
    duplicates_suppressed: duplicates,
    avg_generation_latency_ms: latency,
    narrative_to_decision_conversion_pct: +conv.toFixed(2),
    ignored_narrative_pct: +ignored.toFixed(2),
    narrative_resolution_effectiveness_pct: +effective.toFixed(2),
  }, { onConflict: "organization_id,day" });

  return {
    organization_id: orgId,
    inputs_count: inputs,
    clusters_count: clustersCount,
    duplicates_suppressed: duplicates,
    pressure_score: overall,
    latency_ms: latency,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    let orgIds: string[] = [];
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.organization_id) orgIds = [body.organization_id];
    }
    if (!orgIds.length) {
      const { data } = await sb.from("organizations").select("id").limit(500);
      orgIds = (data ?? []).map((o: AnyRec) => o.id);
    }
    const results: AnyRec[] = [];
    for (const id of orgIds) {
      try { results.push(await fuseForOrg(sb, id)); }
      catch (e) { results.push({ organization_id: id, error: String(e) }); }
    }
    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("narrative-fusion-engine error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
