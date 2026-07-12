// Shared helpers for the GA-2R real-Supabase validation harness.
//
// IMPORTANT: this harness talks to a REAL Supabase project. It must never
// be pointed at production customer data — use a disposable branch or an
// isolated staging project. Nothing here substitutes mocks or the
// fake-runtime-postgres test double for the acceptance criteria in
// tests/ga2-durable-*.test.ts; this is the real thing or nothing.
import { createClient } from "@supabase/supabase-js";

export const RUN_ID = `ga2r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function loadEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const dbUrl = process.env.SUPABASE_DB_URL;

  const missing = [];
  if (!url) missing.push("SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  return {
    url,
    serviceRoleKey,
    anonKey,
    dbUrl,
    blocked: missing.length > 0,
    missing,
  };
}

/** Never print a raw URL or key — only a masked project ref. */
export function maskUrl(url) {
  if (!url) return "<none>";
  const match = url.match(/^https:\/\/([a-z0-9]{4})[a-z0-9]*\.supabase\.co/i);
  if (!match) return "<masked>";
  return `https://${match[1]}***.supabase.co`;
}

export function requireEnvOrBlock(scriptName) {
  const env = loadEnv();
  if (env.blocked) {
    console.log(`\n[${scriptName}] BLOCKED — missing required environment: ${env.missing.join(", ")}`);
    console.log(
      `[${scriptName}] This phase requires a real Supabase environment (see GA-2R task rules: ` +
        `"Do not substitute mocks or the fake runtime client.").`,
    );
    return { env, blocked: true };
  }
  console.log(`[${scriptName}] Using Supabase project ${maskUrl(env.url)} (service role).`);
  return { env, blocked: false };
}

export function createServiceClient(env) {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAnonClient(env) {
  if (!env.anonKey) return null;
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function genId(prefix) {
  return `${prefix}-${RUN_ID}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function addMs(iso, ms) {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export class PhaseReport {
  constructor(name) {
    this.name = name;
    this.checks = [];
    this.status = "PASS";
  }

  check(label, passed, detail) {
    this.checks.push({ label, passed: Boolean(passed), detail: detail ?? null });
    if (!passed) this.status = "FAIL";
    console.log(`  [${passed ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
    return passed;
  }

  block(reason) {
    this.status = "BLOCKED";
    this.blockedReason = reason;
    console.log(`  [BLOCKED] ${reason}`);
  }

  summary() {
    return { name: this.name, status: this.status, checks: this.checks, blockedReason: this.blockedReason ?? null };
  }
}

export function printReport(report) {
  console.log(`\n=== ${report.name}: ${report.status} ===`);
  return report;
}

/** Runs a phase's run() when the file is executed directly, catching any
 *  unhandled error so a real infra hiccup produces a clean FAIL report
 *  instead of an uncaught-exception crash. */
export function runStandalone(runFn) {
  runFn()
    .then((report) => process.exit(report.status === "PASS" ? 0 : 1))
    .catch((error) => {
      console.error(`\n[FATAL] ${error instanceof Error ? error.stack : String(error)}`);
      process.exit(1);
    });
}
