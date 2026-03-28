import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
  const corsHeaders = getCorsHeaders(req);

const MAX_RECORDS_PER_REQUEST = 10_000;
const MAX_RECORDS_PER_HOUR = 50_000;
const MAX_BODY_SIZE = 100 * 1024; // 100KB
const MAX_VALUE = 1e12;
const MAX_DATE_AGE_YEARS = 5;

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function isValidISODate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(d) && !isNaN(Date.parse(d));
}

function structuredLog(step: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: "webhook-ingest", step, ts: new Date().toISOString(), ...details }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  let jobId: string | null = null;
  let sourceId: string | null = null;
  let orgId: string | null = null;

  const fail = async (status: number, error: string, details?: Record<string, unknown>) => {
    structuredLog("error", { source_id: sourceId, organization_id: orgId, request_id: req.headers.get("x-request-id"), error, ...details });
    if (jobId) {
      await supabase.from("data_sync_jobs").update({
        status: "failed",
        error_message: error,
        completed_at: new Date().toISOString(),
      }).eq("id", jobId);
    }
    return new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    // 1. Auth: hash incoming key and compare
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return fail(401, "x-api-key header required");

    const requestId = req.headers.get("x-request-id");
    if (!requestId) return fail(400, "x-request-id header required for idempotency");

    const keyHash = await sha256Hex(apiKey);

    const { data: source, error: srcErr } = await supabase
      .from("data_sources")
      .select("id, organization_id, name, config")
      .eq("credentials_key_hash", keyHash)
      .eq("source_type", "webhook")
      .eq("status", "active")
      .single();

    if (srcErr || !source) return fail(403, "Invalid API key");

    sourceId = source.id;
    orgId = source.organization_id;

    structuredLog("authenticated", { source_id: sourceId, organization_id: orgId, request_id: requestId });

    // 2. Idempotency: check duplicate request_id
    const { data: existingJob } = await supabase
      .from("data_sync_jobs")
      .select("id")
      .eq("request_id", requestId)
      .maybeSingle();

    if (existingJob) {
      return new Response(JSON.stringify({ error: "Duplicate request", request_id: requestId }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Subscription check
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("tier")
      .eq("organization_id", source.organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (!sub) return fail(403, "Active subscription required");

    // 4. Rate limiting: records in last hour
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { data: recentJobs } = await supabase
      .from("data_sync_jobs")
      .select("records_synced")
      .eq("data_source_id", sourceId)
      .eq("status", "completed")
      .gte("completed_at", oneHourAgo);

    const recentRecords = (recentJobs || []).reduce((sum, j) => sum + (j.records_synced || 0), 0);
    if (recentRecords >= MAX_RECORDS_PER_HOUR) {
      return fail(429, `Rate limit exceeded: ${MAX_RECORDS_PER_HOUR} records/hour`, { recent_records: recentRecords });
    }

    // 5. Body size check
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_BODY_SIZE) {
      return fail(413, `Request body exceeds ${MAX_BODY_SIZE} bytes limit`);
    }

    // Create sync job with request_id
    const { data: job } = await supabase
      .from("data_sync_jobs")
      .insert({
        data_source_id: sourceId,
        organization_id: orgId,
        status: "running",
        started_at: new Date().toISOString(),
        request_id: requestId,
      })
      .select()
      .single();

    jobId = job!.id;

    // 6. Parse & validate body
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_SIZE) {
      return fail(413, `Request body exceeds ${MAX_BODY_SIZE} bytes limit`);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail(400, "Invalid JSON body");
    }

    const records = Array.isArray(body) ? body : (body as any).records || (body as any).data || [body];

    if (records.length > MAX_RECORDS_PER_REQUEST) {
      return fail(400, `Exceeds max ${MAX_RECORDS_PER_REQUEST} records per request`, { received: records.length });
    }

    if (recentRecords + records.length > MAX_RECORDS_PER_HOUR) {
      return fail(429, `Would exceed hourly rate limit of ${MAX_RECORDS_PER_HOUR} records`, { current: recentRecords, incoming: records.length });
    }

    // 7. Map and validate records
    const fieldMap = (source.config as any)?.field_mapping || {};
    const defaultMetricType = (source.config as any)?.default_metric_type || "revenue";
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - MAX_DATE_AGE_YEARS);

    const errors: string[] = [];
    const metrics: any[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      let date = r[fieldMap.date || "date"];
      const rawValue = r[fieldMap.value || "value"];
      const value = parseFloat(rawValue);

      // Normalize year-only dates (e.g., "1990" → "1990-01-01")
      if (date && /^\d{4}$/.test(String(date).trim())) {
        date = `${String(date).trim()}-01-01`;
      }

      if (!date || !isValidISODate(date)) {
        errors.push(`Record ${i}: invalid date "${date}"`);
        continue;
      }
      if (new Date(date) < minDate) {
        errors.push(`Record ${i}: date older than ${MAX_DATE_AGE_YEARS} years`);
        continue;
      }
      if (isNaN(value) || !isFinite(value)) {
        errors.push(`Record ${i}: value must be a finite number`);
        continue;
      }
      if (Math.abs(value) > MAX_VALUE) {
        errors.push(`Record ${i}: value exceeds max ${MAX_VALUE}`);
        continue;
      }

      metrics.push({
        organization_id: orgId,
        metric_type: r[fieldMap.metric_type || "metric_type"] || defaultMetricType,
        date,
        value,
        region: (r[fieldMap.region || "region"] || "").trim() || "",
        segment: (r[fieldMap.segment || "segment"] || "").trim() || "",
        source_id: sourceId,
      });
    }

    if (metrics.length === 0) {
      return fail(400, "No valid records after validation", { validation_errors: errors });
    }

    // 8. Batch insert
    let inserted = 0;
    for (let i = 0; i < metrics.length; i += 500) {
      const batch = metrics.slice(i, i + 500);
      const { error } = await supabase.from("metrics").upsert(batch, { onConflict: "organization_id,metric_type,date,region,segment,source_id" });
      if (error) throw error;
      inserted += batch.length;
    }

    // 9. Complete job
    await supabase.from("data_sync_jobs").update({
      status: "completed",
      records_synced: inserted,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    await supabase.from("data_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", sourceId);

    const executionMs = Date.now() - startTime;
    structuredLog("complete", {
      source_id: sourceId,
      organization_id: orgId,
      request_id: requestId,
      record_count: inserted,
      skipped: errors.length,
      execution_time_ms: executionMs,
      job_id: jobId,
    });

    return new Response(
      JSON.stringify({
        success: true,
        records_synced: inserted,
        records_skipped: errors.length,
        validation_errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
        job_id: jobId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(500, message);
  }
});
