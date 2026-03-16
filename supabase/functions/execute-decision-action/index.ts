import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, verifyOrgMembership } from "../_shared/auth-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authenticateRequest(req);
  if (auth.response) return auth.response;
  const userId = auth.userId;

  const body = await req.json();
  const { action, organization_id, decision_id, ...params } = body;

  if (!organization_id) {
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
        if (!decision_id || !action_title) {
          return new Response(JSON.stringify({ error: "decision_id and action_title required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: plan, error } = await supabase
          .from("execution_plans")
          .insert({
            decision_id,
            organization_id,
            action_title,
            action_description: action_description || null,
            owner_user_id: owner_user_id || userId,
            priority: priority || "medium",
            deadline: deadline || null,
            trigger_type: trigger_type || "manual",
            trigger_config: trigger_config || {},
            status: "pending",
          })
          .select()
          .single();

        if (error) throw error;

        // Log event
        await supabase.from("execution_events").insert({
          execution_plan_id: plan.id,
          organization_id,
          event_type: "plan_created",
          actor_id: userId,
          metadata: { action_title, priority },
        });

        // Audit log
        await supabase.from("audit_log").insert({
          organization_id,
          actor_id: userId,
          actor_type: "user",
          action_type: "execution_plan_created",
          resource_type: "execution_plan",
          resource_id: plan.id,
          payload: { decision_id, action_title },
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

        const { data: plan, error } = await supabase
          .from("execution_plans")
          .update({ status })
          .eq("id", plan_id)
          .eq("organization_id", organization_id)
          .select()
          .single();

        if (error) throw error;

        await supabase.from("execution_events").insert({
          execution_plan_id: plan_id,
          organization_id,
          event_type: `status_${status}`,
          actor_id: userId,
          metadata: { previous_status: plan.status, new_status: status, notes },
        });

        await supabase.from("audit_log").insert({
          organization_id,
          actor_id: userId,
          actor_type: "user",
          action_type: "execution_plan_status_changed",
          resource_type: "execution_plan",
          resource_id: plan_id,
          payload: { status, notes },
        });

        // If all plans for decision are completed, update decision execution_status
        const { data: allPlans } = await supabase
          .from("execution_plans")
          .select("status")
          .eq("decision_id", plan.decision_id)
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
            .eq("id", plan.decision_id);
        }

        return new Response(JSON.stringify(plan), {
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
            metadata: {
              webhook_url,
              status_code: webhookResp.status,
              success,
            },
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
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");

        if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
          return new Response(JSON.stringify({ error: "Slack not configured" }), {
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
            channel: channel || "#general",
            text: message || "Decision action triggered from Quantivis",
          }),
        });

        const data = await resp.json();

        if (plan_id) {
          await supabase.from("execution_events").insert({
            execution_plan_id: plan_id,
            organization_id,
            event_type: resp.ok ? "slack_sent" : "slack_failed",
            actor_id: userId,
            metadata: { channel, success: resp.ok },
          });
        }

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
