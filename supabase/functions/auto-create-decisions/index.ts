import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * Auto-Create Decisions from Advisory Instances
 * 
 * Takes open advisory instances and creates decision_ledger entries
 * with full explanation metadata for transparency and auditability.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { organization_id, dataset_id } = body;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: corsHeaders });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organization_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch open advisories that don't yet have linked decisions
    let advisoryQuery = serviceSupabase
      .from("advisory_instances")
      .select("id, title, action, category, priority, confidence, capped_confidence, raw_confidence, confidence_cap_reason, expected_impact, rationale, kpi_affected, dataset_id, advisory_type, source_evidence, data_quality_index, data_snapshot_date, variance_score")
      .eq("organization_id", organization_id)
      .eq("status", "open")
      .in("priority", ["critical", "high", "medium"])
      .order("priority", { ascending: true })
      .limit(20);

    if (dataset_id) {
      advisoryQuery = advisoryQuery.eq("dataset_id", dataset_id);
    }

    const { data: advisories, error: advError } = await advisoryQuery;
    if (advError) throw new Error(`Failed to fetch advisories: ${advError.message}`);
    if (!advisories || advisories.length === 0) {
      return new Response(JSON.stringify({ message: "No open advisories to convert", created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which advisories already have linked decisions
    const advisoryIds = advisories.map(a => a.id);
    const { data: existingDecisions } = await serviceSupabase
      .from("decision_ledger")
      .select("advisory_instance_id")
      .eq("organization_id", organization_id)
      .in("advisory_instance_id", advisoryIds);

    const existingAdvisoryIds = new Set((existingDecisions ?? []).map(d => d.advisory_instance_id));
    const newAdvisories = advisories.filter(a => !existingAdvisoryIds.has(a.id));

    if (newAdvisories.length === 0) {
      return new Response(JSON.stringify({ message: "All advisories already have decisions", created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch dataset info for explanation metadata
    const datasetIds = [...new Set(newAdvisories.map(a => a.dataset_id).filter(Boolean))];
    let datasetMap: Record<string, { name: string; row_count: number | null }> = {};
    if (datasetIds.length > 0) {
      const { data: datasets } = await serviceSupabase
        .from("datasets")
        .select("id, name, row_count")
        .in("id", datasetIds);
      if (datasets) {
        datasetMap = Object.fromEntries(datasets.map(d => [d.id, { name: d.name, row_count: d.row_count }]));
      }
    }

    // Create decision ledger entries with explanation metadata
    const decisionRows = newAdvisories.map(a => {
      const dsInfo = a.dataset_id ? datasetMap[a.dataset_id] : null;
      const logicType = detectLogicType(a.advisory_type, a.title, a.action);
      const assumptions = buildAssumptions(a);
      const limitations = buildLimitations(a);

      const explanationMetadata = {
        source_data: {
          dataset_name: dsInfo?.name ?? "Unknown dataset",
          dataset_id: a.dataset_id,
          time_range: a.data_snapshot_date
            ? `Up to ${a.data_snapshot_date}`
            : "Latest available data",
          rows_analyzed: dsInfo?.row_count ?? null,
          key_metrics: extractKeyMetrics(a.kpi_affected),
        },
        triggering_insight: {
          pattern_type: logicType,
          description: a.title,
          metric_name: extractPrimaryMetric(a.kpi_affected),
          change_value: extractChangeValue(a.title, a.action),
          change_direction: detectDirection(a.title, a.action),
        },
        reasoning: {
          what_happened: a.title,
          why_it_matters: buildWhyItMatters(a),
          why_this_recommendation: a.rationale ?? a.action,
        },
        recommendation_logic: {
          method: logicType,
          description: describeLogic(logicType),
        },
        expected_impact: {
          range: a.expected_impact ?? null,
          basis: a.source_evidence
            ? "Based on historical data patterns and statistical analysis"
            : "Based on detected trend analysis",
        },
        confidence_explanation: {
          score: a.capped_confidence ?? a.confidence,
          meaning: describeConfidence(a.capped_confidence ?? a.confidence),
          capped: a.raw_confidence != null && a.capped_confidence != null && a.raw_confidence !== a.capped_confidence,
          cap_reason: a.confidence_cap_reason,
        },
        assumptions,
        limitations,
      };

      return {
        organization_id,
        advisory_instance_id: a.id,
        decision_type: a.category || "strategic",
        recommended_action: `${a.title}: ${a.action}`,
        decision_status: "pending",
        execution_status: "not_started",
        raw_confidence: a.raw_confidence,
        capped_confidence: a.capped_confidence,
        confidence_at_decision: a.capped_confidence ?? a.confidence,
        confidence_cap_reason: a.confidence_cap_reason,
        predicted_net_impact: parseImpactEstimate(a.expected_impact),
        notes: a.rationale,
        decision_origin: "ai_generated",
        source_insight_summary: a.title,
        recommendation_logic_type: logicType,
        explanation_metadata: explanationMetadata,
      };
    });

    const { data: createdDecisions, error: insertError } = await serviceSupabase
      .from("decision_ledger")
      .insert(decisionRows)
      .select("id");

    if (insertError) throw new Error(`Failed to create decisions: ${insertError.message}`);

    // Send email notification to org admins/owners
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@quantivis.com";
    let emailsSent = 0;

    if (resendKey && createdDecisions && createdDecisions.length > 0) {
      const { data: members } = await serviceSupabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", organization_id)
        .in("role", ["owner", "admin", "executive"]);

      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        const { data: profiles } = await serviceSupabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const { data: orgData } = await serviceSupabase
          .from("organizations")
          .select("name")
          .eq("id", organization_id)
          .single();

        const decisionCount = createdDecisions.length;
        const criticalCount = newAdvisories.filter(a => a.priority === "critical").length;

        const summaryItems = newAdvisories.slice(0, 5).map(a =>
          `<li style="margin-bottom: 8px; color: #e2e8f0;">
            <strong style="color: ${a.priority === 'critical' ? '#ef4444' : a.priority === 'high' ? '#f59e0b' : '#94a3b8'};">
              [${a.priority.toUpperCase()}]
            </strong> ${a.title}
          </li>`
        ).join("");

        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #0f172a; color: #e2e8f0;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #38bdf8; font-size: 20px; margin: 0;">Quantivis</h1>
            </div>
            <div style="background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155;">
              <h2 style="color: #f8fafc; font-size: 18px; margin: 0 0 8px;">
                ${decisionCount} New Decision${decisionCount > 1 ? 's' : ''} Need${decisionCount === 1 ? 's' : ''} Your Review
              </h2>
              <p style="color: #94a3b8; font-size: 14px; margin: 0 0 20px;">
                ${orgData?.name || 'Your organization'} · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              ${criticalCount > 0 ? `<div style="background: #7f1d1d; border-radius: 8px; padding: 12px; margin-bottom: 16px; border: 1px solid #991b1b;">
                <p style="color: #fca5a5; font-size: 13px; margin: 0; font-weight: 600;">⚠️ ${criticalCount} critical decision${criticalCount > 1 ? 's' : ''} requiring immediate attention</p>
              </div>` : ''}
              <ul style="padding-left: 20px; margin: 0 0 24px;">${summaryItems}</ul>
              ${newAdvisories.length > 5 ? `<p style="color: #64748b; font-size: 13px;">...and ${newAdvisories.length - 5} more</p>` : ''}
              <a href="https://quantisights-pro.lovable.app/decisions" style="display: inline-block; background: #0ea5e9; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Review Decisions →
              </a>
            </div>
            <p style="color: #475569; font-size: 12px; text-align: center; margin-top: 24px;">
              You're receiving this because you're an admin of ${orgData?.name || 'this organization'} on Quantivis.
            </p>
          </div>
        `;

        for (const member of members) {
          try {
            const { data: authUser } = await serviceSupabase.auth.admin.getUserById(member.user_id);
            if (authUser?.user?.email) {
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: fromEmail,
                  to: [authUser.user.email],
                  subject: `${criticalCount > 0 ? '🔴 ' : ''}${decisionCount} decision${decisionCount > 1 ? 's' : ''} need${decisionCount === 1 ? 's' : ''} your review — ${orgData?.name || 'Quantivis'}`,
                  html: emailHtml,
                }),
              });
              emailsSent++;
            }
          } catch (emailErr) {
            console.error(`Failed to send email to member ${member.user_id}:`, emailErr);
          }
        }
      }
    }

    // Audit log
    await serviceSupabase.from("audit_log").insert({
      organization_id,
      actor_id: user.id,
      actor_type: "system",
      action_type: "auto_decisions_created",
      resource_type: "decision_ledger",
      payload: {
        count: createdDecisions?.length ?? 0,
        emails_sent: emailsSent,
        source: "auto_create_decisions",
        has_explanations: true,
      },
    });

    return new Response(JSON.stringify({
      created: createdDecisions?.length ?? 0,
      emails_sent: emailsSent,
      decisions: createdDecisions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("auto-create-decisions error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

/* ---- Helper functions for explanation generation ---- */

function parseImpactEstimate(impact: string | null): number | null {
  if (!impact) return null;
  const match = impact.match(/([+-]?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

function detectLogicType(advisoryType: string | null, title: string, action: string): string {
  const combined = `${title} ${action} ${advisoryType ?? ""}`.toLowerCase();
  if (combined.includes("trend") || combined.includes("declining") || combined.includes("increasing")) return "trend_detection";
  if (combined.includes("threshold") || combined.includes("breach") || combined.includes("exceeded")) return "threshold_breach";
  if (combined.includes("forecast") || combined.includes("deviation") || combined.includes("projected")) return "forecast_deviation";
  if (combined.includes("anomal") || combined.includes("unusual") || combined.includes("spike")) return "anomaly_detection";
  if (combined.includes("correlat") || combined.includes("relationship")) return "correlation_analysis";
  return "statistical_inference";
}

function describeLogic(logicType: string): string {
  const descriptions: Record<string, string> = {
    trend_detection: "Sustained directional change detected across ≥3 periods",
    threshold_breach: "Metric crossed predefined performance boundary",
    forecast_deviation: "Actual values diverged >2σ from forecast model",
    anomaly_detection: "Value outside historical ±2σ range",
    correlation_analysis: "Statistically significant inter-metric relationship (p<0.05)",
    statistical_inference: "Pattern detected via statistical significance test",
  };
  return descriptions[logicType] ?? "Rule-based pattern detection";
}

function describeConfidence(score: number | null): string {
  if (score == null) return "No score available";
  if (score >= 85) return `${score}% — Strong signal: ≥30 data points, low variance, consistent trend`;
  if (score >= 70) return `${score}% — Moderate signal: sufficient data, some variance`;
  if (score >= 50) return `${score}% — Weak signal: <30 data points or high variance`;
  return `${score}% — Insufficient data for reliable inference`;
}

function extractKeyMetrics(kpiAffected: unknown): string[] {
  if (!kpiAffected) return [];
  if (Array.isArray(kpiAffected)) return kpiAffected.map(String).slice(0, 5);
  if (typeof kpiAffected === "object") return Object.keys(kpiAffected as Record<string, unknown>).slice(0, 5);
  return [String(kpiAffected)];
}

function extractPrimaryMetric(kpiAffected: unknown): string | null {
  const metrics = extractKeyMetrics(kpiAffected);
  return metrics.length > 0 ? metrics[0] : null;
}

function extractChangeValue(title: string, action: string): string | null {
  const match = (title + " " + action).match(/(\d+(?:\.\d+)?%)/);
  return match ? match[1] : null;
}

function detectDirection(title: string, action: string): string | null {
  const combined = `${title} ${action}`.toLowerCase();
  if (combined.includes("drop") || combined.includes("declin") || combined.includes("decrease") || combined.includes("fell")) return "decrease";
  if (combined.includes("increase") || combined.includes("grew") || combined.includes("rise") || combined.includes("spike")) return "increase";
  return null;
}

function buildWhyItMatters(a: { priority: string; expected_impact: string | null; category: string }): string {
  const parts: string[] = [];
  if (a.priority === "critical") parts.push("Critical priority");
  else if (a.priority === "high") parts.push("High priority");
  else parts.push("Medium priority");
  parts.push(`Category: ${a.category}`);
  if (a.expected_impact) parts.push(`Impact: ${a.expected_impact}`);
  return parts.join(" · ");
}

function buildAssumptions(a: { data_quality_index: number | null; data_snapshot_date: string | null }): string[] {
  const assumptions: string[] = [];
  if (a.data_snapshot_date) {
    assumptions.push(`Data snapshot: ${a.data_snapshot_date}`);
  }
  if (a.data_quality_index != null) {
    assumptions.push(`Data quality index: ${(a.data_quality_index * 100).toFixed(0)}%`);
  }
  assumptions.push("Assumes stable business conditions over evaluation window");
  return assumptions;
}

function buildLimitations(a: { data_quality_index: number | null; variance_score: number | null }): string[] {
  const limitations: string[] = [];
  if (a.data_quality_index != null && a.data_quality_index < 0.7) {
    limitations.push(`Data quality ${(a.data_quality_index * 100).toFixed(0)}% — below 70% threshold`);
  }
  if (a.variance_score != null && a.variance_score > 0.5) {
    limitations.push(`Variance score ${(a.variance_score * 100).toFixed(0)}% — high uncertainty`);
  }
  limitations.push("Probabilistic estimate, not financial advice");
  return limitations;
}
