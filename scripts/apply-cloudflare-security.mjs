import { fileURLToPath } from "node:url";

const API_BASE = "https://api.cloudflare.com/client/v4";
const HOSTNAME = "www.quantivis.io";
const RULE_REF = "quantivis_enterprise_security_headers";
const RULE_DESCRIPTION = "Quantivis enterprise security headers for www.quantivis.io";
const PHASE = "http_response_headers_transform";

export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://*.sentry.io https://browser.sentry-cdn.com",
  "connect-src 'self' https://*.supabase.co https://*.sentry.io https://*.posthog.com https://*.ingest.sentry.io wss://*.supabase.co",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const permissionsPolicy = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "serial=()",
  "bluetooth=()",
  "interest-cohort=()",
].join(", ");

export const managedHeaders = {
  "Content-Security-Policy": { operation: "set", value: contentSecurityPolicy },
  "X-Frame-Options": { operation: "set", value: "DENY" },
  "Strict-Transport-Security": {
    operation: "set",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  "X-Content-Type-Options": { operation: "set", value: "nosniff" },
  "Referrer-Policy": { operation: "set", value: "strict-origin-when-cross-origin" },
  "Permissions-Policy": { operation: "set", value: permissionsPolicy },
  "Cross-Origin-Opener-Policy": { operation: "set", value: "same-origin" },
  "Cross-Origin-Resource-Policy": { operation: "set", value: "same-origin" },
};

export function buildCloudflareHeaderRule() {
  return {
    ref: RULE_REF,
    description: RULE_DESCRIPTION,
    expression: `http.host eq "${HOSTNAME}"`,
    action: "rewrite",
    action_parameters: { headers: managedHeaders },
    enabled: true,
  };
}

const rule = buildCloudflareHeaderRule();

function readCloudflareEnvironment(env = process.env) {
  const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID } = env;

  if (!CLOUDFLARE_API_TOKEN) {
    throw new Error("CLOUDFLARE_API_TOKEN is required.");
  }

  if (!CLOUDFLARE_ZONE_ID) {
    throw new Error("CLOUDFLARE_ZONE_ID is required.");
  }

  return { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID };
}

async function cloudflareRequest(path, options = {}, env = readCloudflareEnvironment()) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok || payload.success === false) {
    const messages = [
      ...(payload.errors ?? []).map((error) => `${error.code}: ${error.message}`),
      ...(payload.messages ?? []).map((message) => message.message),
    ].filter(Boolean);
    const reason = messages.length > 0 ? messages.join("; ") : response.statusText;
    const error = new Error(`Cloudflare API ${response.status} ${response.statusText}: ${reason}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload.result;
}

async function readEntrypointRuleset(env) {
  try {
    return await cloudflareRequest(`/zones/${env.CLOUDFLARE_ZONE_ID}/rulesets/phases/${PHASE}/entrypoint`, {}, env);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

function upsertManagedRule(existingRules = []) {
  let replaced = false;
  const rules = existingRules.map((existingRule) => {
    const isManagedRule =
      existingRule.ref === RULE_REF ||
      existingRule.description === RULE_DESCRIPTION ||
      existingRule.expression === rule.expression;

    if (!isManagedRule) return existingRule;
    replaced = true;
    return { ...existingRule, ...rule, id: existingRule.id };
  });

  if (!replaced) rules.push(rule);
  return { rules, replaced };
}

export function buildEntrypointRulesetPayload(existingRuleset, rules) {
  return {
    name: existingRuleset?.name ?? "default",
    description:
      existingRuleset?.description ??
      "Zone-level HTTP response header transform rules managed by automation.",
    phase: PHASE,
    rules,
  };
}

export async function applyEnterpriseSecurityHeaders(env = readCloudflareEnvironment()) {
  const existingRuleset = await readEntrypointRuleset(env);
  const { rules, replaced } = upsertManagedRule(existingRuleset?.rules ?? []);

  const result = await cloudflareRequest(
    `/zones/${env.CLOUDFLARE_ZONE_ID}/rulesets/phases/${PHASE}/entrypoint`,
    {
      method: "PUT",
      body: JSON.stringify(buildEntrypointRulesetPayload(existingRuleset, rules)),
    },
    env,
  );

  console.log(
    `${replaced ? "Updated" : "Created"} Cloudflare response header transform rule "${RULE_DESCRIPTION}".`,
  );
  console.log(`Ruleset ID: ${result.id}`);
  console.log(`Target expression: ${rule.expression}`);
  console.log(`Managed headers: ${Object.keys(managedHeaders).join(", ")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  applyEnterpriseSecurityHeaders().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
