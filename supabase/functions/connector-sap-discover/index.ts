// @ts-nocheck
/**
 * SAP OData $metadata discovery — caches entity types, key fields, fields,
 * navigation properties to sap_object_schemas so pull jobs can validate
 * field allowlists, drift-detect schema changes, and surface to operators.
 *
 * Read-only; never mutates SAP. Throttled by connector circuit breaker.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsPreflightResponse, getCorsHeaders } from "../_shared/cors.ts";
import { shouldAllow, recordSuccess, recordFailure } from "../_shared/connector-isolation.ts";
import {
  buildMetadataUrl, buildSapAuthHeaders, parseMetadataXml,
  type SapConnectorConfig, type ODataVersion,
} from "../_shared/sap-odata.ts";
import { logConnectorEvent } from "../_shared/warehouse-config.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflightResponse(req);
  const cors = getCorsHeaders(req);
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { connector_id } = await req.json().catch(() => ({}));
    if (!connector_id) return j({ error: "connector_id required" }, 400, cors);

    const { data: connector, error: cErr } = await svc.from("data_connectors")
      .select("*").eq("id", connector_id).single();
    if (cErr || !connector) return j({ error: "connector not found" }, 404, cors);
    if (connector.connector_type !== "sap_odata") return j({ error: "not a SAP OData connector" }, 400, cors);

    const orgId = connector.organization_id;
    const cfg = (connector.config ?? {}) as SapConnectorConfig;
    const version: ODataVersion = cfg.odata_version ?? "V2";
    if (!cfg.base_url || !cfg.auth || !cfg.services?.length) {
      return j({ error: "config must include base_url, auth, services[]" }, 412, cors);
    }

    const gate = await shouldAllow(svc, orgId, connector_id);
    if (!gate.allow) return j({ skipped: true, reason: gate.reason }, 200, cors);

    const t0 = Date.now();
    let headers: Record<string, string>;
    try { headers = await buildSapAuthHeaders(cfg.auth); }
    catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await recordFailure(svc, connector_id, msg);
      return j({ error: msg }, 412, cors);
    }

    const discovered: any[] = [];
    const errors: any[] = [];

    for (const service of cfg.services) {
      const url = buildMetadataUrl(cfg.base_url, version, service);
      try {
        const res = await fetch(url, { headers });
        if (!res.ok) {
          errors.push({ service, status: res.status, error: (await res.text()).slice(0, 200) });
          continue;
        }
        const xml = await res.text();
        const types = parseMetadataXml(xml);
        for (const t of types) {
          for (const setName of t.entity_sets) {
            const row = {
              organization_id: orgId,
              connector_id,
              service_name: service,
              entity_set: setName,
              entity_type: t.entity_type,
              odata_version: version,
              is_custom: /^(Y|Z)/.test(t.entity_type) || /^(Y|Z)/.test(setName),
              key_fields: t.key_fields,
              fields: t.fields,
              navigation_properties: t.navigation_properties,
              last_discovered_at: new Date().toISOString(),
            };
            discovered.push(row);
          }
        }
      } catch (e) {
        errors.push({ service, error: e instanceof Error ? e.message : String(e) });
      }
    }

    if (discovered.length) {
      const { error } = await svc.from("sap_object_schemas").upsert(discovered, {
        onConflict: "connector_id,service_name,entity_set",
        ignoreDuplicates: false,
      });
      if (error) errors.push({ stage: "upsert", error: error.message });
    }

    await recordSuccess(svc, connector_id);
    logConnectorEvent({
      connector_type: "sap_odata", connector_id, organization_id: orgId,
      phase: "complete", rows_inserted: discovered.length, duration_ms: Date.now() - t0,
    });
    return j({ success: true, discovered: discovered.length, services: cfg.services.length, errors }, 200, cors);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("connector-sap-discover error:", msg);
    return j({ error: msg }, 500, cors);
  }
});

function j(b: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
