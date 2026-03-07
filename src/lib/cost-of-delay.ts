/**
 * Dynamic Cost of Delay computation engine.
 * Produces structured, data-driven delay cost assessments — never hardcoded labels.
 * All parameters are configurable via system-config.ts.
 */

import { getSystemConfig } from "./system-config";

export interface CostOfDelayInput {
  severity: "critical" | "high" | "medium" | "low";
  confidence: number | null;         // 0-100
  cappedConfidence?: number | null;
  signalDelta?: number | null;       // magnitude of anomaly / deviation (%)
  affectedMetricType?: string | null;
  predictedNetImpact?: number | null; // currency
  affectedEntityCount?: number | null;
  trendAccelerating?: boolean;
  revenue?: number;                  // total org revenue for exposure calc
  ageDays?: number;                  // how old the signal is
  expectedImpact?: string | null;    // text from advisory
}

export interface CostOfDelayResult {
  score: number;                    // 0-100 normalised
  label: "low" | "medium" | "high" | "critical";
  estimatedDelayCost: string;       // formatted currency or relative score
  recommendedActionWindowDays: number;
  reason: string;
}

function metricUrgencyMultiplier(metricType: string | null | undefined): number {
  if (!metricType) return 1;
  const cfg = getSystemConfig().costOfDelay.metricUrgency;
  const key = Object.keys(cfg).find(k => metricType.toLowerCase().includes(k));
  return key ? cfg[key] : 1;
}

export function computeCostOfDelay(input: CostOfDelayInput): CostOfDelayResult {
  const cfg = getSystemConfig().costOfDelay;
  const conf = input.confidence ?? input.cappedConfidence ?? 50;
  const ageDays = input.ageDays ?? 0;

  // --- Score components ---
  let score = 0;

  // 1. Severity base
  score += cfg.severityWeights[input.severity] ?? cfg.severityWeights.medium;

  // 2. Confidence contribution — higher confidence = more certain downside
  score += (conf / 100) * cfg.confidenceContributionMax;

  // 3. Age decay pressure — older unresolved signals get more urgent
  const ageScore = Math.min(cfg.ageDecayMax, ageDays * cfg.ageDecayRate);
  score += ageScore;

  // 4. Signal magnitude
  if (input.signalDelta != null) {
    score += Math.min(cfg.signalDeltaMax, Math.abs(input.signalDelta) * cfg.signalDeltaMultiplier);
  }

  // 5. Entity count breadth
  if (input.affectedEntityCount != null && input.affectedEntityCount > 1) {
    score += Math.min(cfg.entityCountMax, Math.log2(input.affectedEntityCount) * cfg.entityCountMultiplier);
  }

  // 6. Trend acceleration bonus
  if (input.trendAccelerating) {
    score += cfg.trendAccelerationBonus;
  }

  // Apply metric urgency multiplier
  score *= metricUrgencyMultiplier(input.affectedMetricType);

  // Clamp to 0-100
  score = Math.min(100, Math.max(0, Math.round(score)));

  // --- Label ---
  const label: CostOfDelayResult["label"] =
    score >= cfg.labelThresholds.critical ? "critical" :
    score >= cfg.labelThresholds.high ? "high" :
    score >= cfg.labelThresholds.medium ? "medium" : "low";

  // --- Action window ---
  const recommendedActionWindowDays =
    label === "critical" ? Math.max(1, cfg.actionWindows.critical - Math.floor(ageDays / 7)) :
    label === "high" ? Math.max(3, cfg.actionWindows.high - Math.floor(ageDays / 5)) :
    label === "medium" ? Math.max(7, cfg.actionWindows.medium - Math.floor(ageDays / 3)) :
    cfg.actionWindows.low;

  // --- Estimated cost ---
  let estimatedDelayCost: string;
  if (input.predictedNetImpact != null && input.predictedNetImpact !== 0) {
    const weeklyImpact = Math.abs(input.predictedNetImpact) / 4;
    estimatedDelayCost = formatCurrency(weeklyImpact) + "/week";
  } else {
    estimatedDelayCost = `Relative score: ${score}/100`;
  }

  // --- Reason ---
  const reasonParts: string[] = [];
  if (conf >= 70) reasonParts.push(`${conf}% confidence signal`);
  else if (conf >= 40) reasonParts.push(`${conf}% confidence — moderate certainty`);
  else reasonParts.push(`${conf}% confidence — low certainty, but risk compounds`);

  if (input.trendAccelerating) reasonParts.push("accelerating trend detected");
  if (ageDays > 7) reasonParts.push(`unaddressed for ${ageDays}d`);
  if (input.affectedEntityCount && input.affectedEntityCount > 5) {
    reasonParts.push(`${input.affectedEntityCount} entities affected`);
  }
  if (input.affectedMetricType) {
    reasonParts.push(`${input.affectedMetricType} exposure`);
  }

  const reason = reasonParts.join(" · ");

  return { score, label, estimatedDelayCost, recommendedActionWindowDays, reason };
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `€${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `€${(val / 1_000).toFixed(1)}K`;
  return `€${Math.round(val)}`;
}
