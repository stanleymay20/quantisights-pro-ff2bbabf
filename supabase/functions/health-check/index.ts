import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { cronGuard } from "../_shared/cron-guard.ts";

/**
 * Health Check Endpoint
 * 
 * Provides a lightweight status probe for uptime monitoring,
 * load balancers, and enterprise SLA dashboards.
 * 
 * Returns:
 *  - 200 with service status when all systems nominal
 *  - 503 with degraded status if database is unreachable
 */
serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const log = createLogger("health-check", req);

  if (req.method === "OPTIONS") {
    return corsPreflightResponse(req);
  }

  const start = Date.now();
  const checks: Record<string, { status: string; latency_ms?: number }> = {};

  // 1. Database connectivity check
  try {
    const dbStart = Date.now();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );
    const { error } = await supabase
      .from("organizations")
      .select("id")
      .limit(1)
      .maybeSingle();

    checks.database = {
      status: error ? "degraded" : "healthy",
      latency_ms: Date.now() - dbStart,
    };
  } catch {
    checks.database = { status: "unreachable" };
  }

  // 2. Auth service check
  try {
    const authStart = Date.now();
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")!}/auth/v1/health`, {
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    });
    checks.auth = {
      status: resp.ok ? "healthy" : "degraded",
      latency_ms: Date.now() - authStart,
    };
    // Consume body to prevent resource leak
    await resp.text();
  } catch {
    checks.auth = { status: "unreachable" };
  }

  // 3. Storage check
  try {
    const storageStart = Date.now();
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")!}/storage/v1/health`, {
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
    });
    checks.storage = {
      status: resp.ok ? "healthy" : "degraded",
      latency_ms: Date.now() - storageStart,
    };
    await resp.text();
  } catch {
    checks.storage = { status: "unreachable" };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");
  const overallStatus = allHealthy ? "healthy" : "degraded";
  const httpStatus = allHealthy ? 200 : 503;

  // Log cron run for observability
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );
    await supabase.from("cron_run_log").insert({
      job_name: "health-check",
      status: overallStatus,
      duration_ms: Date.now() - start,
      metadata: checks,
    });
  } catch {
    // Non-critical — don't fail health check if logging fails
  }

  return new Response(
    JSON.stringify({
      status: overallStatus,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime_ms: Date.now() - start,
      checks,
    }),
    {
      status: httpStatus,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store",
      },
    }
  );
});
