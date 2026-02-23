import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  cfo: "CFO",
  cmo: "CMO",
  coo: "COO",
};

// Future: weekly digest cron job integration
// This function will be extended to support scheduled weekly digests
// delivered to all Growth/Enterprise orgs on Monday 6:00 AM local time.

interface AlertPayload {
  organization_id: string;
  role_type: string;
  risk_score: number;
  alerts: { title: string; severity: string }[];
  escalation_required: boolean;
  escalation_reason?: string;
  top_action?: string;
}

/* ──────────────────── RATE LIMIT CHECK ──────────────────── */

async function isRateLimited(
  serviceClient: any,
  orgId: string,
  roleType: string,
): Promise<boolean> {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data } = await serviceClient
    .from("notification_log")
    .select("id")
    .eq("organization_id", orgId)
    .eq("role_type", roleType)
    .neq("status", "skipped_rate_limit")
    .gte("created_at", fifteenMinAgo)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/* ──────────────────── SUBJECT LINE ──────────────────── */

function buildSubjectLine(
  payload: AlertPayload,
  orgName: string,
): string {
  const role = ROLE_LABELS[payload.role_type] || payload.role_type.toUpperCase();
  if (payload.escalation_required) {
    return `🔴 BOARD ESCALATION — ${orgName}: ${role} Risk ${payload.risk_score}/100`;
  }
  const hasCritical = payload.alerts.some((a) => a.severity === "critical");
  if (hasCritical) {
    return `⚠ CRITICAL — ${role} Risk ${payload.risk_score}/100`;
  }
  return `Executive Alert — ${role} Risk ${payload.risk_score}/100`;
}

/* ──────────────────── EMAIL SENDER ──────────────────── */

async function sendEmail(
  resendKey: string,
  fromAddress: string,
  to: string[],
  subject: string,
  html: string,
  serviceClient: any,
  orgId: string,
  roleType: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress, to, subject, html }),
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
      metadata,
    });
    return sent;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await serviceClient.from("notification_log").insert({
      organization_id: orgId,
      role_type: roleType,
      channel: "email",
      subject,
      recipients: to,
      status: "failed",
      error_message: message,
      metadata,
    });
    return false;
  }
}

/* ──────────────────── SLACK WEBHOOK ──────────────────── */

async function sendSlackWebhook(
  webhookUrl: string,
  payload: AlertPayload,
  serviceClient: any,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const emoji =
    payload.escalation_required
      ? "🔴"
      : payload.risk_score > 75
        ? "🟠"
        : "🟡";

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${ROLE_LABELS[payload.role_type]} Alert — Risk: ${payload.risk_score}/100`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          payload.alerts
            .map((a) => `• *[${a.severity.toUpperCase()}]* ${a.title}`)
            .join("\n") || "_No active alerts_",
      },
    },
  ];

  if (payload.escalation_required) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *Board Escalation Required*: ${payload.escalation_reason || "Multiple critical signals"}`,
      },
    });
  }

  if (payload.top_action) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `💡 *Top Action*: ${payload.top_action}`,
      },
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
      metadata,
    });
    return sent;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await serviceClient.from("notification_log").insert({
      organization_id: payload.organization_id,
      role_type: payload.role_type,
      channel: "slack",
      subject: `${ROLE_LABELS[payload.role_type]} Alert`,
      recipients: [],
      status: "failed",
      error_message: message,
      metadata,
    });
    return false;
  }
}

/* ──────────────────── HTML EMAIL TEMPLATE ──────────────────── */

