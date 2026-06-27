import { fileURLToPath } from "node:url";
import { contentSecurityPolicy, permissionsPolicy } from "./apply-cloudflare-security.mjs";

const API_BASE = "https://api.cloudflare.com/client/v4";
const HOSTNAME = "www.quantivis.io";
const WORKER_NAME = "quantivis-enterprise-security-headers";
const WORKER_ROUTE_PATTERN = `${HOSTNAME}/*`;

export const workerSecurityHeaders = {
  "Content-Security-Policy": contentSecurityPolicy,
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": permissionsPolicy,
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

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
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": options.contentType ?? "application/json" }
        : {}),
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

export function buildSecurityWorkerScript(headers = workerSecurityHeaders) {
  return `const SECURITY_HEADERS = ${JSON.stringify(headers, null, 2)};

addEventListener("fetch", (event) => {
  event.respondWith(addSecurityHeaders(event.request));
});

async function addSecurityHeaders(request) {
  const response = await fetch(request);
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
`;
}

async function readZone(env) {
  return await cloudflareRequest(`/zones/${env.CLOUDFLARE_ZONE_ID}`, {}, env);
}

async function putWorkerScript(env, accountId) {
  return await cloudflareRequest(
    `/accounts/${accountId}/workers/scripts/${WORKER_NAME}`,
    {
      method: "PUT",
      contentType: "application/javascript",
      body: buildSecurityWorkerScript(),
    },
    env,
  );
}

async function listWorkerRoutes(env) {
  return await cloudflareRequest(`/zones/${env.CLOUDFLARE_ZONE_ID}/workers/routes?per_page=100`, {}, env);
}

async function upsertWorkerRoute(env) {
  const routes = await listWorkerRoutes(env);
  const existingRoute = routes.find((route) => route.pattern === WORKER_ROUTE_PATTERN) ?? null;
  const body = JSON.stringify({
    pattern: WORKER_ROUTE_PATTERN,
    script: WORKER_NAME,
  });

  if (existingRoute) {
    return await cloudflareRequest(
      `/zones/${env.CLOUDFLARE_ZONE_ID}/workers/routes/${existingRoute.id}`,
      { method: "PUT", body },
      env,
    );
  }

  return await cloudflareRequest(
    `/zones/${env.CLOUDFLARE_ZONE_ID}/workers/routes`,
    { method: "POST", body },
    env,
  );
}

export async function applyEnterpriseSecurityWorker(env = readCloudflareEnvironment()) {
  const zone = await readZone(env);
  const accountId = zone.account?.id;

  if (!accountId) {
    throw new Error("Cloudflare zone account ID was not available.");
  }

  await putWorkerScript(env, accountId);
  const route = await upsertWorkerRoute(env);

  console.log(`Applied Cloudflare Worker fallback "${WORKER_NAME}".`);
  console.log(`Worker route: ${route.pattern ?? WORKER_ROUTE_PATTERN}`);
  console.log(`Worker script: ${route.script ?? WORKER_NAME}`);
  console.log(`Managed headers: ${Object.keys(workerSecurityHeaders).join(", ")}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  applyEnterpriseSecurityWorker().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
