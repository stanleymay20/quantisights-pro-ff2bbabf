import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { isValidUUID, isValidString, isValidEnum, validateCreatePlan, validationErrorResponse } from "../_shared/input-validation.ts";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";

/** Require owner/admin role for sensitive execution actions */
async function requirePrivilegedRole(
  supabase: any,
  userId: string,
  organizationId: string,
  corsHdrs: Record<string, string>,
  allowedRoles: string[] = ["owner", "admin"]
): Promise<Response | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .single();

  if (!data || !allowedRoles.includes(data.role)) {
    return new Response(JSON.stringify({ error: "Insufficient permissions. Requires: " + allowedRoles.join(", ") }), {
      status: 403,
      headers: { ...corsHdrs, "Content-Type": "application/json" },
    });
  }
  return null;
}

/** Validate webhook URL against org-approved destinations */
async function validateWebhookUrl(
  supabase: any,
  organizationId: string,
  url: string
): Promise<{ allowed: boolean; reason?: string }> {
  // Block private/internal IPs (SSRF prevention)
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block internal networks
    const blocked = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^0\./,
      /^169\.254\./,
      /^\[::1\]$/,
      /^metadata\.google/,
      /^169\.254\.169\.254/,
    ];

    if (blocked.some(r => r.test(hostname))) {
      return { allowed: false, reason: "Internal/private addresses are not allowed" };
    }

    // Must be HTTPS
    if (parsed.protocol !== "https:") {
      return { allowed: false, reason: "Only HTTPS webhook URLs are allowed" };
    }
  } catch {
    return { allowed: false, reason: "Invalid URL format" };
  }

  // Check org-approved webhook destinations (if configured)
  const { data: configs } = await supabase
    .from("connector_configs")
    .select("host")
    .eq("organization_id", organizationId)
    .eq("connector_type", "webhook");

  // If org has configured webhook destinations, enforce allowlist
  if (configs && configs.length > 0) {
    const allowedHosts = configs.map((c: any) => c.host?.toLowerCase()).filter(Boolean);
    const parsedHost = new URL(url).hostname.toLowerCase();
    if (!allowedHosts.some((h: string) => parsedHost === h || parsedHost.endsWith("." + h))) {
      return { allowed: false, reason: `Domain not in approved webhook destinations. Approved: ${allowedHosts.join(", ")}` };
    }
  }

  return { allowed: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);

  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const body = await req.json();
  const { action, organization_id, decision_id, ...params } = body;

  if (!organization_id || typeof organization_id !== "string") {
    return new Response(JSON.stringify({ error: "organization_id required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isMember = await verifyOrgMembership(userId, organization_id);
  if (!isMember) {
    return new Response(JSON.stringify({ error: "Not a member of this organization" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    switch (action) {
      case "create_plan": {
        const { action_title, action_description, owner_user_id, priority, deadline, trigger_type, trigger_config } = params;
        if (!decision_id || !action_title || typeof action_title !== "string") {
          return new Response(JSON.stringify({ error: "decision_id and action_title required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Validate input lengths
        if (action_title.length > 500) {
          return new Response(JSON.stringify({ error: "action_title must be under 500 characters" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const validPriorities = ["critical", "high", "medium", "low"];
        const safePriority = validPriorities.includes(priority) ? priority : "medium";

        const { data: plan, error } = await supabase
          .from("execution_plans")
          .insert({
            decision_id,
            organization_id,
            action_title: action_title.trim().slice(0, 500),
            action_description: action_description ? String(action_description).trim().slice(0, 2000) : null,
            owner_user_id: owner_user_id || userId,
            priority: safePriority,
            deadline: deadline || null,
            trigger_type: trigger_type || "manual",
            trigger_config: trigger_config || {},
            status: "pending",
          })
          .select()
          .single();

        if (error) throw error;

        await supabase.from("execution_events").insert({
          execution_plan_id: plan.id,
          organization_id,
          event_type: "plan_created",
          actor_id: userId,
          metadata: { action_title: plan.action_title, priority: safePriority },
        });

        await supabase.from("audit_log").insert({
          organization_id,
          actor_id: userId,
          actor_type: "user",
          action_type: "execution_plan_created",
          resource_type: "execution_plan",
          resource_id: plan.id,
          payload: { decision_id, action_title: plan.action_title },
        });

        return new Response(JSON.stringify(plan), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_plan_status": {
        const { plan_id, status, notes } = params;
        if (!plan_id || !status) {
          return new Response(JSON.stringify({ error: "plan_id and status required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const validStatuses = ["pending", "in_progress", "completed", "failed", "cancelled"];
        if (!validStatuses.includes(status)) {
          return new Response(JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // FIX: Read CURRENT status BEFORE updating
        const { data: currentPlan, error: fetchErr } = await supabase
          .from("execution_plans")
          .select("status, decision_id")
          .eq("id", plan_id)
          .eq("organization_id", organization_id)
          .single();

        if (fetchErr || !currentPlan) {
          return new Response(JSON.stringify({ error: "Plan not found" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const previousStatus = currentPlan.status;

        // Now update
        const { data: updatedPlan, error } = await supabase
          .from("execution_plans")
          .update({ status })
          .eq("id", plan_id)
          .eq("organization_id", organization_id)
          .select()
          .single();

        if (error) throw error;

        // Log with CORRECT previous status
        await supabase.from("execution_events").insert({
          execution_plan_id: plan_id,
          organization_id,
          event_type: `status_${status}`,
          actor_id: userId,
          metadata: { previous_status: previousStatus, new_status: status, notes: notes ? String(notes).slice(0, 1000) : null },
        });

        await supabase.from("audit_log").insert({
          organization_id,
          actor_id: userId,
          actor_type: "user",
          action_type: "execution_plan_status_changed",
          resource_type: "execution_plan",
          resource_id: plan_id,
          payload: { previous_status: previousStatus, new_status: status, notes: notes ? String(notes).slice(0, 1000) : null },
        });

        // Sync decision execution_status based on all plans
        const { data: allPlans } = await supabase
          .from("execution_plans")
          .select("status")
          .eq("decision_id", currentPlan.decision_id)
          .eq("organization_id", organization_id);

        if (allPlans && allPlans.length > 0) {
          const allDone = allPlans.every((p: any) => p.status === "completed" || p.status === "cancelled");
          const anyInProgress = allPlans.some((p: any) => p.status === "in_progress");
          const anyFailed = allPlans.some((p: any) => p.status === "failed");

          let newExecStatus = "not_started";
          if (allDone) newExecStatus = "completed";
          else if (anyFailed) newExecStatus = "blocked";
          else if (anyInProgress) newExecStatus = "in_progress";

          await supabase
            .from("decision_ledger")
            .update({
              execution_status: newExecStatus,
              ...(newExecStatus === "in_progress" ? { execution_started_at: new Date().toISOString() } : {}),
              ...(newExecStatus === "completed" ? { execution_completed_at: new Date().toISOString() } : {}),
            })
            .eq("id", currentPlan.decision_id);
        }

        return new Response(JSON.stringify(updatedPlan), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "trigger_webhook": {
        const { plan_id, webhook_url, payload } = params;
        if (!plan_id || !webhook_url) {
          return new Response(JSON.stringify({ error: "plan_id and webhook_url required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Require admin/owner for webhook triggers
        const roleCheck = await requirePrivilegedRole(supabase, userId, organization_id, corsHeaders, ["owner", "admin"]);
        if (roleCheck) return roleCheck;

        // Validate webhook URL (SSRF prevention + allowlist)
        const validation = await validateWebhookUrl(supabase, organization_id, webhook_url);
        if (!validation.allowed) {
          await supabase.from("execution_events").insert({
            execution_plan_id: plan_id,
            organization_id,
            event_type: "webhook_blocked",
            actor_id: userId,
            metadata: { webhook_url, reason: validation.reason },
          });
          return new Response(JSON.stringify({ error: `Webhook blocked: ${validation.reason}` }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
          const webhookResp = await fetch(webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload || {}),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          const success = webhookResp.ok;

          await supabase.from("execution_events").insert({
            execution_plan_id: plan_id,
            organization_id,
            event_type: success ? "webhook_success" : "webhook_failed",
            actor_id: userId,
            metadata: { webhook_url, status_code: webhookResp.status, success },
          });

          await supabase.from("audit_log").insert({
            organization_id,
            actor_id: userId,
            actor_type: "user",
            action_type: "webhook_triggered",
            resource_type: "execution_plan",
            resource_id: plan_id,
            payload: { webhook_url, status_code: webhookResp.status, success },
          });

          return new Response(JSON.stringify({ success, status_code: webhookResp.status }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          clearTimeout(timeout);
          await supabase.from("execution_events").insert({
            execution_plan_id: plan_id,
            organization_id,
            event_type: "webhook_failed",
            actor_id: userId,
            metadata: { webhook_url, error: (e as Error).message },
          });
          return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "notify_slack": {
        const { plan_id, channel, message } = params;

        // Require admin/owner for Slack triggers
        const roleCheck = await requirePrivilegedRole(supabase, userId, organization_id, corsHeaders, ["owner", "admin"]);
        if (roleCheck) return roleCheck;

        // Channel is REQUIRED — no defaults
        if (!channel || typeof channel !== "string" || !channel.trim()) {
          return new Response(JSON.stringify({ error: "Slack channel is required. No default channel allowed." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!message || typeof message !== "string" || !message.trim()) {
          return new Response(JSON.stringify({ error: "Message content is required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");

        if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
          return new Response(JSON.stringify({ error: "Slack not configured for this organization" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
        const resp = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": SLACK_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: channel.trim(),
            text: message.trim().slice(0, 4000),
          }),
        });

        const data = await resp.json();

        // Always log Slack sends
        await supabase.from("execution_events").insert({
          execution_plan_id: plan_id || null,
          organization_id,
          event_type: resp.ok ? "slack_sent" : "slack_failed",
          actor_id: userId,
          metadata: { channel: channel.trim(), success: resp.ok, response_ok: data?.ok },
        });

        await supabase.from("audit_log").insert({
          organization_id,
          actor_id: userId,
          actor_type: "user",
          action_type: "slack_notification_sent",
          resource_type: "execution_plan",
          resource_id: plan_id || null,
          payload: { channel: channel.trim(), success: resp.ok },
        });

        return new Response(JSON.stringify({ success: resp.ok, data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_timeline": {
        if (!decision_id) {
          return new Response(JSON.stringify({ error: "decision_id required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: plans } = await supabase
          .from("execution_plans")
          .select("*")
          .eq("decision_id", decision_id)
          .eq("organization_id", organization_id)
          .order("created_at", { ascending: true });

        const planIds = (plans || []).map((p: any) => p.id);
        let events: any[] = [];
        if (planIds.length > 0) {
          const { data: evts } = await supabase
            .from("execution_events")
            .select("*")
            .in("execution_plan_id", planIds)
            .eq("organization_id", organization_id)
            .order("created_at", { ascending: true });
          events = evts || [];
        }

        return new Response(JSON.stringify({ plans: plans || [], events }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("execute-decision-action error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