function buildAlertEmailHtml(payload: AlertPayload, orgName: string): string {
  const riskColor =
    payload.risk_score > 75
      ? "#ef4444"
      : payload.risk_score > 50
        ? "#f59e0b"
        : "#22c55e";

  const riskLabel =
    payload.risk_score > 75
      ? "CRITICAL"
      : payload.risk_score > 50
        ? "ELEVATED"
        : "STABLE";

  const alertRows = payload.alerts
    .map((a) => {
      const sevColor =
        a.severity === "critical"
          ? "#ef4444"
          : a.severity === "warning"
            ? "#f59e0b"
            : "#3b82f6";
      return `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;letter-spacing:0.5px;color:white;background:${sevColor};">${a.severity.toUpperCase()}</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px;">${a.title}</td>
      </tr>`;
    })
    .join("");

  const timestamp = new Date().toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const roleLabel = ROLE_LABELS[payload.role_type] || payload.role_type.toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">

<!-- Dark Header -->
<div style="background:#111827;padding:24px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">QUANTIVIS</span>
      <span style="color:#6b7280;font-size:12px;margin-left:8px;letter-spacing:1px;">EXECUTIVE INTELLIGENCE</span></td>
    <td style="text-align:right;"><span style="color:#9ca3af;font-size:12px;">${roleLabel} View</span></td>
  </tr></table>
</div>

<div style="max-width:600px;margin:0 auto;padding:32px 24px;">

  <!-- Risk Score Dial -->
  <div style="background:#ffffff;border-radius:12px;padding:32px;margin-bottom:20px;text-align:center;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <p style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 12px;">Strategic Risk Index</p>
    <div style="display:inline-block;width:100px;height:100px;border-radius:50%;border:6px solid ${riskColor};line-height:88px;text-align:center;">
      <span style="color:${riskColor};font-size:36px;font-weight:800;">${payload.risk_score}</span>
    </div>
    <p style="color:${riskColor};font-size:13px;font-weight:600;margin:12px 0 0;letter-spacing:0.5px;">${riskLabel}</p>
  </div>

  ${
    payload.escalation_required
      ? `<!-- Escalation Banner -->
  <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:10px;padding:20px;margin-bottom:20px;text-align:center;">
    <p style="color:#991b1b;font-weight:700;font-size:15px;margin:0 0 4px;">⚠ Board Escalation Required</p>
    <p style="color:#b91c1c;font-size:13px;margin:0;">${payload.escalation_reason || "Multiple critical signals detected"}</p>
  </div>`
      : ""
  }

  ${
    payload.alerts.length > 0
      ? `<!-- Alert Table -->
  <div style="background:#ffffff;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <h3 style="color:#111827;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #111827;">Active Alerts (${payload.alerts.length})</h3>
    <table style="width:100%;border-collapse:collapse;">${alertRows}</table>
  </div>`
      : ""
  }

  ${
    payload.top_action
      ? `<!-- Recommended Action -->
  <div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:20px;">
    <p style="color:#166534;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;font-weight:600;">Recommended Action</p>
    <p style="color:#15803d;font-size:14px;margin:0;">${payload.top_action}</p>
  </div>`
      : ""
  }

  <!-- CTA -->
  <div style="text-align:center;margin:28px 0;">
    <a href="https://quantivis.io/executive" style="display:inline-block;background:#111827;color:#ffffff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.3px;">Open Executive Command →</a>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding-top:24px;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:11px;margin:0 0 4px;">${orgName}</p>
    <p style="color:#d1d5db;font-size:10px;margin:0 0 4px;">${timestamp}</p>
    <p style="color:#d1d5db;font-size:10px;margin:0;">Powered by Quantivis Strategic Intelligence</p>
  </div>
</div>
</body>
</html>`;
}

/* ──────────────────── MAIN HANDLER ──────────────────── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Environment guard
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error(
        JSON.stringify({ event: "resend_not_configured", message: "RESEND_API_KEY is missing" }),
      );
      return new Response(
        JSON.stringify({ error: "Resend not configured. Set RESEND_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fromAddress =
      Deno.env.get("RESEND_FROM_EMAIL") ||
      "Quantivis Executive Intelligence <alerts@quantivis.io>";

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload: AlertPayload = await req.json();
    const { organization_id, role_type, risk_score, alerts, escalation_required } = payload;

    if (!organization_id || !role_type) {
      return new Response(
        JSON.stringify({ error: "organization_id and role_type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate limit: skip if same role+org sent within 15 min
    const rateLimited = await isRateLimited(serviceClient, organization_id, role_type);
    if (rateLimited) {
      await serviceClient.from("notification_log").insert({
        organization_id,
        role_type,
        channel: "email",
        subject: "Skipped — rate limited",
        recipients: [],
        status: "skipped_rate_limit",
        metadata: { risk_score, escalation_required, alert_count: alerts.length },
      });
      console.log(
        JSON.stringify({ event: "alert_skipped_rate_limit", organization_id, role_type }),
      );
      return new Response(
        JSON.stringify({ sent: false, reason: "Rate limited (15 min cooldown)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Shared metadata for notification_log
    const logMetadata = {
      risk_score,
      escalation_required,
      alert_count: alerts.length,
    };

    // Fetch org name
    const { data: org } = await serviceClient
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();

    const orgName = org?.name || "Organization";

    // Fetch notification preferences
    const { data: prefs } = await serviceClient
      .from("notification_preferences")
      .select("*")
      .eq("organization_id", organization_id)
      .eq("role_type", role_type)
      .maybeSingle();

    const results: {
      email: boolean | null;
      slack: boolean | null;
      escalation: boolean | null;
    } = { email: null, slack: null, escalation: null };

    // Threshold check
    const threshold = prefs?.alert_threshold ?? 50;
    const shouldNotify =
      risk_score >= threshold || alerts.some((a) => a.severity === "critical");

    if (!shouldNotify) {
      return new Response(
        JSON.stringify({ sent: false, reason: "Below threshold" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Email notification
    if (prefs?.email_enabled && prefs.email_recipients?.length > 0) {
      const subject = buildSubjectLine(payload, orgName);
      const html = buildAlertEmailHtml(payload, orgName);
      results.email = await sendEmail(
        RESEND_API_KEY,
        fromAddress,
        prefs.email_recipients,
        subject,
        html,
        serviceClient,
        organization_id,
        role_type,
        logMetadata,
      );
    }

    // Slack notification
    if (prefs?.slack_enabled && prefs.slack_webhook_url) {
      results.slack = await sendSlackWebhook(
        prefs.slack_webhook_url,
        payload,
        serviceClient,
        logMetadata,
      );
    }

    // Escalation notification (secondary email to all org owners)
    if (escalation_required) {
      const { data: owners } = await serviceClient
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organization_id)
        .eq("role", "owner");

      if (owners && owners.length > 0) {
        const ownerEmails: string[] = [];
        for (const owner of owners) {
          const {
            data: { user },
          } = await serviceClient.auth.admin.getUserById(owner.user_id);
          if (user?.email) ownerEmails.push(user.email);
        }

        if (ownerEmails.length > 0) {
          const escalationSubject = buildSubjectLine(
            { ...payload, escalation_required: true },
            orgName,
          );
          const escalationHtml = buildAlertEmailHtml(
            { ...payload, escalation_required: true },
            orgName,
          );
          results.escalation = await sendEmail(
            RESEND_API_KEY,
            fromAddress,
            ownerEmails,
            escalationSubject,
            escalationHtml,
            serviceClient,
            organization_id,
            role_type,
            { ...logMetadata, channel_type: "escalation" },
          );

          await serviceClient.from("notification_log").insert({
            organization_id,
            role_type,
            channel: "escalation",
            subject: escalationSubject,
            recipients: ownerEmails,
            status: results.escalation ? "sent" : "failed",
            metadata: logMetadata,
          });
        }
      }
    }

    // Mark alerts as notified
    const alertChannel = [results.email && "email", results.slack && "slack"]
      .filter(Boolean)
      .join(",");
    if (alertChannel) {
      await serviceClient
        .from("executive_alerts")
        .update({
          notified_at: new Date().toISOString(),
          notification_channel: alertChannel,
        })
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

    console.log(
      JSON.stringify({
        event: "executive_alert_sent",
        organization_id,
        role_type,
        risk_score,
        ...results,
      }),
    );

    return new Response(JSON.stringify({ sent: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-executive-alert error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
