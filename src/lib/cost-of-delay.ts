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
  currency?: string;                 // org currency symbol, defaults to €
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
  const lower = metricType.toLowerCase();

  // Use the FIRST match only — prevent order-dependent stacking
  let bestMultiplier = 1;
  let bestLength = 0;
  for (const [key, value] of Object.entries(cfg)) {
    if (lower.includes(key) && key.length > bestLength) {
      bestMultiplier = value;
      bestLength = key.length;
    }
  }
  return bestMultiplier;
}

/**
 * Parse expectedImpact text for severity hints.
 * Returns a bonus score (0-10) based on keyword analysis.
 */
function parseExpectedImpactBonus(expectedImpact: string | null | undefined): number {
  if (!expectedImpact) return 0;
  const lower = expectedImpact.toLowerCase();
  let bonus = 0;

  // High-impact keywords (universal)
  if (lower.includes("severe") || lower.includes("critical") || lower.includes("catastroph") || lower.includes("life-threatening") || lower.includes("fatality")) bonus += 8;
  else if (lower.includes("significant") || lower.includes("major") || lower.includes("substantial") || lower.includes("systemic")) bonus += 5;
  else if (lower.includes("moderate") || lower.includes("notable") || lower.includes("elevated")) bonus += 3;
  else if (lower.includes("minor") || lower.includes("low") || lower.includes("negligible")) bonus += 1;

  // Financial / business keywords
  if (lower.includes("revenue") || lower.includes("margin") || lower.includes("profit") || lower.includes("liability") || lower.includes("penalty") || lower.includes("fine")) bonus += 2;
  // Acceleration / compounding keywords
  if (lower.includes("compounding") || lower.includes("accelerat") || lower.includes("exponential") || lower.includes("cascading") || lower.includes("contagion")) bonus += 2;
  // Safety / regulatory keywords
  if (lower.includes("safety") || lower.includes("contamination") || lower.includes("hazard") || lower.includes("regulatory") || lower.includes("compliance breach")) bonus += 2;
  // Operational disruption keywords
  if (lower.includes("outage") || lower.includes("shutdown") || lower.includes("downtime") || lower.includes("disruption") || lower.includes("stoppage")) bonus += 2;

  return Math.min(14, bonus);
}

export function computeCostOfDelay(input: CostOfDelayInput): CostOfDelayResult {
  const cfg = getSystemConfig().costOfDelay;
  // #6 FIX: Prefer capped (governance-adjusted) over raw confidence
  const conf = input.cappedConfidence ?? input.confidence ?? 50;
  const ageDays = input.ageDays ?? 0;
  const currencySymbol = input.currency || "€";

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

  // 7. #2 FIX: expectedImpact text contribution
  score += parseExpectedImpactBonus(input.expectedImpact);

  // Apply metric urgency multiplier (#4 FIX: longest-match, no stacking)
  score *= metricUrgencyMultiplier(input.affectedMetricType);

  // Clamp to 0-100
  score = Math.min(100, Math.max(0, Math.round(score)));

  // --- Label ---
  const label: CostOfDelayResult["label"] =
    score >= cfg.labelThresholds.critical ? "critical" :
    score >= cfg.labelThresholds.high ? "high" :
    score >= cfg.labelThresholds.medium ? "medium" : "low";

  // --- Action window --- (#3 FIX: continuous decay with per-tier floors)
  const actionWindowFloors = { critical: 1, high: 2, medium: 5, low: cfg.actionWindows.low };
  const actionWindowDecayRates = { critical: 7, high: 5, medium: 4, low: 1 };

  const baseWindow = cfg.actionWindows[label] ?? cfg.actionWindows.low;
  const floor = actionWindowFloors[label];
  const decayRate = actionWindowDecayRates[label];
  const recommendedActionWindowDays = Math.max(floor, baseWindow - Math.floor(ageDays / decayRate));

  // --- Estimated cost --- (#1 FIX: use revenue for exposure estimate)
  let estimatedDelayCost: string;
  if (input.predictedNetImpact != null && input.predictedNetImpact !== 0) {
    // Validated financial basis — show weekly monetary cost
    const weeklyImpact = Math.abs(input.predictedNetImpact) / 4;
    estimatedDelayCost = formatCurrency(weeklyImpact, currencySymbol) + "/week";
  } else if (input.revenue && input.revenue > 0 && score >= cfg.labelThresholds.medium) {
    // Revenue-derived exposure estimate — only for medium+ severity
    // Tiered base exposure rates by domain (highest-risk categories first)
    const metricLower = (input.affectedMetricType ?? "").toLowerCase();
    const baseRate =
      // Tier 1 — 10%: life-safety, regulatory, fraud (existential risk)
      (metricLower.includes("safety") || metricLower.includes("patient") || metricLower.includes("mortality") ||
       metricLower.includes("compliance") || metricLower.includes("regulatory") || metricLower.includes("fraud"))
        ? 0.10
      // Tier 2 — 8%: operational disruption (high direct cost)
      : (metricLower.includes("downtime") || metricLower.includes("outage") || metricLower.includes("throughput") ||
         metricLower.includes("supply chain") || metricLower.includes("churn") || metricLower.includes("retention") ||
         metricLower.includes("liquidity") || metricLower.includes("defect"))
        ? 0.08
      // Tier 3 — 7%: financial performance metrics
      : (metricLower.includes("revenue") || metricLower.includes("margin") || metricLower.includes("credit") ||
         metricLower.includes("exposure") || metricLower.includes("energy") || metricLower.includes("emission"))
        ? 0.07
      // Tier 4 — 6%: operational efficiency
      : (metricLower.includes("yield") || metricLower.includes("inventory") || metricLower.includes("occupancy") ||
         metricLower.includes("enrollment") || metricLower.includes("attrition") || metricLower.includes("vacancy"))
        ? 0.06
      // Default — 5%
      : 0.05;
    const weeklyExposure = (input.revenue * baseRate * (score / 100)) / 52;
    estimatedDelayCost = `~${formatCurrency(weeklyExposure, currencySymbol)}/week exposure`;
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
  if (input.expectedImpact) {
    // Surface a truncated advisory impact note
    const impactSnippet = input.expectedImpact.slice(0, 60);
    reasonParts.push(`advisory: "${impactSnippet}${input.expectedImpact.length > 60 ? "…" : ""}"`);
  }

  const reason = reasonParts.join(" · ");

  return { score, label, estimatedDelayCost, recommendedActionWindowDays, reason };
}

function formatCurrency(val: number, symbol: string = "€"): string {
  if (val >= 1_000_000) return `${symbol}${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${symbol}${(val / 1_000).toFixed(1)}K`;
  return `${symbol}${Math.round(val)}`;
}
