#!/usr/bin/env node
// tests/evidence/eval-gate.mjs
// The Quantivis Enterprise Certification Engine.
//
// Consumes evidence artifacts from audit-artifacts/<YYYY-MM-DD>/ and produces
// one authoritative certification decision for a release:
//
//   audit-artifacts/<YYYY-MM-DD>/CERTIFICATION.json
//   audit-artifacts/<YYYY-MM-DD>/CERTIFICATION.md
//   audit-artifacts/<YYYY-MM-DD>/EXECUTIVE_SUMMARY.md
//   audit-artifacts/history.json   (appended)
//
// This module is pure orchestration; the decision math lives in
// tests/evidence/lib/certification.mjs.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateDay } from "./lib/certification.mjs";
import {
  renderCertificationReport,
  renderExecutiveSummary,
} from "./lib/report.mjs";

const ALLOWED_ENVIRONMENTS = new Set(["staging", "preview"]);

function argOrEnv(flag, envName, fallback) {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (idx !== -1) {
    const v = argv[idx].includes("=")
      ? argv[idx].split("=").slice(1).join("=")
      : argv[idx + 1];
    if (v) return v;
  }
  return process.env[envName] ?? fallback;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function getCertification({
  day = today(),
  root = "audit-artifacts",
  release = null,
  commit = process.env.EVIDENCE_COMMIT ?? null,
  environment = process.env.EVIDENCE_ENV ?? null,
} = {}) {
  const dayRoot = resolve(root, day);
  if (!existsSync(dayRoot)) {
    return {
      release,
      commit,
      environment,
      timestamp: new Date().toISOString(),
      overall_status: "CRITICAL_BLOCK",
      recommendation: "CRITICAL_BLOCK",
      score: 0,
      score_breakdown: [],
      pipelines_passed: 0,
      pipelines_failed: 0,
      warnings_total: 0,
      critical_issues: 1,
      pipeline_results: [],
      blocking_items: [
        {
          gate: "framework",
          pipeline: "runner",
          status: "FRAMEWORK_INVALID",
          reason: `no evidence directory at ${dayRoot}`,
        },
      ],
      warnings: [],
    };
  }
  if (environment && !ALLOWED_ENVIRONMENTS.has(environment)) {
    return {
      release,
      commit,
      environment,
      timestamp: new Date().toISOString(),
      overall_status: "CRITICAL_BLOCK",
      recommendation: "CRITICAL_BLOCK",
      score: 0,
      score_breakdown: [],
      pipelines_passed: 0,
      pipelines_failed: 0,
      warnings_total: 0,
      critical_issues: 1,
      pipeline_results: [],
      blocking_items: [
        {
          gate: "framework",
          pipeline: "guard",
          status: "SECURITY_FAILURE",
          reason: `environment "${environment}" not on allow-list`,
        },
      ],
      warnings: [],
    };
  }
  return evaluateDay(dayRoot, { release, commit, environment });
}

function appendHistory(historyPath, cert) {
  let history = [];
  if (existsSync(historyPath)) {
    try {
      history = JSON.parse(readFileSync(historyPath, "utf8"));
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }
  }
  history.push({
    date: cert.timestamp,
    commit: cert.commit,
    environment: cert.environment,
    overall_status: cert.overall_status,
    score: cert.score,
    blocked_gates: cert.pipeline_results
      .filter((g) => g.blocking)
      .map((g) => g.gate),
    warnings: cert.warnings_total,
    duration_ms: cert.duration_ms,
  });
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

async function main() {
  const day = argOrEnv("--day", "EVIDENCE_DAY", today());
  const root = argOrEnv("--root", "EVIDENCE_ROOT", "audit-artifacts");
  const release = argOrEnv("--release", "EVIDENCE_RELEASE", null);
  const commit = argOrEnv("--commit", "EVIDENCE_COMMIT", null);
  const environment = argOrEnv("--environment", "EVIDENCE_ENV", null);

  const cert = getCertification({ day, root, release, commit, environment });

  const dayRoot = resolve(root, day);
  mkdirSync(dayRoot, { recursive: true });

  const jsonPath = join(dayRoot, "CERTIFICATION.json");
  const mdPath = join(dayRoot, "CERTIFICATION.md");
  const execPath = join(dayRoot, "EXECUTIVE_SUMMARY.md");
  const historyPath = join(root, "history.json");

  writeFileSync(jsonPath, JSON.stringify(cert, null, 2));
  writeFileSync(mdPath, renderCertificationReport(cert));
  writeFileSync(execPath, renderExecutiveSummary(cert));
  mkdirSync(root, { recursive: true });
  appendHistory(historyPath, cert);

  const line = `[cert] ${cert.overall_status.padEnd(20)} score=${cert.score} blocking=${cert.blocking_items.length} warnings=${cert.warnings_total}`;
  console.log(line);
  console.log(`  -> ${jsonPath}`);
  console.log(`  -> ${mdPath}`);
  console.log(`  -> ${execPath}`);
  console.log(`  -> ${historyPath}`);

  // Exit code semantics: 0 for PASS / PASS_WITH_WARNINGS, non-zero otherwise.
  const shipping = cert.overall_status === "PASS" || cert.overall_status === "PASS_WITH_WARNINGS";
  process.exit(shipping ? 0 : 1);
}

// Only run as CLI when executed directly.
const isCli =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((err) => {
    console.error("[cert] FATAL", err);
    process.exit(2);
  });
}
