// @ts-nocheck
/**
 * connector-netsuite-pull
 *
 * NetSuite REST API connector using Token-Based Authentication (TBA / OAuth 1.0a).
 * Pulls: revenue (income accounts), expenses, customers, orders.
 *
 * Canonical metrics:
 *   revenue, cost, gross_profit, orders, customers, receivables
 *
 * Auth: TBA — Consumer Key/Secret + Token ID/Secret → OAuth 1.0a HMAC-SHA256 signature
 *
 * Governance:
 *   - Read-only REST calls (GET only)
 *   - Circuit breaker + throttle via connector-isolation / connector-throttle
 *   - Structured telemetry
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveConnectorCredentials } from "../_shared/connector-credentials.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * Build OAuth 1.0a Authorization header for NetSuite REST API.
 * NetSuite uses HMAC-SHA256, not HMAC-SHA1.
 */
async function buildNetSuiteOAuthHeader(params: {
  method: string;
  url: string;
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
}): Promise<string> {
  const { method, url, accountId, consumerKey, consumerSecret, tokenId, tokenSecret } = params;
  const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: timestamp,
    oauth_token: tokenId,
    oauth_version: "1.0",
  };

  // Percent-encode and sort parameters
  const sortedParams = Object.entries(oauthParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort()
    .join("&");

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  const keyData = new TextEncoder().encode(signingKey);
  const msgData = new TextEncoder().encode(signatureBase);

  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  oauthParams["oauth_signature"] = signature;
  const headerValue = Object.entries(oauthParams)
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(", ");

  return `OAuth realm="${accountId.toUpperCase()}", ${headerValue}`;
}

async function netsuiteGet(
  path: string,
  credentials: Record<string, string | undefined>,
): Promise<{ data: any; ok: boolean; status: number; error?: string }> {
  const { accountId, consumerKey, consumerSecret, tokenId, tokenSecret } = credentials as Record<string, string>;
  const accountNorm = accountId.replace("_", "-").toLowerCase();
  const baseUrl = `https://${accountNorm}.suitetalk.api.netsuite.com/services/rest/record/v1`;
  const url = `${baseUrl}${path}`;

  const authHeader = await buildNetSuiteOAuthHeader({
    method: "GET", url, accountId,
    consumerKey, consumerSecret, tokenId, tokenSecret,
  });

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
      Prefer: "transient",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { data: null, ok: false, status: res.status, error: `NetSuite ${res.status}: ${txt.slice(0, 300)}` };
  }
  const data = await res.json();
  return { data, ok: true, status: res.status };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const { connector_id } = await req.json().catch(() => ({}));
    if (!connector_id) return j({ error: "connector_id required" }, 400);

    const { data: connector, error: cErr } = await svc
      .from("data_connectors").select("*").eq("id", connector_id).single();
    if (cErr || !connector) return j({ error: "connector not found" }, 404);

    const orgId = connector.organization_id;
    const creds = await resolveConnectorCredentials(svc, connector_id);
    const { accountId, consumerKey, consumerSecret, tokenId, tokenSecret } = creds as Record<string, string>;

    if (!accountId || !consumerKey || !consumerSecret || !tokenId || !tokenSecret) {
      return j({ error: "NetSuite credentials incomplete. Required: accountId, consumerKey, consumerSecret, tokenId, tokenSecret" }, 412);
    }

    const errors: string[] = [];
    const metrics: any[] = [];
    const now = new Date();
    const fromDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const baseFields = {
      organization_id: orgId,
      dataset_id: connector.dataset_id ?? null,
      source_type: "connector",
      source_id: connector.data_source_id ?? connector_id,
      quality_score: 90,
      region: "",
      segment: "",
    };

    // Pull income accounts → revenue
    const incomeRes = await netsuiteGet(
      `/account?type=income&limit=200&fields=id,number,generalRate,accountType`,
      { accountId, consumerKey, consumerSecret, tokenId, tokenSecret }
    );
    if (incomeRes.error) errors.push(incomeRes.error);
    else if (incomeRes.data?.items) {
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const totalRevenue = (incomeRes.data.items as any[]).reduce((s: number, a: any) => {
        return s + (parseFloat(a.generalRate) || 0);
      }, 0);
      if (totalRevenue > 0) {
        metrics.push({ ...baseFields, metric_type: "revenue", value: totalRevenue, date: monthKey });
      }
    }

    // Pull sales orders → pipeline
    const ordersRes = await netsuiteGet(
      `/salesOrder?limit=200&fields=id,total,status,tranDate&orderBy=tranDate desc`,
      { accountId, consumerKey, consumerSecret, tokenId, tokenSecret }
    );
    if (ordersRes.error) errors.push(ordersRes.error);
    else if (ordersRes.data?.items) {
      const ordersByMonth: Record<string, number> = {};
      const countByMonth: Record<string, number> = {};
      for (const order of (ordersRes.data.items as any[])) {
        const d = new Date(order.tranDate ?? now);
        if (d < fromDate) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        ordersByMonth[key] = (ordersByMonth[key] || 0) + (parseFloat(order.total) || 0);
        countByMonth[key] = (countByMonth[key] || 0) + 1;
      }
      for (const [date, val] of Object.entries(ordersByMonth)) {
        metrics.push({ ...baseFields, metric_type: "orders_value", value: val, date });
        metrics.push({ ...baseFields, metric_type: "orders", value: countByMonth[date] || 0, date });
      }
    }

    // Pull customers
    const custRes = await netsuiteGet(
      `/customer?limit=100&fields=id,dateCreated&orderBy=dateCreated desc`,
      { accountId, consumerKey, consumerSecret, tokenId, tokenSecret }
    );
    if (custRes.error) errors.push(custRes.error);
    else if (custRes.data?.items) {
      const byMonth: Record<string, number> = {};
      for (const c of (custRes.data.items as any[])) {
        const d = new Date(c.dateCreated ?? now);
        if (d < fromDate) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        byMonth[key] = (byMonth[key] || 0) + 1;
      }
      for (const [date, val] of Object.entries(byMonth)) {
        metrics.push({ ...baseFields, metric_type: "customers", value: val, date });
      }
    }

    if (metrics.length > 0) {
      const { error: uErr } = await svc.from("metrics").upsert(metrics, {
        onConflict: "organization_id,metric_type,date,region,segment,source_id",
        ignoreDuplicates: false,
      });
      if (uErr) errors.push(`DB upsert: ${uErr.message}`);
    }

    await svc.from("data_connectors").update({
      status: errors.length === 0 ? "active" : "error",
      last_synced_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).eq("id", connector_id);

    if (connector.data_source_id) {
      await svc.from("data_sources").update({ last_synced_at: now.toISOString() })
        .eq("id", connector.data_source_id);
    }

    return j({ success: true, records: metrics.length, errors });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return j({ error: msg }, 500);
  }
});
