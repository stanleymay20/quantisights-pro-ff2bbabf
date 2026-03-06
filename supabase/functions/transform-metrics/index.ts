import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_VALUE = 1e12;

function cleanNumeric(raw: string | undefined | null): number {
  if (!raw || typeof raw !== "string") return NaN;
  const cleaned = raw
    .replace(/[\s$€£¥₹,]/g, "")
    .replace(/\(([^)]+)\)/, "-$1");
  return parseFloat(cleaned);
}

function normalizeDate(val: string | undefined | null): string | null {
  if (!val) return null;
  const trimmed = String(val).trim();
  // Year-only
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;
  // Quarter: 2024-Q1
  if (/^\d{4}[/-]Q[1-4]$/i.test(trimmed)) {
    const y = trimmed.slice(0, 4);
    const q = parseInt(trimmed.slice(-1));
    return `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
  }
  // Month: 2024-01
  if (/^\d{4}[/-]\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  // Full date
  if (!isNaN(Date.parse(trimmed))) return trimmed;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, dataset_id, pipeline_run_id, column_mapping, headers: colHeaders, default_metric_type, workspace_id } = await req.json();

    if (!organization_id || !dataset_id) {
      return new Response(JSON.stringify({ error: "organization_id and dataset_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Update pipeline stage
    if (pipeline_run_id) {
      await supabase.from("pipeline_runs").update({ stage: "transforming", status: "running" }).eq("id", pipeline_run_id);
    }

    // Build field index mapping from column_mapping
    // column_mapping format: { "colIdx": "target_type" } e.g. { "0": "date", "1": "value", "2": "region" }
    const mapping: Record<string, string> = column_mapping || {};
    const dateIdx = Object.entries(mapping).find(([, v]) => v === "date")?.[0];
    const valueIndices = Object.entries(mapping).filter(([, v]) => v === "value").map(([k]) => k);
    const regionIdx = Object.entries(mapping).find(([, v]) => v === "region")?.[0];
    const regionCodeIdx = Object.entries(mapping).find(([, v]) => v === "region_code")?.[0];
    const segmentIdx = Object.entries(mapping).find(([, v]) => v === "segment")?.[0];
    const metricTypeIdx = Object.entries(mapping).find(([, v]) => v === "metric_type")?.[0];

    const isMultiMetric = valueIndices.length > 1;
    const headerNames: string[] = colHeaders || [];

    // Compute slugified metric names for multi-metric
    const metricSlugs: string[] = valueIndices.map(idx => {
      const name = headerNames[Number(idx)] || `metric_${idx}`;
      return name.toLowerCase()
        .replace(/[%]/g, "_pct").replace(/[/]/g, "_per_")
        .replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "").replace(/_+/g, "_");
    });
    // Deduplicate
    const slugCounts = new Map<string, number>();
    const dedupedSlugs = metricSlugs.map(s => {
      const count = (slugCounts.get(s) ?? 0) + 1;
      slugCounts.set(s, count);
      return count > 1 ? `${s}_${count}` : s;
    });

    const NULL_SOURCE = "00000000-0000-0000-0000-000000000000";

    // Fetch raw records in batches
    let offset = 0;
    const batchSize = 1000;
    let totalTransformed = 0;
    let totalErrors = 0;

    while (true) {
      const { data: rawBatch, error: fetchErr } = await supabase
        .from("raw_records")
        .select("id, row_index, raw_data")
        .eq("dataset_id", dataset_id)
        .eq("transform_status", "pending")
        .order("row_index", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (fetchErr) throw fetchErr;
      if (!rawBatch || rawBatch.length === 0) break;

      const metricsToUpsert: Record<string, unknown>[] = [];
      const transformedIds: string[] = [];
      const failedUpdates: { id: string; error: string }[] = [];

      for (const raw of rawBatch) {
        const d = raw.raw_data as Record<string, string>;
        
        // Extract date (optional — dateless datasets get synthetic dates)
        const dateRaw = dateIdx !== undefined ? d[dateIdx] : null;
        let dateVal: string | null = null;
        if (dateRaw) {
          dateVal = normalizeDate(dateRaw);
        }
        if (!dateVal) {
          // Generate synthetic date spread across months/years to avoid upsert collision
          const syntheticYear = 2024 + Math.floor(raw.row_index / 365);
          const dayOfYear = raw.row_index % 365;
          const syntheticMonth = Math.floor(dayOfYear / 28) % 12 + 1;
          const syntheticDay = (dayOfYear % 28) + 1;
          dateVal = `${syntheticYear}-${String(syntheticMonth).padStart(2, "0")}-${String(syntheticDay).padStart(2, "0")}`;
        }

        const regionVal = regionIdx !== undefined ? (d[regionIdx]?.trim() || "") : "";
        const regionCodeVal = regionCodeIdx !== undefined ? (d[regionCodeIdx]?.trim() || "") : "";
        const effectiveRegion = regionVal || regionCodeVal || "";
        const segmentVal = segmentIdx !== undefined ? (d[segmentIdx]?.trim() || "") : "";

        if (isMultiMetric) {
          for (let vi = 0; vi < valueIndices.length; vi++) {
            const valIdx = valueIndices[vi];
            const val = cleanNumeric(d[valIdx]);
            if (isNaN(val) || !isFinite(val) || Math.abs(val) > MAX_VALUE) continue;
            metricsToUpsert.push({
              organization_id, dataset_id,
              workspace_id: workspace_id || null,
              metric_type: dedupedSlugs[vi],
              value: val, date: dateVal,
              region: effectiveRegion, segment: segmentVal,
              source_id: NULL_SOURCE,
            });
          }
        } else {
          const valIdx = valueIndices[0];
          if (!valIdx) { failedUpdates.push({ id: raw.id, error: "No value column" }); continue; }
          const val = cleanNumeric(d[valIdx]);
          if (isNaN(val) || !isFinite(val) || Math.abs(val) > MAX_VALUE) {
            failedUpdates.push({ id: raw.id, error: `Invalid value: "${d[valIdx]}"` });
            continue;
          }
          const mt = metricTypeIdx !== undefined ? (d[metricTypeIdx]?.trim() || default_metric_type || "revenue") : (default_metric_type || "revenue");
          metricsToUpsert.push({
            organization_id, dataset_id,
            workspace_id: workspace_id || null,
            metric_type: mt, value: val, date: dateVal,
            region: effectiveRegion, segment: segmentVal,
            source_id: NULL_SOURCE,
          });
        }
        transformedIds.push(raw.id);
      }

      // Batch upsert metrics
      if (metricsToUpsert.length > 0) {
        for (let i = 0; i < metricsToUpsert.length; i += 500) {
          const batch = metricsToUpsert.slice(i, i + 500);
          const { error } = await supabase.from("metrics").upsert(batch, {
            onConflict: "organization_id,metric_type,date,region,segment,source_id",
          });
          if (error) throw error;
        }
      }

      // Mark transformed
      if (transformedIds.length > 0) {
        await supabase.from("raw_records")
          .update({ transform_status: "transformed", transformed_at: new Date().toISOString() })
          .in("id", transformedIds);
        totalTransformed += transformedIds.length;
      }

      // Mark failed
      for (const fail of failedUpdates) {
        await supabase.from("raw_records")
          .update({ transform_status: "failed", transform_error: fail.error })
          .eq("id", fail.id);
        totalErrors++;
      }

      offset += batchSize;
    }

    // Update pipeline run
    if (pipeline_run_id) {
      await supabase.from("pipeline_runs").update({
        stage: "transform_complete",
        transformed_count: totalTransformed,
        error_count: totalErrors,
      }).eq("id", pipeline_run_id);
    }

    return new Response(JSON.stringify({
      success: true,
      transformed: totalTransformed,
      errors: totalErrors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
