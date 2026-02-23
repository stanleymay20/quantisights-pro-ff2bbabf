import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO", cfo: "CFO", cmo: "CMO", coo: "COO",
};

interface AlertPayload {
  organization_id: string;
  role_type: string;
  risk_score: number;
  alerts: { title: string; severity: string }[];
  escalation_required: boolean;
  escalation_reason?: string;
  top_action?: string;
}

async function sendEmail(
  resendKey: string,
  to: string[],
  subject: string,
  html: string,
  serviceClient: any,
  orgId: string,
  roleType: string,
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Quantivis <alerts@quantivis.io>",
        to,
        subject,
        html,
      }),
    });

    const sent = res.ok;
    await serviceClient.from("notification_log").insert({
      organization_id: orgId,
      role_type: roleType,
      channel: "email",
      subject,
      recipients: to,
      status: sent ? "sent" : "failed",
      error_message: sent ? null : `HTTP ${res.status}`,
    });
    return sent;
  } catch (err) {
    await serviceClient.from("notification_log").insert({
      organization_id: orgId,
      role_type: roleType,
      channel: "email",
      subject,
      recipients: to,
      status: "failed",
      error_message: err.message,
    });
    return false;
  }
}

async function sendSlackWebhook(
  webhookUrl: string,
  payload: AlertPayload,
  serviceClient: any,
): Promise<boolean> {
  const emoji = payload.escalation_required ? "🔴" : payload.risk_score > 75 ? "🟠" : "🟡";
  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `${emoji} ${ROLE_LABELS[payload.role_type]} Alert — Risk: ${payload.risk_score}/100` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: payload.alerts.map((a) => `• *[${a.severity.toUpperCase()}]* ${a.title}`).join("\n") || "_No active alerts_",
      },
    },
  ];

  if (payload.escalation_required) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `⚠️ *Board Escalation Required*: ${payload.escalation_reason || "Multiple critical signals"}` },
    });
  }

  if (payload.top_action) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `💡 *Top Action*: ${payload.top_action}` },
    });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    const sent = res.ok;
    await serviceClient.from("notification_log").insert({
      organization_id: payload.organization_id,
      role_type: payload.role_type,
      channel: "slack",
      subject: `${ROLE_LABELS[payload.role_type]} Alert`,
      recipients: [webhookUrl.substring(0, 40) + "..."],
      status: sent ? "sent" : "failed",
      error_message: sent ? null : `HTTP ${res.status}`,
    });
    return sent;
  } catch (err) {
    await serviceClient.from("notification_log").insert({
      organization_id: payload.organization_id,
      role_type: payload.role_type,
      channel: "slack",
      subject: `${ROLE_LABELS[payload.role_type]} Alert`,
      recipients: [],
      status: "failed",
      error_message: err.message,
    });
    return false;
  }
}

