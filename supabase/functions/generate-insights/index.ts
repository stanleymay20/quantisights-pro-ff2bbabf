import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyAdaptiveConfidence, fetchCalibrationModel } from "../_shared/adaptive-confidence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;
    const body = await req.json();
    const { organization_id, dataset_id, dry_run } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: corsHeaders });
    }
    if (!dataset_id) {
      return new Response(JSON.stringify({ error: "dataset_id required by Active Data Contract" }), { status: 400, headers: corsHeaders });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member" }), { status: 403, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceSupabase = createClient(supabaseUrl, serviceKey);

    // Validate dataset belongs to org
    const { data: dsCheck } = await serviceSupabase
      .from("datasets")
      .select("id")
      .eq("id", dataset_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (!dsCheck) {
      return new Response(JSON.stringify({ error: "dataset_id does not belong to this organization" }), { status: 403, headers: corsHeaders });
    }

    if (dry_run) {
      return new Response(JSON.stringify({ dry_run: true, status: "PASS", dataset_id, organization_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No subscription gate — insights should work for all tiers
    const { data: metrics } = await supabase
      .from("metrics")
      .select("metric_type, value, date, region, segment")
      .eq("organization_id", organization_id)
      .eq("dataset_id", dataset_id)
      .order("date", { ascending: true });

    if (!metrics || metrics.length === 0) {
      return new Response(JSON.stringify({ message: "No metrics to analyze", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calModel = await fetchCalibrationModel(supabaseUrl, serviceKey, organization_id);
    const { computeVariance } = await import("../_shared/adaptive-confidence.ts");

    // Group metrics by type with statistical summary
    const metricsByType: Record<string, { values: number[]; dates: string[]; regions: Set<string>; segments: Set<string> }> = {};
    for (const m of metrics) {
      if (!metricsByType[m.metric_type]) {
        metricsByType[m.metric_type] = { values: [], dates: [], regions: new Set(), segments: new Set() };
      }
      metricsByType[m.metric_type].values.push(Number(m.value));
      metricsByType[m.metric_type].dates.push(m.date);
      if (m.region) metricsByType[m.metric_type].regions.add(m.region);
      if (m.segment) metricsByType[m.metric_type].segments.add(m.segment);
    }

    // Build statistical summaries for AI
    const metricSummaries = Object.entries(metricsByType).map(([type, data]) => {
      const vals = data.values;
      const n = vals.length;
      const mean = vals.reduce((s, v) => s + v, 0) / n;
      const latest = vals[n - 1];
      const earliest = vals[0];
      const changePct = earliest !== 0 ? ((latest - earliest) / Math.abs(earliest)) * 100 : 0;
      const half = Math.floor(n / 2);
      const recentAvg = vals.slice(half).reduce((s, v) => s + v, 0) / vals.slice(half).length;
      const earlyAvg = vals.slice(0, half).length > 0 ? vals.slice(0, half).reduce((s, v) => s + v, 0) / vals.slice(0, half).length : recentAvg;
      const trendPct = earlyAvg !== 0 ? ((recentAvg - earlyAvg) / Math.abs(earlyAvg)) * 100 : 0;
      const volatility = mean !== 0 ? (Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n) / Math.abs(mean)) * 100 : 0;

      return {
        metric_type: type,
        data_points: n,
        date_range: `${data.dates[0]} to ${data.dates[n - 1]}`,
        latest_value: Number(latest.toFixed(4)),
        earliest_value: Number(earliest.toFixed(4)),
        total_change_pct: Number(changePct.toFixed(2)),
        recent_trend_pct: Number(trendPct.toFixed(2)),
        mean: Number(mean.toFixed(4)),
        min: Number(Math.min(...vals).toFixed(4)),
        max: Number(Math.max(...vals).toFixed(4)),
        volatility_pct: Number(volatility.toFixed(2)),
        regions: [...data.regions],
        segments: [...data.segments],
      };
    });

    // Use AI to generate domain-agnostic insights
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    let aiInsights: any[] = [];

    if (LOVABLE_API_KEY) {
      const aiController = new AbortController();
      const aiTimeout = setTimeout(() => aiController.abort(), 30000);
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: aiController.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: `You are an enterprise data intelligence engine. Analyze the following dataset metrics and generate strategic insights.

METRIC SUMMARIES:
${JSON.stringify(metricSummaries, null, 2)}

Generate 5-10 insights. Return ONLY a JSON array:
[
  {
    "message": "Clear, actionable insight (1-2 sentences referencing specific metrics and values)",
    "severity": "high" | "medium" | "info",
    "category": "trend" | "anomaly" | "risk" | "opportunity" | "regional" | "general",
    "raw_confidence": 60-90
  }
]

Rules:
- Be domain-agnostic — these could be economic, financial, SaaS, or industrial metrics
- Reference actual metric names, values, and percentage changes
- High severity: significant declines (>10%), extreme volatility (>50%), or critical thresholds
- Medium severity: moderate changes (5-10%), emerging trends, notable patterns
- Info: positive trends, stable metrics, opportunities
- At least 1 high severity if any metric shows >10% decline or >40% volatility
- Return ONLY the JSON array`,
          }],
        }),
      });

      clearTimeout(aiTimeout);

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            aiInsights = JSON.parse(jsonMatch[0]);
          } catch {
            console.error("Failed to parse AI insights JSON");
          }
        }
      }
    }

    // Fallback: rule-based analysis if AI fails or is unavailable
    if (aiInsights.length === 0) {
      for (const [type, data] of Object.entries(metricsByType)) {
        const vals = data.values;
        if (vals.length < 2) continue;
        const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
        const latest = vals[vals.length - 1];
        const earliest = vals[0];
        const changePct = earliest !== 0 ? ((latest - earliest) / Math.abs(earliest)) * 100 : 0;
        const volatility = mean !== 0 ? (Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) / Math.abs(mean)) * 100 : 0;

        if (changePct < -10) {
          aiInsights.push({
            message: `${type.replace(/_/g, ' ')} declined ${Math.abs(changePct).toFixed(1)}% over the dataset period. Review contributing factors.`,
            severity: "high",
            category: "trend",
            raw_confidence: 80,
          });
        } else if (changePct > 20) {
          aiInsights.push({
            message: `${type.replace(/_/g, ' ')} grew ${changePct.toFixed(1)}%. Strong upward trajectory detected.`,
            severity: "info",
            category: "opportunity",
            raw_confidence: 78,
          });
        }
        if (volatility > 40) {
          aiInsights.push({
            message: `${type.replace(/_/g, ' ')} shows high volatility (${volatility.toFixed(1)}% CV). Monitor for stability risks.`,
            severity: "medium",
            category: "risk",
            raw_confidence: 72,
          });
        }
      }

      if (aiInsights.length === 0) {
        aiInsights.push({
          message: "All metrics within normal ranges. Continue monitoring for changes.",
          severity: "info",
          category: "general",
          raw_confidence: 90,
        });
      }
    }

    // Apply confidence capping
    const insightRows = aiInsights.map((i: any) => {
      const rawConf = i.raw_confidence || 70;
      const sampleSize = metrics.length;
      const meta = applyAdaptiveConfidence({
        rawConfidence: rawConf, sampleSize, calibrationModel: calModel,
      });

      return {
        organization_id,
        dataset_id,
        message: i.message,
        severity: i.severity || "info",
        category: i.category || "general",
        confidence_score: meta.confidence,
        raw_confidence: meta.raw_confidence,
        capped_confidence: meta.capped_confidence,
        confidence_cap_reason: meta.confidence_cap_reason,
        sample_size: meta.sample_size,
        variance_score: meta.variance_score,
        data_quality_index: 100,
      };
    });

    // Clean old insights for this dataset
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await serviceSupabase
      .from("insights")
      .delete()
      .eq("organization_id", organization_id)
      .eq("dataset_id", dataset_id)
      .lt("created_at", yesterday);

    const { error: insertError } = await serviceSupabase.from("insights").insert(insightRows);
    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ message: "Insights generated", count: insightRows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
