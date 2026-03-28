import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * Real-Time Event Streaming Endpoint
 * 
 * Lightweight, low-latency endpoint for streaming individual events.
 * Designed for: Kafka consumers, Lambda outputs, webhook chains, CDC streams.
 * 
 * POST /event-stream
 * Headers: x-api-key, x-event-type (required), x-idempotency-key (optional)
 * Body: single event object or array of events (max 1000)
 * 
 * Event types: metric, decision, alert, audit, custom
 */

const MAX_EVENTS = 1000;
const MAX_VALUE = 1e12;

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Auth via API key
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return respond({ error: "x-api-key header required" }, 401);

    const encoded = new TextEncoder().encode(apiKey);
    const hash = await crypto.subtle.digest("SHA-256", encoded);
    const keyHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");

    const { data: source } = await svc.from("data_sources")
      .select("id, organization_id, config")
      .eq("credentials_key_hash", keyHash)
      .eq("status", "active")
      .maybeSingle();

    if (!source) return respond({ error: "Invalid API key" }, 401);

    const orgId = source.organization_id;
    const sourceId = source.id;
    const eventType = req.headers.get("x-event-type") || "custom";
    const idempotencyKey = req.headers.get("x-idempotency-key");

    // Idempotency check
    if (idempotencyKey) {
      const { data: existing } = await svc.from("data_sync_jobs")
        .select("id, records_synced")
        .eq("request_id", idempotencyKey)
        .maybeSingle();
      if (existing) {
        return respond({ success: true, idempotent: true, records: existing.records_synced });
      }
    }

    const body = await req.json();
    const events = Array.isArray(body) ? body : [body];

    if (events.length > MAX_EVENTS) {
      return respond({ error: `Max ${MAX_EVENTS} events per request` }, 400);
    }

    const processed: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];

      switch (eventType) {
        case "metric": {
          const date = evt.date || evt.timestamp || new Date().toISOString().split("T")[0];
          const value = parseFloat(evt.value ?? evt.amount);
          if (isNaN(value) || !isFinite(value) || Math.abs(value) > MAX_VALUE) {
            errors.push(`Event ${i}: invalid value`);
            continue;
          }
          processed.push({
            organization_id: orgId,
            dataset_id: evt.dataset_id || undefined,
            metric_type: evt.metric_type || evt.type || "custom",
            date: new Date(date).toISOString().split("T")[0],
            value,
            region: (evt.region || "").toString().trim() || undefined,
            segment: (evt.segment || "").toString().trim() || undefined,
            source_type: "stream",
            source_id: sourceId,
            quality_score: 80,
          });
          break;
        }

        case "decision": {
          processed.push({
            organization_id: orgId,
            recommended_action: evt.action || evt.recommended_action || "No action specified",
            decision_type: evt.decision_type || "operational",
            decision_status: "pending",
            execution_status: "not_started",
            notes: evt.notes || evt.description || null,
            confidence_at_decision: evt.confidence ? parseFloat(evt.confidence) : null,
          });
          break;
        }

        case "alert": {
          processed.push({
            organization_id: orgId,
            actor_type: "external",
            action_type: evt.alert_type || "external_alert",
            resource_type: evt.resource_type || "system",
            resource_id: evt.resource_id || null,
            payload: {
              severity: evt.severity || "info",
              message: evt.message || evt.description,
              source: "event-stream",
              metadata: evt.metadata || {},
            },
          });
          break;
        }

        case "audit": {
          processed.push({
            organization_id: orgId,
            actor_type: evt.actor_type || "external",
            actor_id: evt.actor_id || null,
            action_type: evt.action || evt.action_type || "external_event",
            resource_type: evt.resource_type || "custom",
            resource_id: evt.resource_id || null,
            payload: evt.payload || evt.data || {},
          });
          break;
        }

        default: {
          // Custom events stored as audit entries
          processed.push({
            organization_id: orgId,
            actor_type: "external",
            action_type: `custom_${eventType}`,
            resource_type: "event_stream",
            resource_id: evt.id || null,
            payload: evt,
          });
        }
      }
    }

    // Batch insert based on event type
    let inserted = 0;
    const targetTable = eventType === "metric" ? "metrics"
      : eventType === "decision" ? "decision_ledger"
      : "audit_log";

    if (processed.length > 0) {
      if (eventType === "metric") {
        for (let i = 0; i < processed.length; i += 500) {
          const batch = processed.slice(i, i + 500);
          const { error } = await svc.from("metrics").upsert(batch, {
            onConflict: "organization_id,metric_type,date,region,segment,source_id",
          });
          if (error) errors.push(`Batch ${Math.floor(i / 500)}: ${error.message}`);
          else inserted += batch.length;
        }
      } else {
        const { error } = await svc.from(targetTable).insert(processed);
        if (error) errors.push(error.message);
        else inserted = processed.length;
      }
    }

    // Track job
    await svc.from("data_sync_jobs").insert({
      data_source_id: sourceId,
      organization_id: orgId,
      status: inserted > 0 ? "completed" : "failed",
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      records_synced: inserted,
      request_id: idempotencyKey || crypto.randomUUID(),
      error_message: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
    });

    return respond({
      success: inserted > 0,
      event_type: eventType,
      events_received: events.length,
      events_processed: inserted,
      events_rejected: errors.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      latency_ms: Date.now() - startTime,
    });
  } catch (err: unknown) {
    console.error("event-stream error:", err);
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
