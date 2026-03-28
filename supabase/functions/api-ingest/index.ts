import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
  const corsHeaders = getCorsHeaders(req);

/**
 * Enterprise API Ingestion Endpoint
 * 
 * Programmatic REST API for data ingestion at scale.
 * Supports: batch records, streaming chunks, schema validation.
 * Auth: Bearer token (user JWT) or x-api-key (service account).
 * 
 * POST /api-ingest
 * Headers: Authorization or x-api-key, x-request-id (required), x-dataset-id (optional)
 * Body: { records: [...], dataset_name?: string, metric_type?: string }
 * 
 * Supports up to 50,000 records per request with streaming batch insert.
 */

const MAX_RECORDS = 50_000;
const BATCH_SIZE = 1000;
const MAX_VALUE = 1e12;

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  const respond = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const requestId = req.headers.get("x-request-id");
    if (!requestId) return respond({ error: "x-request-id header required for idempotency" }, 400);

    // Auth: support both JWT and API key
    let userId: string | null = null;
    let orgId: string | null = null;

    const authHeader = req.headers.get("authorization");
    const apiKey = req.headers.get("x-api-key");

    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) return respond({ error: "Invalid authorization token" }, 401);
      userId = user.id;

      // Get org from profile
      const { data: profile } = await svc.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle();
      orgId = profile?.organization_id;
    } else if (apiKey) {
      // Hash-based API key lookup
      const encoded = new TextEncoder().encode(apiKey);
      const hash = await crypto.subtle.digest("SHA-256", encoded);
      const keyHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");

      const { data: source } = await svc.from("data_sources")
        .select("id, organization_id")
        .eq("credentials_key_hash", keyHash)
        .eq("status", "active")
        .maybeSingle();

      if (!source) return respond({ error: "Invalid API key" }, 401);
      orgId = source.organization_id;
    } else {
      return respond({ error: "Authorization header or x-api-key required" }, 401);
    }

    if (!orgId) return respond({ error: "Organization not found" }, 403);

    // Idempotency check
    const { data: existing } = await svc.from("data_sync_jobs")
      .select("id, records_synced")
      .eq("request_id", requestId)
      .maybeSingle();

    if (existing) {
      return respond({
        success: true,
        idempotent_replay: true,
        records_synced: existing.records_synced,
        job_id: existing.id,
      });
    }

    // Parse body
    const body = await req.json();
    const records = Array.isArray(body) ? body : (body.records || body.data || [body]);
    const defaultMetricType = body.metric_type || body.default_metric_type;
    const datasetName = body.dataset_name;
    const datasetIdHeader = req.headers.get("x-dataset-id");

    if (records.length > MAX_RECORDS) {
      return respond({ error: `Max ${MAX_RECORDS} records per request. Received: ${records.length}` }, 400);
    }

    // Create sync job
    const { data: job } = await svc.from("data_sync_jobs").insert({
      organization_id: orgId,
      data_source_id: orgId, // self-reference for API ingestion
      status: "running",
      started_at: new Date().toISOString(),
      request_id: requestId,
    }).select("id").single();

    // Resolve or create dataset
    let datasetId = datasetIdHeader;
    if (!datasetId && datasetName) {
      const { data: existingDs } = await svc.from("datasets")
        .select("id")
        .eq("organization_id", orgId)
        .eq("name", datasetName)
        .maybeSingle();

      if (existingDs) {
        datasetId = existingDs.id;
      } else if (userId) {
        const { data: newDs } = await svc.from("datasets").insert({
          organization_id: orgId,
          name: datasetName,
          uploaded_by: userId,
          status: "active",
          row_count: records.length,
        }).select("id").single();
        datasetId = newDs?.id;
      }
    }

    // Validate and transform records
    const errors: string[] = [];
    const metrics: any[] = [];
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 5);

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      let date = r.date || r.period || r.timestamp;
      const rawValue = r.value || r.amount || r.metric_value;
      const value = parseFloat(rawValue);

      // Normalize year-only
      if (date && /^\d{4}$/.test(String(date).trim())) {
        date = `${String(date).trim()}-01-01`;
      }

      if (!date || isNaN(Date.parse(date))) {
        errors.push(`Record ${i}: invalid date "${date}"`);
        continue;
      }
      if (new Date(date) < minDate) {
        errors.push(`Record ${i}: date older than 5 years`);
        continue;
      }
      if (isNaN(value) || !isFinite(value) || Math.abs(value) > MAX_VALUE) {
        errors.push(`Record ${i}: invalid value "${rawValue}"`);
        continue;
      }

      metrics.push({
        organization_id: orgId,
        dataset_id: datasetId || undefined,
        metric_type: r.metric_type || r.type || r.metric || defaultMetricType || "custom",
        date: new Date(date).toISOString().split("T")[0],
        value,
        region: (r.region || r.country || "").toString().trim() || undefined,
        segment: (r.segment || r.category || "").toString().trim() || undefined,
        source_type: "api",
        quality_score: 85,
      });
    }

    // Batch insert with streaming
    let inserted = 0;
    for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
      const batch = metrics.slice(i, i + BATCH_SIZE);
      const { error } = await svc.from("metrics").upsert(batch, {
        onConflict: "organization_id,metric_type,date,region,segment,source_id",
      });
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    // Update job
    await svc.from("data_sync_jobs").update({
      status: errors.length > 0 && inserted === 0 ? "failed" : "completed",
      records_synced: inserted,
      error_message: errors.length > 0 ? errors.slice(0, 10).join("; ") : null,
      completed_at: new Date().toISOString(),
    }).eq("id", job!.id);

    // Update dataset row count
    if (datasetId) {
      await svc.from("datasets").update({
        row_count: inserted,
        last_refreshed_at: new Date().toISOString(),
      }).eq("id", datasetId);
    }

    return respond({
      success: true,
      job_id: job!.id,
      records_received: records.length,
      records_inserted: inserted,
      records_rejected: errors.length,
      dataset_id: datasetId,
      validation_errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      execution_ms: Date.now() - startTime,
      api_version: "v1",
    });
  } catch (err: unknown) {
    console.error("api-ingest error:", err);
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
