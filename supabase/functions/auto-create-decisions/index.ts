import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/**
 * Auto-Create Decisions from Advisory Instances
 * 
 * Takes open advisory instances and creates decision_ledger entries
 * for any that don't already have a linked decision. Then optionally
 * notifies team members via email.
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
      .select("id, title, action, category, priority, confidence, capped_confidence, raw_confidence, confidence_cap_reason, expected_impact, rationale, kpi_affected, dataset_id")
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

    // Create decision ledger entries
    const decisionRows = newAdvisories.map(a => ({
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
    }));

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
      // Get org members with admin/owner/executive roles
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

        // Get emails from auth (via profiles user_id lookup)
        const { data: orgData } = await serviceSupabase
          .from("organizations")
          .select("name")
          .eq("id", organization_id)
          .single();

        // Build email content
        const decisionCount = createdDecisions.length;
        const criticalCount = newAdvisories.filter(a => a.priority === "critical").length;
        const highCount = newAdvisories.filter(a => a.priority === "high").length;

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

        // Send to each admin/owner (get emails from auth.users via service role)
        for (const member of members) {
          try {
            const { data: authUser } = await serviceSupabase.auth.admin.getUserById(member.user_id);
            if (authUser?.user?.email) {
              const name = profiles?.find(p => p.user_id === member.user_id)?.full_name || '';
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
      },
    });

    return new Response(JSON.stringify({
      created: createdDecisions?.length ?? 0,
      emails_sent: emailsSent,
      decisions: createdDecisions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("auto-create-decisions error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Parse impact strings like "+5-10% revenue" into a numeric estimate */
function parseImpactEstimate(impact: string | null): number | null {
  if (!impact) return null;
  const match = impact.match(/([+-]?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}
