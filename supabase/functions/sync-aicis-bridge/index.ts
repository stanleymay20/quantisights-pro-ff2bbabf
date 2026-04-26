// AICIS Bridge v2 — full surface sync with per-surface isolation, pagination,
// idempotent upserts, structured logging, and data-quality checks.
// Secrets (env-only): AICIS_BRIDGE_URL / AICIS_BRIDGE_API_KEY
// (falls back to AICIS_TEST_ENDPOINT_URL / AICIS_TEST_API_KEY for compatibility)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 10 data surfaces + /catalog (introspection) + /stats (counts)
const DATA_SURFACES = [
  "signals",
  "entities",
  "countries",
  "events",
  "predictions",
  "cross_border",
  "cross_domain",
  "recommendations",
  "outcomes",
  "entity_links",
] as const;

const PAGE_SIZE = 500;
// Hard safety cap per surface per run.
// Sized for full 211-country coverage across all domains:
//   - /countries: ~211 rows (1 page)
//   - /signals, /events, /predictions, /recommendations: up to ~50k rows (211 countries × multi-domain history)
const MAX_PAGES = 100; // = 50,000 rows / surface / run
const STALE_HOURS = 24;
const EXPECTED_MIN_COUNTRIES = 211; // AICIS Bridge v2 country universe (UN + sovereign + dependencies)

type Surface = (typeof DATA_SURFACES)[number];

interface SurfaceResult {
  surface: string;
  status: "success" | "failed" | "partial";
  records_pulled: number;
  records_inserted: number;
  records_updated: number;
  records_failed: number;
  pages_fetched: number;
  duration_ms: number;
  error?: string;
}

const log = (level: string, msg: string, ctx: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ level, msg, ts: new Date().toISOString(), ...ctx }));

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function pickExternalId(surface: string, rec: Record<string, any>): string {
  return String(
    rec.id ??
      rec[`${surface.replace(/s$/, "")}_id`] ??
      rec.signal_id ??
      rec.entity_id ??
      rec.event_id ??
      rec.prediction_id ??
      rec.recommendation_id ??
      rec.outcome_id ??
      rec.iso3 ??
      rec.code ??
      crypto.randomUUID(),
  );
}

function pickCountry(rec: Record<string, any>): string | null {
  const v = rec.country_iso3 ?? rec.iso3 ?? rec.country ?? null;
  return v ? String(v).toUpperCase().slice(0, 3) : null;
}
function pickDomain(rec: Record<string, any>): string | null {
  const v = rec.domain ?? rec.category ?? rec.sector ?? null;
  return v ? String(v) : null;
}

