import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { enforceDatasetContract } from "../_shared/dataset-contract.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * Data Profiler — Enterprise Statistical Profiling Engine
 * 
 * Automatically profiles datasets on demand: distributions, nulls, outliers,
 * correlations, cardinality, and statistical moments for every column.
 * 
 * POST /data-profiler
 * Body: { dataset_id, organization_id }
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Auth guard
    const auth = await authenticateRequest(req);
    if (auth.response) return auth.response;

    const body = await req.json();
    const { dataset_id, organization_id } = body;

    // Enforce Active Data Contract
    const contract = await enforceDatasetContract(body, svc);
    if (!contract.valid) return contract.response!;
    if (contract.dry_run) return contract.response!;

    // Verify org membership
    const isMember = await verifyOrgMembership(auth.userId, organization_id);
    if (!isMember) {
      return respond({ error: "Forbidden: not a member of this organization" }, 403);
    }

    // Fetch metrics for this dataset
    const { data: metrics, error: mErr } = await svc.from("metrics")
      .select("metric_type, date, value, region, segment, source_type, quality_score")
      .eq("organization_id", organization_id)
      .eq("dataset_id", dataset_id)
      .limit(50000);

    if (mErr) throw mErr;
    if (!metrics || metrics.length === 0) return respond({ error: "No metrics found for dataset" }, 404);

    // Group by metric_type
    const byType: Record<string, number[]> = {};
    const regions = new Set<string>();
    const segments = new Set<string>();
    const dateRange = { min: "", max: "" };
    let totalNulls = 0;
    const totalRecords = metrics.length;

    for (const m of metrics) {
      const mt = m.metric_type || "unknown";
      if (!byType[mt]) byType[mt] = [];
      byType[mt].push(m.value);

      if (m.region) regions.add(m.region);
      if (m.segment) segments.add(m.segment);

      if (!dateRange.min || m.date < dateRange.min) dateRange.min = m.date;
      if (!dateRange.max || m.date > dateRange.max) dateRange.max = m.date;

      if (m.value === null || m.value === undefined) totalNulls++;
    }

    // Statistical profiling per metric type
    const metricProfiles: Record<string, unknown> = {};

    for (const [type, values] of Object.entries(byType)) {
      const sorted = [...values].sort((a, b) => a - b);
      const n = sorted.length;
      const sum = sorted.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const variance = sorted.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance);
      const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
      const p5 = sorted[Math.floor(n * 0.05)];
      const p25 = sorted[Math.floor(n * 0.25)];
      const p75 = sorted[Math.floor(n * 0.75)];
      const p95 = sorted[Math.floor(n * 0.95)];
      const iqr = p75 - p25;
      const lowerFence = p25 - 1.5 * iqr;
      const upperFence = p75 + 1.5 * iqr;
      const outliers = sorted.filter(v => v < lowerFence || v > upperFence);

      const skewness = stdDev > 0
        ? sorted.reduce((a, v) => a + ((v - mean) / stdDev) ** 3, 0) / n
        : 0;

      const kurtosis = stdDev > 0
        ? sorted.reduce((a, v) => a + ((v - mean) / stdDev) ** 4, 0) / n - 3
        : 0;

      const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

      let distribution = "normal";
      if (Math.abs(skewness) > 1) distribution = skewness > 0 ? "right_skewed" : "left_skewed";
      else if (kurtosis > 3) distribution = "leptokurtic";
      else if (kurtosis < -1) distribution = "platykurtic";

      const binCount = Math.min(10, n);
      const binWidth = (sorted[n - 1] - sorted[0]) / binCount || 1;
      const histogram = Array(binCount).fill(0);
      for (const v of sorted) {
        const bin = Math.min(Math.floor((v - sorted[0]) / binWidth), binCount - 1);
        histogram[bin]++;
      }

      metricProfiles[type] = {
        count: n,
        mean: +mean.toFixed(4),
        median: +median.toFixed(4),
        std_dev: +stdDev.toFixed(4),
        variance: +variance.toFixed(4),
        min: sorted[0],
        max: sorted[n - 1],
        range: +(sorted[n - 1] - sorted[0]).toFixed(4),
        percentiles: { p5, p25, p50: median, p75, p95 },
        iqr: +iqr.toFixed(4),
        skewness: +skewness.toFixed(4),
        kurtosis: +kurtosis.toFixed(4),
        coefficient_of_variation: +cv.toFixed(2),
        distribution_shape: distribution,
        outlier_count: outliers.length,
        outlier_percentage: +((outliers.length / n) * 100).toFixed(2),
        outlier_bounds: { lower: +lowerFence.toFixed(4), upper: +upperFence.toFixed(4) },
        histogram: histogram.map((count, i) => ({
          bin_start: +(sorted[0] + i * binWidth).toFixed(2),
          bin_end: +(sorted[0] + (i + 1) * binWidth).toFixed(2),
          count,
        })),
      };
    }

    // Cross-metric correlations (Pearson)
    const metricTypes = Object.keys(byType);
    const correlations: Record<string, number> = {};
    if (metricTypes.length > 1) {
      for (let i = 0; i < metricTypes.length; i++) {
        for (let j = i + 1; j < metricTypes.length; j++) {
          const a = byType[metricTypes[i]];
          const b = byType[metricTypes[j]];
          const minLen = Math.min(a.length, b.length);
          if (minLen < 3) continue;

          const meanA = a.slice(0, minLen).reduce((s, v) => s + v, 0) / minLen;
          const meanB = b.slice(0, minLen).reduce((s, v) => s + v, 0) / minLen;
          let num = 0, denA = 0, denB = 0;
          for (let k = 0; k < minLen; k++) {
            const da = a[k] - meanA;
            const db = b[k] - meanB;
            num += da * db;
            denA += da * da;
            denB += db * db;
          }
          const denom = Math.sqrt(denA * denB);
          if (denom > 0) {
            correlations[`${metricTypes[i]}↔${metricTypes[j]}`] = +(num / denom).toFixed(4);
          }
        }
      }
    }

    // Data quality assessment
    const qualityScore = Math.round(
      (1 - totalNulls / totalRecords) * 40 +
      (Object.values(metricProfiles).every((p: any) => p.outlier_percentage < 10) ? 30 : 15) +
      (totalRecords >= 30 ? 30 : (totalRecords / 30) * 30)
    );

    const profile = {
      dataset_id,
      profiled_at: new Date().toISOString(),
      total_records: totalRecords,
      metric_types: metricTypes.length,
      unique_regions: regions.size,
      unique_segments: segments.size,
      date_range: dateRange,
      null_percentage: +((totalNulls / totalRecords) * 100).toFixed(2),
      quality_score: qualityScore,
      metric_profiles: metricProfiles,
      correlations,
      cardinality: {
        regions: [...regions].slice(0, 50),
        segments: [...segments].slice(0, 50),
        metric_types: metricTypes,
      },
    };

    // Store profile as data quality check
    await svc.from("data_quality_checks").insert({
      organization_id,
      dataset_id,
      check_type: "statistical_profile",
      status: qualityScore >= 70 ? "completed" : "warning",
      score: qualityScore,
      records_checked: totalRecords,
      details: profile,
    });

    // Audit log
    await svc.from("audit_log").insert({
      organization_id,
      actor_type: "user",
      actor_id: auth.userId,
      action_type: "data_profile",
      resource_type: "dataset",
      resource_id: dataset_id,
      payload: { quality_score: qualityScore, total_records: totalRecords, metric_types: metricTypes.length },
    });

    return respond({ success: true, profile });
  } catch (err: unknown) {
    console.error("data-profiler error:", err);
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
