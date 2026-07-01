// tests/evidence/lib/certification.mjs
// Pure evaluator: reads evidence artifacts from a day directory, applies the
// gate rules from gates.mjs and the taxonomy from taxonomy.mjs, and returns
// the certification decision. No I/O side effects other than reading files.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { STATUS, isBlocking } from "./taxonomy.mjs";
import { GATES, TOTAL_WEIGHT } from "./gates.mjs";

// ---------- helpers ----------

function readEvidenceForDay(dayRoot) {
  const results = new Map(); // pipeline -> evidence record
  if (!existsSync(dayRoot)) return results;
  for (const entry of readdirSync(dayRoot)) {
    const dir = join(dayRoot, entry);
    if (!statSync(dir).isDirectory()) continue;
    const file = join(dir, "evidence.json");
    if (!existsSync(file)) continue;
    try {
      const rec = JSON.parse(readFileSync(file, "utf8"));
      results.set(rec.pipeline ?? entry, rec);
    } catch (err) {
      results.set(entry, {
        pipeline: entry,
        status: STATUS.FRAMEWORK_INVALID,
        failures: [{ reason: "unparseable evidence.json", detail: String(err) }],
        warnings: [],
        positive_controls: [],
        negative_controls: [],
        evidence_files: [],
      });
    }
  }
  return results;
}

function classifyPipeline(rec) {
  if (!rec) {
    return {
      status: STATUS.FRAMEWORK_INVALID,
      blocking: true,
      reason: "evidence artifact missing",
    };
  }
  if (isBlocking(rec.status)) {
    return {
      status: rec.status,
      blocking: true,
      reason: rec.failures?.[0]?.reason ?? `${rec.status}`,
    };
  }
  // A vacuous PASS with zero controls counts as invalid.
  const hasControls =
    (rec.positive_controls?.length ?? 0) +
      (rec.negative_controls?.length ?? 0) >
    0;
  if (rec.status === STATUS.PASS && !hasControls) {
    return {
      status: STATUS.FRAMEWORK_INVALID,
      blocking: true,
      reason: "PASS reported with zero controls",
    };
  }
  return { status: rec.status, blocking: false, reason: null };
}

function classifyGate(gate, evidenceByPipeline) {
  const pipelineResults = gate.pipelines.map((name) => {
    const rec = evidenceByPipeline.get(name);
    const c = classifyPipeline(rec);
    return {
      pipeline: name,
      status: c.status,
      blocking: c.blocking,
      reason: c.reason,
      evidence: rec
        ? {
            evidence_files: rec.evidence_files ?? [],
            positive_controls: rec.positive_controls?.length ?? 0,
            negative_controls: rec.negative_controls?.length ?? 0,
            warnings: rec.warnings?.length ?? 0,
          }
        : null,
    };
  });

  const anyBlocking = pipelineResults.some((p) => p.blocking);
  const anyWarning = pipelineResults.some(
    (p) => p.status === STATUS.WARNING || (p.evidence?.warnings ?? 0) > 0,
  );
  const allPassOrExpectedDenial = pipelineResults.every(
    (p) => p.status === STATUS.PASS || p.status === STATUS.EXPECTED_DENIAL,
  );

  let gateStatus;
  if (anyBlocking) gateStatus = "BLOCKED";
  else if (allPassOrExpectedDenial && !anyWarning) gateStatus = "PASS";
  else if (allPassOrExpectedDenial && anyWarning) gateStatus = "PASS_WITH_WARNINGS";
  else gateStatus = "BLOCKED";

  const blockingItems = pipelineResults
    .filter((p) => p.blocking)
    .map((p) => ({ pipeline: p.pipeline, status: p.status, reason: p.reason }));

  return {
    gate: gate.key,
    label: gate.label,
    weight: gate.weight,
    status: gateStatus,
    blocking: anyBlocking,
    reason: anyBlocking
      ? blockingItems.map((b) => `${b.pipeline}:${b.status}`).join(", ")
      : anyWarning
        ? "warnings present"
        : "all controls satisfied",
    evidence: pipelineResults,
  };
}