async function bridgeFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  params: Record<string, string | number> = {},
): Promise<{ ok: boolean; status: number; body: any; error?: string }> {
  const url = new URL(path.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : baseUrl + "/");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  try {
    const res = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, body, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function extractRecords(body: any): { items: any[]; total?: number } {
  if (!body) return { items: [] };
  if (Array.isArray(body)) return { items: body };
  if (Array.isArray(body.data)) return { items: body.data, total: body.total ?? body.count };
  if (Array.isArray(body.items)) return { items: body.items, total: body.total ?? body.count };
  if (Array.isArray(body.results)) return { items: body.results, total: body.total ?? body.count };
  return { items: [] };
}

async function syncSurface(
  supabase: any,
  orgId: string,
  surface: Surface,
  baseUrl: string,
  apiKey: string,
  triggeredBy: string | null,
  triggerType: string,
  catalogSchema: any,
): Promise<SurfaceResult> {
  const t0 = Date.now();
  // Create run row
  const { data: runRow, error: runErr } = await supabase
    .from("aicis_sync_runs")
    .insert({
      organization_id: orgId,
      surface,
      status: "running",
      triggered_by: triggeredBy,
      trigger_type: triggerType,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runErr) {
    log("error", "run_insert_failed", { surface, err: runErr.message });
    return {
      surface,
      status: "failed",
      records_pulled: 0,
      records_inserted: 0,
      records_updated: 0,
      records_failed: 0,
      pages_fetched: 0,
      duration_ms: Date.now() - t0,
      error: runErr.message,
    };
  }
  const runId = runRow.id;

  let pulled = 0,
    inserted = 0,
    updated = 0,
    failed = 0,
    pages = 0;
  let offset = 0;
  let lastError: string | undefined;
  let partial = false;
  let totalAvailable: number | undefined;
  const allHashes: string[] = [];
  const seenIds = new Set<string>();
  let duplicateIds = 0;
  let missingCountry = 0;
  let missingDomain = 0;

  while (pages < MAX_PAGES) {
    const r = await bridgeFetch(baseUrl, apiKey, `/${surface}`, {
      limit: PAGE_SIZE,
      offset,
    });
    if (!r.ok) {
      lastError = r.error;
      // Log error
      await supabase.from("aicis_sync_errors").insert({
        organization_id: orgId,
        run_id: runId,
        surface,
        error_code: "fetch_failed",
        error_message: r.error ?? "fetch failed",
        http_status: r.status,
        context: { offset, pages },
      });
      // Quality check: pagination_failed
      await supabase.from("aicis_data_quality_checks").insert({
        organization_id: orgId,
        run_id: runId,
        surface,
        check_type: "pagination_failed",
        severity: "error",
        passed: false,
        count_affected: 1,
        details: { offset, http_status: r.status },
      });
      partial = pulled > 0;
      break;
    }
    const { items, total } = extractRecords(r.body);
    if (typeof total === "number") totalAvailable = total;
    pages++;

    if (!items.length) break;

    // Upsert items
    const rows = await Promise.all(
      items.map(async (rec: any) => {
        const ext = pickExternalId(surface, rec);
        if (seenIds.has(ext)) duplicateIds++;
        seenIds.add(ext);
        const country = pickCountry(rec);
        const domain = pickDomain(rec);
        if (!country && ["signals", "countries", "events", "predictions"].includes(surface))
          missingCountry++;
        if (!domain && ["signals", "predictions", "recommendations"].includes(surface))
          missingDomain++;
        const hash = await sha256(JSON.stringify(rec));
        allHashes.push(hash);
        return {
          organization_id: orgId,
          surface,
          external_id: ext,
          content_hash: hash,
          country_iso3: country,
          domain,
          payload: rec,
          source_run_id: runId,
        };
      }),
    );

    // Bulk upsert; count inserts vs updates by pre-checking hashes
    const { data: existing } = await supabase
      .from("aicis_ingested_records")
      .select("external_id, content_hash")
      .eq("organization_id", orgId)
      .eq("surface", surface)
      .in("external_id", rows.map((r) => r.external_id));
    const existingMap = new Map<string, string>(
      (existing ?? []).map((e: any) => [e.external_id, e.content_hash]),
    );

    let pageInserted = 0,
      pageUpdated = 0,
      pageFailed = 0;
    for (const row of rows) {
      const prev = existingMap.get(row.external_id);
      const isNew = !prev;
      const changed = prev && prev !== row.content_hash;
      if (!isNew && !changed) continue; // truly idempotent — skip unchanged
      const { error: upErr } = await supabase
        .from("aicis_ingested_records")
        .upsert(row, { onConflict: "organization_id,surface,external_id" });
      if (upErr) {
        pageFailed++;
        await supabase.from("aicis_sync_errors").insert({
          organization_id: orgId,
          run_id: runId,
          surface,
          error_code: "upsert_failed",
          error_message: upErr.message,
          context: { external_id: row.external_id },
        });
      } else if (isNew) pageInserted++;
      else pageUpdated++;
    }
    inserted += pageInserted;
    updated += pageUpdated;
    failed += pageFailed;
    pulled += items.length;

    if (items.length < PAGE_SIZE) break;
    offset += items.length;
  }

  // Aggregate checksum
  const checksum = allHashes.length
    ? await sha256(allHashes.sort().join(""))
    : null;

  // Run-level data quality checks
  const qcInserts: any[] = [];
  if (pulled === 0) {
    qcInserts.push({
      organization_id: orgId,
      run_id: runId,
      surface,
      check_type: "empty_surface",
      severity: "warning",
      passed: false,
      count_affected: 0,
      details: {},
    });
  }
  if (missingCountry > 0) {
    qcInserts.push({
      organization_id: orgId,
      run_id: runId,
      surface,
      check_type: "missing_country",
      severity: "warning",
      passed: false,
      count_affected: missingCountry,
      details: { of: pulled },
    });
  }
  if (missingDomain > 0) {
    qcInserts.push({
      organization_id: orgId,
      run_id: runId,
      surface,
      check_type: "missing_domain",
      severity: "warning",
      passed: false,
      count_affected: missingDomain,
      details: { of: pulled },
    });
  }
  if (duplicateIds > 0) {
    qcInserts.push({
      organization_id: orgId,
      run_id: runId,
      surface,
      check_type: "duplicate_ids",
      severity: "warning",
      passed: false,
      count_affected: duplicateIds,
      details: {},
    });
  }
  // Schema drift: compare keys against catalog
  if (catalogSchema && catalogSchema[surface] && pulled > 0) {
    const expected: string[] = Array.isArray(catalogSchema[surface])
      ? catalogSchema[surface]
      : Object.keys(catalogSchema[surface] ?? {});
    if (expected.length) {
      const { data: sample } = await supabase
        .from("aicis_ingested_records")
        .select("payload")
        .eq("organization_id", orgId)
        .eq("surface", surface)
        .order("ingested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sample?.payload) {
        const actual = Object.keys(sample.payload);
        const missing = expected.filter((k) => !actual.includes(k));
        const extra = actual.filter((k) => !expected.includes(k));
        if (missing.length || extra.length) {
          qcInserts.push({
            organization_id: orgId,
            run_id: runId,
            surface,
            check_type: "schema_drift",
            severity: "warning",
            passed: false,
            count_affected: missing.length + extra.length,
            details: { missing, extra },
          });
        }
      }
    }
  }
  if (qcInserts.length) await supabase.from("aicis_data_quality_checks").insert(qcInserts);

  const status: SurfaceResult["status"] = lastError
    ? partial
      ? "partial"
      : "failed"
    : "success";
  const duration = Date.now() - t0;

  await supabase
    .from("aicis_sync_runs")
    .update({
      status,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      records_pulled: pulled,
      records_inserted: inserted,
      records_updated: updated,
      records_failed: failed,
      pages_fetched: pages,
      last_offset: offset,
      next_offset: lastError ? offset : null,
      payload_checksum: checksum,
      error_message: lastError ?? null,
      metadata: { total_available: totalAvailable, duplicate_ids: duplicateIds },
    })
    .eq("id", runId);

  // Surface-level rolling status
  const { data: totalRow } = await supabase
    .from("aicis_ingested_records")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("surface", surface);
  const totalRecords = (totalRow as any)?.count ?? 0;

  const { data: prev } = await supabase
    .from("aicis_sync_surface_status")
    .select("consecutive_failures")
    .eq("organization_id", orgId)
    .eq("surface", surface)
    .maybeSingle();
  const prevFailures = prev?.consecutive_failures ?? 0;
  const consecFailures = status === "failed" ? prevFailures + 1 : 0;

  // Build schema fingerprint from latest sample
  let fingerprint: string | null = null;
  if (pulled > 0) {
    const { data: sample } = await supabase
      .from("aicis_ingested_records")
      .select("payload")
      .eq("organization_id", orgId)
      .eq("surface", surface)
      .order("ingested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sample?.payload) fingerprint = await sha256(Object.keys(sample.payload).sort().join("|"));
  }

  await supabase
    .from("aicis_sync_surface_status")
    .upsert(
      {
        organization_id: orgId,
        surface,
        last_run_id: runId,
        last_status: status,
        last_attempt_at: new Date().toISOString(),
        last_success_at: status === "success" ? new Date().toISOString() : undefined,
        last_error_at: lastError ? new Date().toISOString() : undefined,
        last_error_message: lastError ?? null,
        total_records: totalRecords,
        records_available: totalAvailable ?? null,
        consecutive_failures: consecFailures,
        schema_fingerprint: fingerprint,
        freshness_seconds: 0,
      },
      { onConflict: "organization_id,surface" },
    );

  log("info", "surface_synced", {
    surface,
    status,
    pulled,
    inserted,
    updated,
    failed,
    pages,
    duration_ms: duration,
  });

  return {
    surface,
    status,
    records_pulled: pulled,
    records_inserted: inserted,
    records_updated: updated,
    records_failed: failed,
    pages_fetched: pages,
    duration_ms: duration,
    error: lastError,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const BRIDGE_URL =
    Deno.env.get("AICIS_BRIDGE_URL") ?? Deno.env.get("AICIS_TEST_ENDPOINT_URL");
  const BRIDGE_KEY =
    Deno.env.get("AICIS_BRIDGE_API_KEY") ?? Deno.env.get("AICIS_TEST_API_KEY");

  if (!BRIDGE_URL || !BRIDGE_KEY) {
    return new Response(
      JSON.stringify({
        error: "AICIS bridge not configured (AICIS_BRIDGE_URL/AICIS_BRIDGE_API_KEY missing)",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Identify caller (must be admin/owner of an org)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes.user) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const user = userRes.user;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve org and role
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const orgId = profile?.organization_id;
  if (!orgId) {
    return new Response(JSON.stringify({ error: "no organization" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Body params
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const triggerType = body.trigger_type ?? "manual";
  const requestedSurfaces: Surface[] = Array.isArray(body.surfaces) && body.surfaces.length
    ? (body.surfaces as Surface[]).filter((s) => DATA_SURFACES.includes(s))
    : [...DATA_SURFACES];

  // For manual triggers, require admin/owner
  if (triggerType === "manual") {
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    const role = member?.role;
    if (role !== "owner" && role !== "admin") {
      return new Response(
        JSON.stringify({ error: "forbidden: only owners/admins can trigger sync" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  log("info", "sync_started", { org_id: orgId, user_id: user.id, surfaces: requestedSurfaces.length });

  // 1. Catalog (introspection — schema fingerprints)
  const catalogRes = await bridgeFetch(BRIDGE_URL, BRIDGE_KEY, "/catalog");
  let catalogSchema: any = null;
  if (catalogRes.ok) {
    catalogSchema = catalogRes.body?.schemas ?? catalogRes.body?.surfaces ?? catalogRes.body;
  } else {
    log("warn", "catalog_fetch_failed", { error: catalogRes.error });
  }

  // 2. Stats (optional — counts)
  const statsRes = await bridgeFetch(BRIDGE_URL, BRIDGE_KEY, "/stats");
  const stats = statsRes.ok ? statsRes.body : null;

  // 3. Sync each surface, isolated
  const results: SurfaceResult[] = [];
  for (const surface of requestedSurfaces) {
    try {
      const r = await syncSurface(
        supabase,
        orgId,
        surface,
        BRIDGE_URL,
        BRIDGE_KEY,
        user.id,
        triggerType,
        catalogSchema,
      );
      results.push(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("error", "surface_crashed", { surface, err: msg });
      results.push({
        surface,
        status: "failed",
        records_pulled: 0,
        records_inserted: 0,
        records_updated: 0,
        records_failed: 0,
        pages_fetched: 0,
        duration_ms: 0,
        error: msg,
      });
      await supabase.from("aicis_sync_errors").insert({
        organization_id: orgId,
        surface,
        error_code: "surface_crashed",
        error_message: msg,
      });
    }
  }

  const summary = {
    organization_id: orgId,
    surfaces_attempted: results.length,
    surfaces_succeeded: results.filter((r) => r.status === "success").length,
    surfaces_partial: results.filter((r) => r.status === "partial").length,
    surfaces_failed: results.filter((r) => r.status === "failed").length,
    total_pulled: results.reduce((s, r) => s + r.records_pulled, 0),
    total_inserted: results.reduce((s, r) => s + r.records_inserted, 0),
    total_updated: results.reduce((s, r) => s + r.records_updated, 0),
    catalog_ok: catalogRes.ok,
    stats_ok: statsRes.ok,
    stats,
    results,
  };

  // Audit
  await supabase.from("audit_log").insert({
    organization_id: orgId,
    actor_id: user.id,
    actor_type: "user",
    action_type: "aicis_sync_triggered",
    resource_type: "aicis_bridge",
    resource_id: orgId.toString(),
    payload: {
      trigger_type: triggerType,
      ...summary,
      stale_threshold_hours: STALE_HOURS,
    },
  });

  log("info", "sync_completed", summary);

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
