const API_BASE = "https://api.cloudflare.com/client/v4";
const HOSTNAME = "www.quantivis.io";
const RULE_REF = "quantivis_enterprise_security_headers";
const RULE_DESCRIPTION = "Quantivis enterprise security headers for www.quantivis.io";
const PHASE = "http_response_headers_transform";

const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID } = process.env;

if (!CLOUDFLARE_API_TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is required.");
  process.exitCode = 1;
}

if (!CLOUDFLARE_ZONE_ID) {
  console.error("CLOUDFLARE_ZONE_ID is required.");
  process.exitCode = 1;
}

if (process.exitCode) {
  process.exit();
}

const contentSecurityPolicy =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.posthog.com https://*.sentry.io https://browser.sentry-cdn.com; connect-src 'self' https://*.supabase.co https://*.sentry.io https://*.posthog.com https://*.ingest.sentry.io wss://*.supabase.co; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data: https:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests";

const managedHeaders = [
  {
    name: "Content-Security-Policy",
    operation: "set",
    value: contentSecurityPolicy,
  },
  {
    name: "X-Frame-Options",
    operation: "set",
    value: "DENY",
  },
  {
    name: "X-Content-Type-Options",
    operation: "set",
    value: "nosniff",
  },
  {
    name: "Referrer-Policy",
    operation: "set",
    value: "strict-origin-when-cross-origin",
  },
  {
    name: "Strict-Transport-Security",
    operation: "set",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

const rule = {
  ref: RULE_REF,
  description: RULE_DESCRIPTION,
  expression: `http.host eq "${HOSTNAME}"`,
  action: "rewrite",
  action_parameters: {
    headers: managedHeaders,
  },
  enabled: true,
};

async function cloudflareRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
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

async function readEntrypointRuleset() {
  try {
    return await cloudflareRequest(`/zones/${CLOUDFLARE_ZONE_ID}/rulesets/phases/${PHASE}/entrypoint`);
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
    return {
      ...existingRule,
      ...rule,
      id: existingRule.id,
    };
  });

  if (!replaced) rules.push(rule);
  return { rules, replaced };
}

async function applySecurityHeaders() {
  const existingRuleset = await readEntrypointRuleset();
  const { rules, replaced } = upsertManagedRule(existingRuleset?.rules ?? []);

  const result = await cloudflareRequest(`/zones/${CLOUDFLARE_ZONE_ID}/rulesets/phases/${PHASE}/entrypoint`, {
    method: "PUT",
    body: JSON.stringify({
      name: existingRuleset?.name ?? "default",
      description:
        existingRuleset?.description ??
        "Zone-level HTTP response header transform rules managed by automation.",
      kind: "zone",
      phase: PHASE,
      rules,
    }),
  });

  console.log(
    `${replaced ? "Updated" : "Created"} Cloudflare response header transform rule "${RULE_DESCRIPTION}".`,
  );
  console.log(`Ruleset ID: ${result.id}`);
  console.log(`Target expression: ${rule.expression}`);
  console.log(`Managed headers: ${managedHeaders.map((header) => header.name).join(", ")}`);
}

applySecurityHeaders().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
