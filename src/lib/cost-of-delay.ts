/**
 * Dynamic Cost of Delay computation engine.
 * Produces structured, data-driven delay cost assessments — never hardcoded labels.
 */

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

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 40,
  high: 28,
  medium: 16,
  low: 6,
};

const METRIC_URGENCY: Record<string, number> = {
  churn: 1.3,
  retention: 1.3,
  revenue: 1.2,
  cost: 1.1,
  margin: 1.15,
  growth: 1.05,
};

function metricUrgencyMultiplier(metricType: string | null | undefined): number {
  if (!metricType) return 1;
  const key = Object.keys(METRIC_URGENCY).find(k => metricType.toLowerCase().includes(k));
  return key ? METRIC_URGENCY[key] : 1;
}

export function computeCostOfDelay(input: CostOfDelayInput): CostOfDelayResult {
  const conf = input.confidence ?? input.cappedConfidence ?? 50;
  const ageDays = input.ageDays ?? 0;

  // --- Score components ---
  let score = 0;

  // 1. Severity base (0-40)
  score += SEVERITY_WEIGHT[input.severity] ?? 16;

  // 2. Confidence contribution (0-20) — higher confidence = more certain downside
  score += (conf / 100) * 20;

  // 3. Age decay pressure (0-20) — older unresolved signals get more urgent
  const ageScore = Math.min(20, ageDays * 0.7);
  score += ageScore;

  // 4. Signal magnitude (0-10)
  if (input.signalDelta != null) {
    score += Math.min(10, Math.abs(input.signalDelta) * 0.5);
  }

  // 5. Entity count breadth (0-5)
  if (input.affectedEntityCount != null && input.affectedEntityCount > 1) {
    score += Math.min(5, Math.log2(input.affectedEntityCount) * 1.5);
  }

  // 6. Trend acceleration bonus (0-5)
  if (input.trendAccelerating) {
    score += 5;
  }

  // Apply metric urgency multiplier
  score *= metricUrgencyMultiplier(input.affectedMetricType);

  // Clamp to 0-100
  score = Math.min(100, Math.max(0, Math.round(score)));

  // --- Label ---
  const label: CostOfDelayResult["label"] =
    score >= 80 ? "critical" :
    score >= 55 ? "high" :
    score >= 30 ? "medium" : "low";

  // --- Action window ---
  const recommendedActionWindowDays =
    label === "critical" ? Math.max(1, 3 - Math.floor(ageDays / 7)) :
    label === "high" ? Math.max(3, 7 - Math.floor(ageDays / 5)) :
    label === "medium" ? Math.max(7, 14 - Math.floor(ageDays / 3)) :
    21;

  // --- Estimated cost ---
  let estimatedDelayCost: string;
  if (input.predictedNetImpact != null && input.predictedNetImpact !== 0) {
    const weeklyImpact = Math.abs(input.predictedNetImpact) / 4;
    estimatedDelayCost = formatCurrency(weeklyImpact) + "/week";
  } else if (input.revenue && input.revenue > 0) {
    const basePct = input.severity === "critical" ? 8 : input.severity === "high" ? 5 : 3;
    const adjPct = basePct * (conf / 100) * metricUrgencyMultiplier(input.affectedMetricType);
    const weeklyExposure = (input.revenue * adjPct) / (100 * 4);
    estimatedDelayCost = formatCurrency(weeklyExposure) + "/week";
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