function buildAlertEmailHtml(payload: AlertPayload, orgName: string): string {
  const riskColor = payload.risk_score > 75 ? "#ef4444" : payload.risk_score > 50 ? "#f59e0b" : "#22c55e";
  const alertRows = payload.alerts.map((a) => {
    const sevColor = a.severity === "critical" ? "#ef4444" : a.severity === "warning" ? "#f59e0b" : "#3b82f6";
    return `<tr><td style="padding:8px 12px;border-bottom:1px solid #1e293b;"><span style="color:${sevColor};font-weight:600;">${a.severity.toUpperCase()}</span></td><td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#e2e8f0;">${a.title}</td></tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
<div style="text-align:center;margin-bottom:24px;">
<h1 style="color:#e2e8f0;font-size:20px;margin:0;">Quantivis Executive Alert</h1>
<p style="color:#94a3b8;font-size:14px;margin:4px 0 0;">${orgName} · ${ROLE_LABELS[payload.role_type]} View</p>
</div>
<div style="background:#1e293b;border-radius:12px;padding:24px;margin-bottom:16px;text-align:center;">
<p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Strategic Risk Index</p>
<p style="color:${riskColor};font-size:48px;font-weight:700;margin:0;">${payload.risk_score}</p>
<p style="color:#94a3b8;font-size:14px;margin:4px 0 0;">/100</p>
</div>
${payload.escalation_required ? `<div style="background:#7f1d1d;border:1px solid #ef4444;border-radius:8px;padding:16px;margin-bottom:16px;text-align:center;">
<p style="color:#fca5a5;font-weight:600;margin:0;">⚠ Board Escalation Required</p>
<p style="color:#fca5a5;font-size:13px;margin:4px 0 0;">${payload.escalation_reason || "Multiple critical signals detected"}</p>
</div>` : ""}
${payload.alerts.length > 0 ? `<div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
<h3 style="color:#e2e8f0;font-size:14px;margin:0 0 12px;">Active Alerts</h3>
<table style="width:100%;border-collapse:collapse;">${alertRows}</table>
</div>` : ""}
${payload.top_action ? `<div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
<h3 style="color:#e2e8f0;font-size:14px;margin:0 0 8px;">💡 Recommended Action</h3>
<p style="color:#e2e8f0;font-size:14px;margin:0;">${payload.top_action}</p>
</div>` : ""}
<div style="text-align:center;margin-top:24px;">
<a href="https://quantivis.io/executive" style="display:inline-block;background:#6366f1;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Executive Command</a>
</div>
<p style="color:#475569;font-size:11px;text-align:center;margin-top:32px;">Quantivis Strategic Intelligence · Automated Alert</p>
</div></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    const payload: AlertPayload = await req.json();
    const { organization_id, role_type, risk_score, alerts, escalation_required } = payload;

    if (!organization_id || !role_type) {
      return new Response(JSON.stringify({ error: "organization_id and role_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch org name
    const { data: org } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();

    // Fetch notification preferences
    const { data: prefs } = await serviceClient
      .from("notification_preferences")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("role_type", role_type)
      .maybeSingle();

    const results: { email: boolean | null; slack: boolean | null; escalation: boolean | null } = {
      email: null,
      slack: null,
      escalation: null,
    };

    // Check if should notify based on threshold
    const threshold = prefs?.alert_threshold ?? 50;
    const shouldNotify = risk_score >= threshold || alerts.some((a) => a.severity === "critical");

    if (!shouldNotify) {
      return new Response(JSON.stringify({ sent: false, reason: "Below threshold" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Email notification
    if (prefs?.email_enabled && prefs.email_recipients?.length > 0 && RESEND_API_KEY) {
      const subject = escalation_required
        ? `🔴 ${ROLE_LABELS[role_type]} ESCALATION: Risk Critical (${risk_score}/100) — ${org?.name}`
        : `⚠ ${ROLE_LABELS[role_type]} Alert: Risk ${risk_score > 75 ? "Elevated" : "Warning"} (${risk_score}/100) — ${org?.name}`;

      const html = buildAlertEmailHtml(payload, org?.name || "Organization");
      results.email = await sendEmail(RESEND_API_KEY, prefs.email_recipients, subject, html, serviceClient, organization_id, role_type);
    }

    // Slack notification
    if (prefs?.slack_enabled && prefs.slack_webhook_url) {
      results.slack = await sendSlackWebhook(prefs.slack_webhook_url, payload, serviceClient);
    }

    // Escalation notification (secondary email to all org owners)
    if (escalation_required && RESEND_API_KEY) {
      const { data: owners } = await serviceClient
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organization_id)
        .eq("role", "owner");

      if (owners && owners.length > 0) {
        // Get owner emails from auth
        const ownerEmails: string[] = [];
        for (const owner of owners) {
          const { data: { user } } = await serviceClient.auth.admin.getUserById(owner.user_id);
          if (user?.email) ownerEmails.push(user.email);
        }

        if (ownerEmails.length > 0) {
          const escalationSubject = `🔴 BOARD ESCALATION — ${org?.name}: ${ROLE_LABELS[role_type]} Risk Critical (${risk_score}/100)`;
          results.escalation = await sendEmail(RESEND_API_KEY, ownerEmails, escalationSubject, buildAlertEmailHtml({ ...payload, escalation_required: true }, org?.name || "Organization"), serviceClient, organization_id, role_type);

          await serviceClient.from("notification_log").insert({
            organization_id,
            role_type,
            channel: "escalation",
            subject: escalationSubject,
            recipients: ownerEmails,
            status: results.escalation ? "sent" : "failed",
          });
        }
      }
    }

    // Mark alerts as notified
    const alertChannel = [results.email && "email", results.slack && "slack"].filter(Boolean).join(",");
    if (alertChannel) {
      await serviceClient
        .from("executive_alerts")
        .update({ notified_at: new Date().toISOString(), notification_channel: alertChannel })
        .eq("organization_id", organization_id)
        .eq("role_type", role_type)
        .eq("status", "active")
        .is("notified_at", null);
    }

    // Update last_notified_at on risk index
    await serviceClient
      .from("executive_risk_index")
      .update({ last_notified_at: new Date().toISOString() })
      .eq("organization_id", organization_id)
      .eq("role_type", role_type);

    console.log(JSON.stringify({
      event: "executive_alert_sent",
      organization_id,
      role_type,
      risk_score,
      ...results,
    }));

    return new Response(JSON.stringify({ sent: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-executive-alert error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
