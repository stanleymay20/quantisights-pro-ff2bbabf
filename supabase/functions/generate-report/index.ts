import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { organization_id } = await req.json();

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }), { status: 400, headers: corsHeaders });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("user_id", userId)
      .eq("organization_id", organization_id)
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member" }), { status: 403, headers: corsHeaders });
    }

    // Enforce plan: Reports require Growth or Enterprise
    const serviceSupabaseForTier = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: sub } = await serviceSupabaseForTier
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

    // Fetch org info
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();

    // Fetch metrics
    const { data: metrics } = await supabase
      .from("metrics")
      .select("metric_type, value, date, region, segment")
      .eq("organization_id", organization_id)
      .order("date", { ascending: true });

    // Fetch insights
    const { data: insights } = await supabase
      .from("insights")
      .select("message, severity, category")
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const orgName = org?.name || "Organization";
    const revenueMetrics = (metrics || []).filter((m) => m.metric_type === "revenue");
    const totalRevenue = revenueMetrics.reduce((s, m) => s + Number(m.value), 0);
    const customerMetrics = (metrics || []).filter((m) => m.metric_type === "customers");
    const totalCustomers = customerMetrics.reduce((s, m) => s + Number(m.value), 0);
    const churnMetrics = (metrics || []).filter((m) => m.metric_type === "churn");
    const latestChurn = churnMetrics.length > 0 ? Number(churnMetrics[churnMetrics.length - 1].value) : 0;
    const costMetrics = (metrics || []).filter((m) => m.metric_type === "cost");
    const latestCost = costMetrics.length > 0 ? Number(costMetrics[costMetrics.length - 1].value) : 0;

    // Segment breakdown
    const segments: Record<string, number> = {};
    revenueMetrics.forEach((m) => {
      if (m.segment) segments[m.segment] = (segments[m.segment] || 0) + Number(m.value);
    });

    // Revenue by month
    const monthlyRevenue: Record<string, number> = {};
    revenueMetrics.forEach((m) => {
      const key = m.date.substring(0, 7);
      monthlyRevenue[key] = (monthlyRevenue[key] || 0) + Number(m.value);
    });

    const now = new Date().toISOString();

    // Build HTML report
    const segmentRows = Object.entries(segments)
      .map(([name, value]) => `<tr><td style="padding:8px;border-bottom:1px solid #1e293b">${name}</td><td style="padding:8px;border-bottom:1px solid #1e293b;text-align:right">€${value.toLocaleString()}</td></tr>`)
      .join("");

    const monthlyRows = Object.entries(monthlyRevenue)
      .map(([month, value]) => `<tr><td style="padding:8px;border-bottom:1px solid #1e293b">${month}</td><td style="padding:8px;border-bottom:1px solid #1e293b;text-align:right">€${value.toLocaleString()}</td></tr>`)
      .join("");

    const insightsList = (insights || [])
      .map((i) => {
        const color = i.severity === "high" ? "#ef4444" : i.severity === "medium" ? "#f59e0b" : "#0ea5e9";
        return `<li style="margin-bottom:8px"><span style="color:${color};font-weight:600">[${i.severity.toUpperCase()}]</span> ${i.message}</li>`;
      })
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Executive Report - ${orgName}</title></head>
<body style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:40px;max-width:800px;margin:0 auto">
  <div style="text-align:center;margin-bottom:40px">
    <h1 style="color:#0ea5e9;margin:0">QUANTIVIS GLOBAL</h1>
    <p style="color:#94a3b8;margin-top:4px">Executive Intelligence Report</p>
  </div>
  
  <div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
    <h2 style="color:#0ea5e9;margin-top:0">${orgName}</h2>
    <p style="color:#94a3b8;margin:0">Generated: ${new Date(now).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}</p>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    <div style="background:#1e293b;padding:20px;border-radius:12px;border-left:3px solid #22c55e">
      <p style="color:#94a3b8;margin:0 0 4px">Total Revenue</p>
      <p style="font-size:24px;font-weight:700;margin:0;color:#22c55e">€${totalRevenue.toLocaleString()}</p>
    </div>
    <div style="background:#1e293b;padding:20px;border-radius:12px;border-left:3px solid #0ea5e9">
      <p style="color:#94a3b8;margin:0 0 4px">Total Customers</p>
      <p style="font-size:24px;font-weight:700;margin:0;color:#0ea5e9">${totalCustomers.toLocaleString()}</p>
    </div>
    <div style="background:#1e293b;padding:20px;border-radius:12px;border-left:3px solid #f59e0b">
      <p style="color:#94a3b8;margin:0 0 4px">Cost Rate</p>
      <p style="font-size:24px;font-weight:700;margin:0;color:#f59e0b">€${latestCost.toLocaleString()}</p>
    </div>
    <div style="background:#1e293b;padding:20px;border-radius:12px;border-left:3px solid #ef4444">
      <p style="color:#94a3b8;margin:0 0 4px">Churn Rate</p>
      <p style="font-size:24px;font-weight:700;margin:0;color:#ef4444">${latestChurn}%</p>
    </div>
  </div>

  ${monthlyRows ? `
  <div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
    <h3 style="color:#0ea5e9;margin-top:0">Revenue by Period</h3>
    <table style="width:100%;border-collapse:collapse;color:#e2e8f0">
      <thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #334155">Period</th><th style="text-align:right;padding:8px;border-bottom:2px solid #334155">Revenue</th></tr></thead>
      <tbody>${monthlyRows}</tbody>
    </table>
  </div>` : ""}

  ${segmentRows ? `
  <div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
    <h3 style="color:#0ea5e9;margin-top:0">Revenue by Segment</h3>
    <table style="width:100%;border-collapse:collapse;color:#e2e8f0">
      <thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #334155">Segment</th><th style="text-align:right;padding:8px;border-bottom:2px solid #334155">Revenue</th></tr></thead>
      <tbody>${segmentRows}</tbody>
    </table>
  </div>` : ""}

  ${insightsList ? `
  <div style="background:#1e293b;padding:24px;border-radius:12px;margin-bottom:24px">
    <h3 style="color:#0ea5e9;margin-top:0">AI Insights & Recommendations</h3>
    <ul style="padding-left:20px;margin:0">${insightsList}</ul>
  </div>` : ""}

  <div style="text-align:center;color:#64748b;font-size:12px;margin-top:40px">
    <p>Quantivis Global Intelligence Platform — Confidential</p>
  </div>
</body>
</html>`;

    // Store HTML report in storage
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const filePath = `${organization_id}/${Date.now()}_report.html`;
    const { error: uploadError } = await serviceSupabase.storage
      .from("reports")
      .upload(filePath, new Blob([html], { type: "text/html" }), { contentType: "text/html" });

    if (uploadError) throw uploadError;

    // Create report record
    const { data: report, error: reportError } = await serviceSupabase
      .from("reports")
      .insert({
        organization_id,
        file_path: filePath,
        generated_by: userId,
        report_type: "executive",
      })
      .select()
      .single();

    if (reportError) throw reportError;

    // Get download URL
    const { data: urlData } = await serviceSupabase.storage
      .from("reports")
      .createSignedUrl(filePath, 3600);

    return new Response(
      JSON.stringify({ report_id: report.id, download_url: urlData?.signedUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
