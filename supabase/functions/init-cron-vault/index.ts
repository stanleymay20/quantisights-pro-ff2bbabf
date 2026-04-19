/**
 * One-shot bootstrapper: copies the INGEST_CRON_SECRET env var into Supabase Vault
 * under the name `ingest_cron_secret` so pg_cron jobs can read it at runtime.
 *
 * Idempotent: re-running updates the existing vault entry.
 *
 * Auth: requires the caller to present the same secret in `x-bootstrap-secret`,
 * preventing unauthorised vault writes from anyone with anon access.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const corsHeaders = getCorsHeaders(req);
  const log = createLogger("init-cron-vault", req);

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const expected = Deno.env.get("INGEST_CRON_SECRET");
  if (!expected) {
    log.error("INGEST_CRON_SECRET not configured");
    return json({ error: "Server not configured" }, 500);
  }

  const provided = req.headers.get("x-bootstrap-secret");
  if (!provided || provided !== expected) {
    log.warn("unauthorised bootstrap attempt");
    return json({ error: "Unauthorised" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Upsert into vault.secrets via the helper RPCs
    // First check existence
    const { data: existing } = await supabase
      .schema("vault" as never)
      .from("secrets" as never)
      .select("id")
      .eq("name", "ingest_cron_secret")
      .maybeSingle();

    if (existing) {
      // @ts-expect-error vault schema not in types
      const { error } = await supabase.rpc("update_secret", {
        secret_id: (existing as { id: string }).id,
        new_secret: expected,
      });
      if (error) throw error;
      log.info("vault secret updated");
    } else {
      // @ts-expect-error vault schema not in types
      const { error } = await supabase.rpc("create_secret", {
        new_secret: expected,
        new_name: "ingest_cron_secret",
        new_description: "Shared secret used by pg_cron to authenticate to ingest-external-signals",
      });
      if (error) throw error;
      log.info("vault secret created");
    }

    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error("vault write failed", { error: msg });
    return json({ error: msg }, 500);
  }
});
