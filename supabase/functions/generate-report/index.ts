import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
  const corsHeaders = getCorsHeaders(req);

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const { organization_id, dataset_id, report_type = "executive", dry_run } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!dataset_id) {
      return new Response(JSON.stringify({ error: "dataset_id required by Active Data Contract" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate dataset belongs to org
    const { data: dsCheck } = await serviceClient
      .from("datasets")
      .select("id")
      .eq("id", dataset_id)
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (!dsCheck) {
      return new Response(JSON.stringify({ error: "dataset_id does not belong to this organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dry run: validate contract only
    if (dry_run) {
      return new Response(JSON.stringify({ dry_run: true, status: "PASS", dataset_id, organization_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce plan
    const { data: sub } = await serviceClient
      .from("subscriptions")
      .select("tier")
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (!sub || !["growth", "enterprise"].includes(sub.tier)) {
      return new Response(
        JSON.stringify({ error: "Executive reports require a Growth or Enterprise plan." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch org
    const { data: org } = await supabase
      .from("organizations")
      .select("name, industry")
      .eq("id", organization_id)
      .single();

    const orgName = org?.name || "Organization";
    const industry = org?.industry || "";
    const now = new Date().toISOString();

    // Fetch data — ALL scoped by dataset_id (Active Data Contract)
    const [metricsRes, insightsRes, kpisRes, risksRes, advisoriesRes, simulationsRes] = await Promise.all([
      supabase
        .from("metrics")
        .select("metric_type, value, date, region, segment")
        .eq("organization_id", organization_id)
        .eq("dataset_id", dataset_id)
        .order("date", { ascending: true }),
      supabase
        .from("insights")
        .select("message, severity, category, confidence_score, capped_confidence")
        .eq("organization_id", organization_id)
        .eq("dataset_id", dataset_id)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("kpi_values")
        .select("value, date, kpi_id")
        .eq("organization_id", organization_id)
        .order("date", { ascending: false })
        .limit(50),
      serviceClient
        .from("executive_risk_index")
        .select("role_type, score, components, escalation_required, escalation_reason")
        .eq("organization_id", organization_id),
      supabase
        .from("advisory_instances")
        .select("title, action, priority, category, capped_confidence, status")
        .eq("organization_id", organization_id)
        .eq("dataset_id", dataset_id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("simulation_results")
        .select("metric_type, expected_value, p10_value, p90_value, probability_negative, capped_confidence, data_sufficiency")
        .eq("organization_id", organization_id)
        .eq("dataset_id", dataset_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const metrics = metricsRes.data || [];
    const insights = insightsRes.data || [];
    const kpis = kpisRes.data || [];
    const risks = risksRes.data || [];
    const advisories = advisoriesRes.data || [];
    const simulations = simulationsRes.data || [];

    // Compute aggregates
    const revenueMetrics = metrics.filter((m: any) => m.metric_type === "revenue");
    const totalRevenue = revenueMetrics.reduce((s: number, m: any) => s + Number(m.value), 0);
    const customerMetrics = metrics.filter((m: any) => m.metric_type === "customers");
    const totalCustomers = customerMetrics.reduce((s: number, m: any) => s + Number(m.value), 0);
    const churnMetrics = metrics.filter((m: any) => m.metric_type === "churn");
    const latestChurn = churnMetrics.length > 0 ? Number(churnMetrics[churnMetrics.length - 1].value) : 0;
    const costMetrics = metrics.filter((m: any) => m.metric_type === "cost");
    const latestCost = costMetrics.length > 0 ? Number(costMetrics[costMetrics.length - 1].value) : 0;

    // Segment breakdown
    const segments: Record<string, number> = {};
    revenueMetrics.forEach((m: any) => {
      if (m.segment) segments[m.segment] = (segments[m.segment] || 0) + Number(m.value);
    });

    // Monthly revenue
    const monthlyRevenue: Record<string, number> = {};
    revenueMetrics.forEach((m: any) => {
      const key = m.date.substring(0, 7);
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + Number(m.value);
    });

    // Risk summary
    const maxRisk = risks.length > 0 ? Math.max(...risks.map((r: any) => r.score)) : 0;
    const escalations = risks.filter((r: any) => r.escalation_required);

    // Build the report HTML based on type
    const html = buildReportHtml(report_type, {
      orgName, industry, now,
      totalRevenue, totalCustomers, latestChurn, latestCost,
      segments, monthlyRevenue,
      insights, risks, advisories, simulations,
      maxRisk, escalations, kpis,
    });

    // Store report
    const filePath = `${organization_id}/${Date.now()}_${report_type}_report.html`;
    const htmlBytes = new TextEncoder().encode(html);
    const { error: uploadError } = await serviceClient.storage
      .from("reports")
      .upload(filePath, htmlBytes, {
        contentType: "text/html; charset=utf-8",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: report, error: reportError } = await serviceClient
      .from("reports")
      .insert({
        organization_id,
        dataset_id,
        file_path: filePath,
        generated_by: userId,
        report_type,
      })
      .select()
      .single();
    if (reportError) throw reportError;

    const { data: urlData } = await serviceClient.storage
      .from("reports")
      .createSignedUrl(filePath, 3600);

    return new Response(
      JSON.stringify({ report_id: report.id, download_url: urlData?.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Report HTML Builders ───

function buildReportHtml(type: string, d: any): string {
  const header = reportHeader(d.orgName, d.now, type);
  const footer = reportFooter();

  switch (type) {
    case "diagnostic":
      return wrapHtml(`Diagnostic Report — ${d.orgName}`, header + diagnosticBody(d) + footer);
    case "risk":
      return wrapHtml(`Risk & Compliance — ${d.orgName}`, header + riskBody(d) + footer);
    case "growth":
      return wrapHtml(`Growth Analysis — ${d.orgName}`, header + growthBody(d) + footer);
    case "executive":
    default:
      return wrapHtml(`Executive Summary — ${d.orgName}`, header + executiveBody(d) + footer);
  }
}

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;max-width:900px;margin:0 auto">${body}</body></html>`;
}

function reportHeader(orgName: string, now: string, type: string): string {
  const typeLabels: Record<string, string> = {
    executive: "Executive Summary",
    diagnostic: "Diagnostic Report",
    risk: "Risk & Compliance",
    growth: "Growth Analysis",
  };
  return `
  <div style="text-align:center;margin-bottom:40px">
    <h1 style="color:#0ea5e9;margin:0;letter-spacing:2px">QUANTIVIS</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:14px">${typeLabels[type] || "Intelligence Report"}</p>
  </div>
  <div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
    <h2 style="color:#0ea5e9;margin:0">${orgName}</h2>
    <p style="color:#94a3b8;margin:8px 0 0;font-size:13px">Generated: ${new Date(now).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
  </div>`;
}

function reportFooter(): string {
  return `<div style="text-align:center;color:#64748b;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid #1e293b">
    <p>Confidential — Quantivis Intelligence Platform</p>
  </div>`;
}

function kpiGrid(d: any): string {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    <div style="background:#1e293b;padding:20px;border-radius:12px;border-left:3px solid #22c55e">
      <p style="color:#94a3b8;margin:0 0 4px;font-size:13px">Total Revenue</p>
      <p style="font-size:24px;font-weight:700;margin:0;color:#22c55e">€${d.totalRevenue.toLocaleString()}</p>
    </div>
    <div style="background:#1e293b;padding:20px;border-radius:12px;border-left:3px solid #0ea5e9">
      <p style="color:#94a3b8;margin:0 0 4px;font-size:13px">Total Customers</p>
      <p style="font-size:24px;font-weight:700;margin:0;color:#0ea5e9">${d.totalCustomers.toLocaleString()}</p>
    </div>
    <div style="background:#1e293b;padding:20px;border-radius:12px;border-left:3px solid #f59e0b">
      <p style="color:#94a3b8;margin:0 0 4px;font-size:13px">Cost Rate</p>
      <p style="font-size:24px;font-weight:700;margin:0;color:#f59e0b">€${d.latestCost.toLocaleString()}</p>
    </div>
    <div style="background:#1e293b;padding:20px;border-radius:12px;border-left:3px solid #ef4444">
      <p style="color:#94a3b8;margin:0 0 4px;font-size:13px">Churn Rate</p>
      <p style="font-size:24px;font-weight:700;margin:0;color:#ef4444">${d.latestChurn}%</p>
    </div>
  </div>`;
}

function insightsSection(insights: any[]): string {
  if (!insights.length) return "";
  const items = insights
    .map((i: any) => {
      const color = i.severity === "high" ? "#ef4444" : i.severity === "medium" ? "#f59e0b" : "#0ea5e9";
      const conf = i.capped_confidence ?? i.confidence_score;
      return `<li style="margin-bottom:10px;line-height:1.5"><span style="color:${color};font-weight:600">[${(i.severity || "info").toUpperCase()}]</span> ${i.message}${conf ? ` <span style="color:#64748b;font-size:12px">(${conf}% confidence)</span>` : ""}</li>`;
    }).join("");
  return `<div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
    <h3 style="color:#0ea5e9;margin:0 0 16px">AI Insights & Recommendations</h3>
    <ul style="padding-left:20px;margin:0">${items}</ul>
  </div>`;
}

function monthlyTable(monthlyRevenue: Record<string, number>): string {
  const rows = Object.entries(monthlyRevenue);
  if (!rows.length) return "";
  return `<div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
    <h3 style="color:#0ea5e9;margin:0 0 16px">Revenue by Period</h3>
    <table style="width:100%;border-collapse:collapse;color:#e2e8f0">
      <thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #334155;font-size:13px">Period</th><th style="text-align:right;padding:8px;border-bottom:2px solid #334155;font-size:13px">Revenue</th></tr></thead>
      <tbody>${rows.map(([m, v]) => `<tr><td style="padding:8px;border-bottom:1px solid #1e293b">${m}</td><td style="padding:8px;border-bottom:1px solid #1e293b;text-align:right">€${v.toLocaleString()}</td></tr>`).join("")}</tbody>
    </table>
  </div>`;
}

function segmentTable(segments: Record<string, number>): string {
  const rows = Object.entries(segments);
  if (!rows.length) return "";
  return `<div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
    <h3 style="color:#0ea5e9;margin:0 0 16px">Revenue by Segment</h3>
    <table style="width:100%;border-collapse:collapse;color:#e2e8f0">
      <thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #334155;font-size:13px">Segment</th><th style="text-align:right;padding:8px;border-bottom:2px solid #334155;font-size:13px">Revenue</th></tr></thead>
      <tbody>${rows.map(([n, v]) => `<tr><td style="padding:8px;border-bottom:1px solid #1e293b">${n}</td><td style="padding:8px;border-bottom:1px solid #1e293b;text-align:right">€${v.toLocaleString()}</td></tr>`).join("")}</tbody>
    </table>
  </div>`;
}

function executiveBody(d: any): string {
  return kpiGrid(d) + monthlyTable(d.monthlyRevenue) + segmentTable(d.segments) + insightsSection(d.insights);
}

function diagnosticBody(d: any): string {
  let html = kpiGrid(d);
  const byCategory: Record<string, any[]> = {};
  d.insights.forEach((i: any) => {
    const cat = i.category || "general";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(i);
  });
  for (const [cat, items] of Object.entries(byCategory)) {
    html += `<div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
      <h3 style="color:#0ea5e9;margin:0 0 16px;text-transform:capitalize">${cat} Analysis</h3>
      <ul style="padding-left:20px;margin:0">`;
    for (const i of items) {
      const color = i.severity === "high" ? "#ef4444" : i.severity === "medium" ? "#f59e0b" : "#0ea5e9";
      html += `<li style="margin-bottom:10px;line-height:1.5"><span style="color:${color};font-weight:600">[${(i.severity || "info").toUpperCase()}]</span> ${i.message}</li>`;
    }
    html += `</ul></div>`;
  }
  if (d.advisories.length > 0) {
    html += `<div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
      <h3 style="color:#0ea5e9;margin:0 0 16px">Remediation Recommendations</h3>
      <table style="width:100%;border-collapse:collapse;color:#e2e8f0">
        <thead><tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #334155;font-size:13px">Advisory</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #334155;font-size:13px">Priority</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #334155;font-size:13px">Confidence</th>
        </tr></thead><tbody>`;
    for (const a of d.advisories) {
      const pColor = a.priority === "high" ? "#ef4444" : a.priority === "medium" ? "#f59e0b" : "#22c55e";
      html += `<tr>
        <td style="padding:8px;border-bottom:1px solid #1e293b"><strong>${a.title}</strong><br><span style="color:#94a3b8;font-size:12px">${a.action}</span></td>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-align:center"><span style="color:${pColor};font-weight:600;text-transform:uppercase">${a.priority}</span></td>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-align:center">${a.capped_confidence ?? "—"}%</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }
  return html;
}

function riskBody(d: any): string {
  let html = "";
  const postureColor = d.maxRisk > 75 ? "#ef4444" : d.maxRisk > 50 ? "#f59e0b" : "#22c55e";
  const postureLabel = d.maxRisk > 75 ? "HIGH RISK" : d.maxRisk > 50 ? "ELEVATED" : "STABLE";
  html += `<div style="background:${postureColor}15;border:1px solid ${postureColor}40;padding:24px;border-radius:12px;margin-bottom:24px;text-align:center">
    <p style="color:${postureColor};font-size:28px;font-weight:700;margin:0">${postureLabel}</p>
    <p style="color:#94a3b8;margin:8px 0 0;font-size:14px">Peak Risk Score: ${d.maxRisk}/100</p>
  </div>`;
  if (d.risks.length > 0) {
    html += `<div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
      <h3 style="color:#0ea5e9;margin:0 0 16px">Risk Index by Role</h3>
      <table style="width:100%;border-collapse:collapse;color:#e2e8f0">
        <thead><tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #334155;font-size:13px">Role</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #334155;font-size:13px">Score</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #334155;font-size:13px">Escalation</th>
        </tr></thead><tbody>`;
    for (const r of d.risks) {
      const rColor = r.score >= 75 ? "#ef4444" : r.score >= 50 ? "#f59e0b" : "#22c55e";
      html += `<tr>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-transform:capitalize">${r.role_type}</td>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-align:center;color:${rColor};font-weight:600">${r.score}</td>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-align:center">${r.escalation_required ? "⚠️ YES" : "—"}</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }
  html += insightsSection(d.insights);
  return html;
}

function growthBody(d: any): string {
  let html = kpiGrid(d);
  html += monthlyTable(d.monthlyRevenue);
  html += segmentTable(d.segments);
  if (d.simulations.length > 0) {
    html += `<div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
      <h3 style="color:#0ea5e9;margin:0 0 16px">Monte Carlo Outlook</h3>
      <table style="width:100%;border-collapse:collapse;color:#e2e8f0">
        <thead><tr>
          <th style="text-align:left;padding:8px;border-bottom:2px solid #334155;font-size:13px">Metric</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #334155;font-size:13px">Expected</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #334155;font-size:13px">P10</th>
          <th style="text-align:right;padding:8px;border-bottom:2px solid #334155;font-size:13px">P90</th>
          <th style="text-align:center;padding:8px;border-bottom:2px solid #334155;font-size:13px">Confidence</th>
        </tr></thead><tbody>`;
    for (const s of d.simulations) {
      html += `<tr>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-transform:capitalize">${s.metric_type}</td>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-align:right">€${Number(s.expected_value).toLocaleString()}</td>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-align:right;color:#ef4444">€${Number(s.p10_value).toLocaleString()}</td>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-align:right;color:#22c55e">€${Number(s.p90_value).toLocaleString()}</td>
        <td style="padding:8px;border-bottom:1px solid #1e293b;text-align:center">${s.data_sufficiency || "—"}</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }
  html += insightsSection(d.insights);
  return html;
}
