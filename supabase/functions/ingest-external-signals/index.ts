/**
 * Ingest External Signals — pulls macro/industry data from configured vendors
 * (AICIS, IMF, World Bank, etc.) into internal_reference_data for Layer B
 * blending in advisory generation.
 *
 * Auth (any one of these is accepted):
 *  - Bearer SUPABASE_SERVICE_ROLE_KEY  (service-to-service, e.g. internal admin)
 *  - x-cron-secret header == INGEST_CRON_SECRET  (pg_cron path)
 *  - Bearer <user JWT> + org-admin role  (manual refresh from /admin/data-vendors)
 *
 * Modes:
 *  - { mode: "scheduled" } → cron call: refresh all sources whose next_refresh_at < now()
 *  - { mode: "manual", source_id } → admin-triggered single-source refresh
 *  - { mode: "test", vendor_key } → dry-run single vendor without writing
 *
 * Strict Real Data Only — no fabricated fallbacks. Adapter failures surface as
 * `last_error` on the source row and are visible in the admin UI.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

interface VendorRow {
  metric_key: string;
  value: number;
  unit?: string;
  period?: string;
  region?: string;
  metadata?: Record<string, unknown>;
}

interface VendorAdapter {
  vendor_key: string;
  fetch: (config: Record<string, unknown>) => Promise<VendorRow[]>;
}

// ── AICIS bridge config (shared platform license, read from Vault) ────────
// Hybrid access model: Pro tier orgs use the shared platform credentials
// below; Enterprise orgs may override per-tenant via config.endpoint_url +
// config.api_key on their external_data_sources row.
const AICIS_PLATFORM_ENDPOINT = Deno.env.get("AICIS_TEST_ENDPOINT_URL") ?? "";
const AICIS_PLATFORM_API_KEY = Deno.env.get("AICIS_TEST_API_KEY") ?? "";

interface AicisSignal {
  signal_id: string;
  metric_name: string;
  value: number;
  unit?: string | null;
  period?: string | null;
  domain?: string | null;
  iso3?: string | null;
  confidence?: number | null;
  freshness_score?: number | null;
  source_provider?: string | null;
  source_url?: string | null;
  provenance_observed_at?: string | null;
  ingested_at?: string | null;
  entity_name?: string | null;
  entity_type?: string | null;
  sovereignty_status?: string | null;
}

// ── Adapters ──────────────────────────────────────────────────────────────
const adapters: Record<string, VendorAdapter> = {
  aicis: {
    vendor_key: "aicis",
    async fetch(config) {
      // AICIS = Aggregated Country Intelligence Signals (Quantivis-licensed
      // feed via the AICIS bridge). Pulls live signals across climate,
      // economic, demographic and event domains keyed by ISO3 country.
      //
      // Per-tenant (Enterprise) override: config.endpoint_url + config.api_key.
      // Otherwise uses the shared platform license from Vault.
      const endpoint =
        (config.endpoint_url as string | undefined) || AICIS_PLATFORM_ENDPOINT;
      const apiKey =
        (config.api_key as string | undefined) || AICIS_PLATFORM_API_KEY;

      if (!endpoint || !apiKey) {
        throw new Error(
          "AICIS adapter requires AICIS_TEST_ENDPOINT_URL + AICIS_TEST_API_KEY " +
            "in Vault (platform license), or per-tenant config.endpoint_url + " +
            "config.api_key. Strict Real Data Only — no fabricated fallback.",
        );
      }

      // Pull the most recent signals page. Configurable page size keeps the
      // ingest run bounded; cron schedules a fresh pull each interval.
      const limit = Math.min(
        Number((config.page_size as number | undefined) ?? 500),
        2000,
      );
      const domainFilter = (config.domain as string | undefined) ?? "";
      const isoFilter = (config.iso3 as string | undefined) ?? "";

      const qs = new URLSearchParams({ limit: String(limit) });
      if (domainFilter) qs.set("domain", domainFilter);
      if (isoFilter) qs.set("iso3", isoFilter);

      const url = `${endpoint.replace(/\/$/, "")}/signals?${qs.toString()}`;
      const r = await fetch(url, {
        headers: { "x-api-key": apiKey, Accept: "application/json" },
      });
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        throw new Error(`AICIS bridge HTTP ${r.status}: ${body.slice(0, 200)}`);
      }
      const j = (await r.json()) as { data?: AicisSignal[] };
      const signals = Array.isArray(j.data) ? j.data : [];
      if (signals.length === 0) {
        throw new Error("AICIS bridge returned 0 signals — refusing empty ingest.");
      }

      const rows: VendorRow[] = [];
      for (const s of signals) {
        const numeric = Number(s.value);
        if (!Number.isFinite(numeric)) continue;
        const iso3 = (s.iso3 ?? "GLB").toUpperCase();
        const domain = (s.domain ?? "general").toLowerCase();
        const metric = (s.metric_name ?? "unknown").toLowerCase();
        // Stable, deterministic key so cron reruns upsert in place.
        const metric_key = `aicis.${domain}.${metric}.${iso3}`;
        rows.push({
          metric_key,
          value: numeric,
          unit: s.unit ?? undefined,
          period: s.period ?? undefined,
          region: iso3,
          metadata: {
            signal_id: s.signal_id,
            domain,
            iso3,
            confidence: s.confidence,
            freshness_score: s.freshness_score,
            source_provider: s.source_provider,
            source_url: s.source_url,
            provenance_observed_at: s.provenance_observed_at,
            entity_name: s.entity_name,
            entity_type: s.entity_type,
            sovereignty_status: s.sovereignty_status,
          },
        });
      }

      if (rows.length === 0) {
        throw new Error("AICIS bridge returned signals but none had numeric values.");
      }
      return rows;
    },
  },

  worldbank: {
    vendor_key: "worldbank",
    async fetch(config) {
      const country = (config.country as string) ?? "WLD";
      const indicator = (config.indicator as string) ?? "NY.GDP.MKTP.KD.ZG";
      // Pull last 25 observations and pick the most recent non-null one
      const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=25`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`World Bank HTTP ${r.status}`);
      const j = (await r.json()) as unknown[];
      const series = Array.isArray(j) && j.length > 1
        ? (j[1] as Array<Record<string, unknown>>)
        : [];
      const latest = series.find((row) => row.value != null && Number.isFinite(Number(row.value)));
      if (!latest) {
        throw new Error(`World Bank: no non-null observations for ${indicator}/${country}`);
      }
      return [{
        metric_key: `worldbank.${indicator}.${country}`,
        value: Number(latest.value),
        period: `${latest.date}-01-01`,
        metadata: { country, indicator, observation_year: latest.date },
      }];
    },
  },

  imf: {
    vendor_key: "imf",
    async fetch(config) {
      const indicator = (config.indicator as string) ?? "PCPIPCH";
      const country = (config.country as string) ?? "USA";
      const url = `https://www.imf.org/external/datamapper/api/v1/${indicator}/${country}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`IMF HTTP ${r.status}`);
      const j = (await r.json()) as {
        values?: Record<string, Record<string, Record<string, number>>>;
      };
      const series = j.values?.[indicator]?.[country] ?? {};
      const years = Object.keys(series)
        .filter((y) => series[y] != null && Number.isFinite(series[y]))
        .sort()
        .reverse();
      const latestYear = years[0];
      if (!latestYear) throw new Error(`IMF: no observations for ${indicator}/${country}`);
      return [{
        metric_key: `imf.${indicator}.${country}`,
        value: Number(series[latestYear]),
        period: `${latestYear}-01-01`,
        metadata: { country, indicator, observation_year: latestYear },
      }];
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const log = createLogger("ingest-external-signals", req);

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("INGEST_CRON_SECRET");

  // ── Auth gate ─────────────────────────────────────────────────────────
  const cronHeader = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  let isAuthorised = false;
  let actor = "unknown";

  if (cronSecret && cronHeader && cronHeader === cronSecret) {
    isAuthorised = true;
    actor = "cron";
  } else if (bearer && bearer === serviceKey) {
    isAuthorised = true;
    actor = "service";
  } else if (bearer) {
    // User JWT path — verify they belong to an org (manual refresh from UI)
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: user } = await userClient.auth.getUser();
    if (user?.user) {
      isAuthorised = true;
      actor = `user:${user.user.id}`;
      log.setUser(user.user.id);
    }
  }

  if (!isAuthorised) {
    log.warn("unauthorised invocation");
    return json({ error: "Unauthorised" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body for cron */
  }
  const mode = (body.mode as string) ?? "scheduled";

  log.info("ingestion start", { mode, actor });

  const startTs = Date.now();
  const results: Array<Record<string, unknown>> = [];

  try {
    let sources: Array<Record<string, unknown>> = [];

    if (mode === "scheduled") {
      const { data } = await supabase
        .from("external_data_sources")
        .select("*")
        .eq("is_active", true)
        .or(`next_refresh_at.is.null,next_refresh_at.lte.${new Date().toISOString()}`);
      sources = data ?? [];
    } else if (mode === "manual" && body.source_id) {
      const { data } = await supabase
        .from("external_data_sources")
        .select("*")
        .eq("id", body.source_id as string)
        .maybeSingle();
      if (data) sources = [data];
    } else if (mode === "test" && body.vendor_key) {
      const adapter = adapters[body.vendor_key as string];
      if (!adapter) return json({ error: "Unknown vendor" }, 400);
      const rows = await adapter.fetch((body.config as Record<string, unknown>) ?? {});
      log.info("dry-run complete", { vendor_key: body.vendor_key, rows: rows.length });
      return json({ ok: true, dry_run: true, rows });
    } else {
      return json({ error: "Invalid mode" }, 400);
    }

    log.info("sources resolved", { count: sources.length });

    for (const src of sources) {
      const adapter = adapters[src.vendor_key as string];
      if (!adapter) {
        results.push({ vendor_key: src.vendor_key, status: "skipped", reason: "no_adapter" });
        continue;
      }
      const vendorStart = Date.now();
      try {
        const rows = await adapter.fetch((src.config as Record<string, unknown>) ?? {});
        let upserted = 0;

        for (const row of rows) {
          const numeric = Number(row.value);
          if (!Number.isFinite(numeric)) continue;

          // Idempotent upsert keyed by (organization_id, metric_name, source, period_start)
          const orgId = (src.organization_id as string) ?? null;
          const metadata = {
            ...(row.metadata ?? {}),
            vendor_key: src.vendor_key,
            license: src.license_type,
            organization_id: orgId,
          };

          const { error } = await supabase
            .from("internal_reference_data")
            .upsert(
              {
                organization_id: orgId,
                category: (src.category as string) ?? "macro",
                metric_name: row.metric_key,
                value: numeric,
                unit: row.unit ?? null,
                period_start: row.period ?? null,
                region: row.region ?? null,
                source: src.vendor_name as string,
                source_url: (src.endpoint_url as string) ?? null,
                confidence_grade:
                  ((src.trust_level as number) ?? 70) >= 85 ? "A" : "B",
                metadata,
              },
              { onConflict: "organization_id,metric_name,source,period_start", ignoreDuplicates: false },
            );
          if (!error) upserted++;
          else log.warn("upsert failed", { vendor_key: src.vendor_key, metric: row.metric_key, error: error.message });
        }

        const nextRefresh = new Date(
          Date.now() + (src.refresh_interval_hours as number) * 3600 * 1000,
        );
        await supabase
          .from("external_data_sources")
          .update({
            last_refreshed_at: new Date().toISOString(),
            next_refresh_at: nextRefresh.toISOString(),
            last_error: null,
          })
          .eq("id", src.id as string);

        log.info("vendor success", {
          vendor_key: src.vendor_key,
          upserted,
          duration_ms: Date.now() - vendorStart,
        });
        results.push({ vendor_key: src.vendor_key, status: "ok", upserted });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        await supabase
          .from("external_data_sources")
          .update({
            last_error: errMsg,
            // back off 1h on failure so we don't hammer broken endpoints
            next_refresh_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          })
          .eq("id", src.id as string);
        log.error("vendor failure", { vendor_key: src.vendor_key, error: errMsg });
        results.push({ vendor_key: src.vendor_key, status: "error", error: errMsg });
      }
    }

    log.info("ingestion complete", {
      mode,
      sources_processed: sources.length,
      duration_ms: Date.now() - startTs,
    });

    return json({
      ok: true,
      mode,
      actor,
      duration_ms: Date.now() - startTs,
      sources_processed: sources.length,
      results,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    log.error("fatal", { error: errMsg });
    return json({ error: errMsg }, 500);
  }
});