function computeScore(gateResults) {
  // Weighted average: each gate contributes 0 or its full weight (PASS or
  // PASS_WITH_WARNINGS with half weight for warnings), and BLOCKED = 0.
  let earned = 0;
  const breakdown = [];
  for (const g of gateResults) {
    let factor = 0;
    if (g.status === "PASS") factor = 1;
    else if (g.status === "PASS_WITH_WARNINGS") factor = 0.5;
    const contribution = g.weight * factor;
    earned += contribution;
    breakdown.push({
      gate: g.gate,
      weight: g.weight,
      factor,
      contribution,
      status: g.status,
    });
  }
  const score = TOTAL_WEIGHT === 0 ? 0 : Math.round((earned / TOTAL_WEIGHT) * 100);
  return { score, earned, total: TOTAL_WEIGHT, breakdown };
}

function overallDecision(gateResults) {
  const blocked = gateResults.filter((g) => g.blocking);
  const critical = blocked.filter((g) =>
    g.evidence.some(
      (p) =>
        p.status === STATUS.CRITICAL_LEAK ||
        p.status === STATUS.CRITICAL_FAILURE ||
        p.status === STATUS.SECURITY_FAILURE,
    ),
  );
  const warned = gateResults.filter((g) => g.status === "PASS_WITH_WARNINGS");

  if (critical.length > 0) return "CRITICAL_BLOCK";
  if (blocked.length > 1) return "BLOCKED";
  if (blocked.length === 1) return "CONDITIONAL_RELEASE";
  if (warned.length > 0) return "PASS_WITH_WARNINGS";
  return "PASS";
}

// ---------- public API ----------

export function evaluateDay(dayRoot, meta = {}) {
  const start = Date.now();
  const evidence = readEvidenceForDay(dayRoot);
  const gateResults = GATES.map((g) => classifyGate(g, evidence));
  const scoring = computeScore(gateResults);
  const overall = overallDecision(gateResults);

  const passed = gateResults.filter((g) => g.status.startsWith("PASS")).length;
  const failed = gateResults.filter((g) => g.status === "BLOCKED").length;
  const warnings = gateResults.reduce(
    (n, g) => n + g.evidence.reduce((m, p) => m + (p.evidence?.warnings ?? 0), 0),
    0,
  );

  const blockingItems = [];
  for (const g of gateResults) {
    for (const p of g.evidence) {
      if (p.blocking) {
        blockingItems.push({
          gate: g.gate,
          pipeline: p.pipeline,
          status: p.status,
          reason: p.reason,
        });
      }
    }
  }

  const warningItems = [];
  for (const g of gateResults) {
    for (const p of g.evidence) {
      const w = p.evidence?.warnings ?? 0;
      if (w > 0 || p.status === STATUS.WARNING) {
        warningItems.push({ gate: g.gate, pipeline: p.pipeline, warnings: w });
      }
    }
  }

  return {
    release: meta.release ?? null,
    commit: meta.commit ?? process.env.EVIDENCE_COMMIT ?? null,
    environment: meta.environment ?? process.env.EVIDENCE_ENV ?? null,
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    overall_status: overall,
    recommendation: overall,
    score: scoring.score,
    score_breakdown: scoring.breakdown,
    pipelines_passed: passed,
    pipelines_failed: failed,
    warnings_total: warnings,
    critical_issues: blockingItems.filter(
      (b) =>
        b.status === STATUS.CRITICAL_LEAK ||
        b.status === STATUS.CRITICAL_FAILURE ||
        b.status === STATUS.SECURITY_FAILURE,
    ).length,
    pipeline_results: gateResults,
    blocking_items: blockingItems,
    warnings: warningItems,
  };
}
