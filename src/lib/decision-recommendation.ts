/**
 * Contextual AI recommendation generator.
 * Produces structured, signal-specific recommendations — never generic templates.
 */

export interface RecommendationInput {
  signalType: "signal" | "advisory" | "pending_outcome" | "proactive";
  metricType?: string | null;
  trendDirection?: "up" | "down" | "stable" | null;
  severity: string;
  confidence: number | null;
  diagnosticFindings?: string | null;
  causalFactors?: string | null;
  affectedSegment?: string | null;
  message?: string | null;
  priorAdvisoryAction?: string | null;
  category?: string | null;
}

export interface StructuredRecommendation {
  whatHappened: string;
  whyItMatters: string;
  recommendedAction: string;
  suggestedOwner: string;
  suggestedDeadlineDays: number;
  successMetrics: string[];
}

const OWNER_MAP: Record<string, string> = {
  revenue: "VP Revenue / CRO",
  churn: "VP Customer Success",
  retention: "VP Customer Success",
  cost: "VP Finance / CFO",
  margin: "CFO / VP Finance",
  growth: "VP Growth / CGO",
  operational: "COO / VP Operations",
  financial: "CFO / VP Finance",
  strategic: "CEO / Strategy Lead",
};

function inferOwner(category: string | null | undefined, metricType: string | null | undefined): string {
  const key = [category, metricType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const [k, v] of Object.entries(OWNER_MAP)) {
    if (key.includes(k)) return v;
  }
  return "Decision Owner (assign)";
}

function inferDeadlineDays(severity: string, confidence: number | null): number {
  const conf = confidence ?? 50;
  if (severity === "critical") return conf > 70 ? 3 : 5;
  if (severity === "high") return conf > 70 ? 7 : 10;
  return conf > 70 ? 14 : 21;
}

function inferSuccessMetrics(category: string | null | undefined, metricType: string | null | undefined): string[] {
  const key = [category, metricType].filter(Boolean).join(" ").toLowerCase();
  const metrics: string[] = [];

  if (key.includes("churn") || key.includes("retention")) {
    metrics.push("Monthly churn rate (% change)", "At-risk cohort size reduction", "NPS / CSAT delta");
  } else if (key.includes("revenue")) {
    metrics.push("MRR / ARR recovery trajectory", "Revenue variance vs. plan", "Pipeline conversion rate");
  } else if (key.includes("cost")) {
    metrics.push("Cost per unit reduction", "Burn rate change", "Gross margin improvement");
  } else if (key.includes("margin")) {
    metrics.push("Gross margin %", "Contribution margin delta", "EBITDA trajectory");
  } else if (key.includes("growth")) {
    metrics.push("Growth rate (MoM)", "New customer acquisition rate", "Expansion revenue %");
  } else {
    metrics.push("KPI trend direction", "Variance from baseline", "Time to resolution");
  }
  return metrics;
}

export function generateRecommendation(input: RecommendationInput): StructuredRecommendation {
  const cat = input.category?.toLowerCase() ?? "";
  const met = input.metricType?.toLowerCase() ?? "";
  const msg = input.message ?? "";
  const conf = input.confidence ?? 50;
  const trend = input.trendDirection ?? "down";
  const segment = input.affectedSegment ?? "primary segment";

  // --- What happened ---
  let whatHappened: string;
  if (input.signalType === "advisory" && input.priorAdvisoryAction) {
    whatHappened = input.priorAdvisoryAction;
  } else if (msg.length > 20) {
    whatHappened = msg.slice(0, 200);
  } else if (cat.includes("churn") || met.includes("churn")) {
    whatHappened = `Churn rate anomaly detected with ${trend === "up" ? "upward" : "sustained"} trajectory in ${segment}`;
  } else if (cat.includes("revenue") || met.includes("revenue")) {
    whatHappened = `Revenue signal detected: ${trend === "down" ? "below-plan performance" : "variance from forecast"} impacting ${segment}`;
  } else if (cat.includes("cost") || met.includes("cost")) {
    whatHappened = `Cost structure deviation identified: ${trend === "up" ? "unexpected increase" : "efficiency anomaly"} in ${segment}`;
  } else {
    whatHappened = `${input.severity === "critical" ? "Critical" : "Notable"} operational signal detected in ${cat || met || "monitored metrics"}`;
  }

  // --- Why it matters ---
  const confLabel = conf >= 70 ? "high confidence" : conf >= 40 ? "moderate confidence" : "early-stage signal";
  const whyParts: string[] = [];
  whyParts.push(`Detected at ${confLabel} (${conf}%)`);
  if (input.severity === "critical" || input.severity === "high") {
    whyParts.push("severity indicates material business impact");
  }
  if (input.diagnosticFindings) {
    whyParts.push(`diagnostics indicate: ${input.diagnosticFindings}`);
  }
  if (input.causalFactors) {
    whyParts.push(`causal factors: ${input.causalFactors}`);
  }
  if (trend === "down") whyParts.push("negative trend trajectory compounds exposure");
  if (trend === "up" && (cat.includes("cost") || met.includes("cost"))) {
    whyParts.push("upward cost trend erodes margin if unchecked");
  }
  const whyItMatters = whyParts.join(". ") + ".";

  // --- Action ---
  let recommendedAction: string;
  if (input.signalType === "pending_outcome") {
    recommendedAction = "Record the actual outcome of this decision to close the feedback loop and improve calibration model accuracy";
  } else if (cat.includes("churn") || met.includes("churn")) {
    recommendedAction = `Run cohort analysis on ${segment}, identify top-decile risk factors, and activate targeted retention playbook. Escalate to board if churn exceeds 2× baseline.`;
  } else if (cat.includes("revenue") || met.includes("revenue")) {
    recommendedAction = `Diagnose revenue variance by segment and channel. Simulate recovery scenarios and approve corrective pricing or pipeline actions within the recommended window.`;
  } else if (cat.includes("cost") || met.includes("cost")) {
    recommendedAction = `Initiate cost audit across top 3 drivers. Evaluate optimization scenarios and set quarterly cost targets with accountability owners.`;
  } else if (cat.includes("growth")) {
    recommendedAction = `Analyze growth trajectory by acquisition channel. Identify underperforming segments and reallocate resources to highest-ROI vectors.`;
  } else {
    recommendedAction = `Investigate root cause via diagnostic engine. Quantify impact, approve corrective action, and set measurement checkpoint at ${inferDeadlineDays(input.severity, conf)}d.`;
  }

  return {
    whatHappened,
    whyItMatters,
    recommendedAction,
    suggestedOwner: inferOwner(input.category, input.metricType),
    suggestedDeadlineDays: inferDeadlineDays(input.severity, conf),
    successMetrics: inferSuccessMetrics(input.category, input.metricType),
  };
}
