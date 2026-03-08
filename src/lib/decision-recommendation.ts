/**
 * Contextual AI recommendation generator — EVIDENCE-BACKED + FAIL-CLOSED.
 *
 * Every recommendation MUST carry:
 * - Output classification (OBSERVED_FACT / STATISTICAL_INFERENCE / HEURISTIC_ESTIMATE / AI_RECOMMENDATION)
 * - Evidence basis (traceability)
 * - Confidence basis (justification)
 * - Assumptions + Risks if wrong
 * - Traceability record
 *
 * FAIL-CLOSED: If decision quality is below threshold, recommendedAction is
 * replaced with an explicit "insufficient evidence" message.
 */

import {
  type EvidenceBlock,
  type ConfidenceBasis,
  type TraceabilityRecord,
  buildConfidenceBasis,
  buildTraceability,
  scoreDecisionQuality,
  type DecisionQualityScore,
} from "./evidence-contract";

import type { OutputClassification } from "@/components/dashboard/OutputClassificationBadge";

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
  sampleSize?: number;
  calibrationApplied?: boolean;
  /** Source dataset for traceability */
  datasetId?: string;
  /** Human-readable dataset name */
  datasetName?: string;
  /** Row count used */
  dataRowsUsed?: number;
}

export interface ClassifiedSection {
  classification: OutputClassification;
  label: string;
  content: string;
}

export interface StructuredRecommendation {
  /** Classified sections — no mixed unlabeled prose */
  sections: ClassifiedSection[];
  whatHappened: string;
  whyItMatters: string;
  recommendedAction: string;
  suggestedOwner: string;
  suggestedDeadlineDays: number;
  successMetrics: string[];
  assumptions: string[];
  riskIfWrong: string;
  evidenceBasis: string[];
  confidenceBasis: ConfidenceBasis;
  qualityScore: DecisionQualityScore;
  isDecisionGrade: boolean;
  /** Traceability record for "Why am I seeing this?" */
  traceability: TraceabilityRecord;
  /** If not decision-grade, the original action is suppressed and this contains the gate message */
  decisionGateMessage: string | null;
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
  calibration: "Decision Governance Lead",
};

function inferOwner(category: string | null | undefined, metricType: string | null | undefined): string {
  const key = [category, metricType].filter(Boolean).join(" ").toLowerCase();
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

export function generateRecommendation(input: RecommendationInput): StructuredRecommendation {
  const cat = input.category?.toLowerCase() ?? "";
  const met = input.metricType?.toLowerCase() ?? "";
  const msg = input.message ?? "";
  const conf = input.confidence ?? 50;
  const trend = input.trendDirection ?? "stable";
  const segment = input.affectedSegment ?? "primary segment";
  const confLabel = conf >= 70 ? "high confidence" : conf >= 40 ? "moderate confidence" : "low confidence";
  const deadlineDays = inferDeadlineDays(input.severity, conf);
  const sampleSize = input.sampleSize ?? 0;

  const confidenceBasis = buildConfidenceBasis({
    sampleSize,
    calibrationApplied: input.calibrationApplied ?? false,
    isHeuristic: sampleSize < 12,
  });

  // --- Evidence basis ---
  const evidenceBasis: string[] = [];
  if (msg.length > 20) evidenceBasis.push(`Signal: "${msg.slice(0, 120)}"`);
  if (input.diagnosticFindings) evidenceBasis.push(`Diagnostic: ${input.diagnosticFindings}`);
  if (input.causalFactors) evidenceBasis.push(`Causal factors: ${input.causalFactors}`);
  if (input.priorAdvisoryAction) evidenceBasis.push(`Prior advisory: ${input.priorAdvisoryAction}`);
  if (conf > 0) evidenceBasis.push(`Confidence: ${conf}% (${confLabel})`);

  // --- Classified sections ---
  const sections: ClassifiedSection[] = [];

  // OBSERVED_FACT: What we directly see in data
  let whatHappened: string;
  if (input.signalType === "advisory" && input.priorAdvisoryAction) {
    whatHappened = input.priorAdvisoryAction;
  } else if (msg.length > 20) {
    whatHappened = msg.slice(0, 200);
  } else {
    const metricLabel = met || cat || "monitored metric";
    const trendVerb = trend === "up" ? "increasing" : trend === "down" ? "declining" : "shifting";
    whatHappened = `${input.severity === "critical" ? "Critical" : "Notable"} ${trendVerb} signal detected in ${metricLabel} affecting ${segment}.`;
  }
  sections.push({
    classification: msg.length > 20 ? "OBSERVED_FACT" : "HEURISTIC_ESTIMATE",
    label: "What happened",
    content: whatHappened,
  });

  // STATISTICAL_INFERENCE or HEURISTIC: Why it matters
  const whyParts: string[] = [];
  whyParts.push(`Detected at ${confLabel} (${conf}%)`);
  if (sampleSize > 0) whyParts.push(`based on ${sampleSize} data points`);
  if (input.severity === "critical") {
    whyParts.push("classified as critical severity — immediate attention required");
  } else if (input.severity === "high") {
    whyParts.push("classified as high severity — material business impact likely");
  }
  if (input.diagnosticFindings) whyParts.push(`root cause analysis: ${input.diagnosticFindings}`);
  if (input.causalFactors) whyParts.push(`contributing factors: ${input.causalFactors}`);
  if (trend === "down") whyParts.push("negative trajectory compounds exposure over time");
  if (msg.length > 20 && !input.diagnosticFindings) {
    const numMatch = msg.match(/(\d+\.?\d*)\s*%/);
    if (numMatch) whyParts.push(`signal magnitude: ${numMatch[0]}`);
  }
  const whyItMatters = whyParts.join(". ") + ".";
  sections.push({
    classification: sampleSize >= 12 ? "STATISTICAL_INFERENCE" : "HEURISTIC_ESTIMATE",
    label: "Why it matters",
    content: whyItMatters,
  });

  // Assumptions
  const assumptions: string[] = [];
  if (sampleSize < 30) {
    assumptions.push(`Limited sample size (${sampleSize} points) — trends may not be statistically significant`);
  }
  if (!input.diagnosticFindings) {
    assumptions.push("Root cause has not been diagnostically confirmed");
  }
  if (trend !== "stable") {
    assumptions.push(`Assumes ${trend === "down" ? "downward" : "upward"} trend will continue without intervention`);
  }
  if (input.signalType === "proactive") {
    assumptions.push("Proactive signal — threshold-based detection, not anomaly-confirmed");
  }

  // Risk if wrong
  let riskIfWrong: string;
  if (input.severity === "critical") {
    riskIfWrong = "If this signal is a false positive, acting on it may divert resources unnecessarily. However, the cost of ignoring a true critical signal typically outweighs the cost of investigation.";
  } else if (conf < 40) {
    riskIfWrong = `Low confidence (${conf}%) means this signal has a high probability of being noise. Recommend investigation before committing resources.`;
  } else {
    riskIfWrong = "If the underlying trend reverses naturally, the recommended action may be unnecessary. Monitor the success metrics to detect early and adjust.";
  }

  // AI_RECOMMENDATION: Action
  let recommendedAction: string;
  if (input.signalType === "pending_outcome") {
    recommendedAction = `Record the actual outcome of this decision to close the feedback loop and improve calibration accuracy. Decision has been pending — outcome data is overdue.`;
  } else {
    const actionParts: string[] = [];
    if (msg.length > 20) {
      actionParts.push(`Investigate the specific signal: "${msg.slice(0, 80)}${msg.length > 80 ? "..." : ""}".`);
    } else {
      actionParts.push(`Investigate ${met || cat || "this signal"} via the diagnostic engine to identify root cause.`);
    }
    actionParts.push(`Quantify impact using ${conf}% confidence signal (${confLabel}).`);

    if (cat.includes("churn") || met.includes("churn")) {
      actionParts.push(`Run cohort analysis on ${segment} to identify at-risk accounts and activate retention playbook.`);
    } else if (cat.includes("revenue") || met.includes("revenue")) {
      actionParts.push(`Diagnose variance by segment/channel and simulate recovery scenarios.`);
    } else if (cat.includes("cost") || met.includes("cost")) {
      actionParts.push(`Audit top cost drivers and evaluate optimization scenarios.`);
    } else if (cat.includes("growth")) {
      actionParts.push(`Analyze by acquisition channel and reallocate to highest-ROI vectors.`);
    } else if (cat.includes("calibration")) {
      actionParts.push(`Complete pending calibration assessments and close outstanding decision outcomes.`);
    } else {
      actionParts.push(`Approve corrective action and set measurement checkpoint.`);
    }

    actionParts.push(`Target resolution within ${deadlineDays}d. Track via success metrics.`);
    recommendedAction = actionParts.join(" ");
  }
  sections.push({
    classification: "AI_RECOMMENDATION",
    label: "Recommended action",
    content: recommendedAction,
  });

  const successMetrics = inferSuccessMetrics(cat, met);

  // --- Decision Quality Score ---
  const evidenceBlock: Partial<EvidenceBlock> = {
    observation: whatHappened,
    evidence: evidenceBasis,
    reasoning: whyItMatters,
    confidenceBasis,
    assumptions,
    limitations: sampleSize < 12 ? ["Limited data — statistical significance not established"] : [],
    recommendation: recommendedAction,
    expectedImpact: input.severity === "critical" ? "Immediate risk mitigation" : "Trend correction within action window",
    riskIfWrong,
  };

  const qualityScore = scoreDecisionQuality(evidenceBlock);
  const isDecisionGrade = qualityScore.isDecisionGrade;

  // --- FAIL-CLOSED GATE ---
  let decisionGateMessage: string | null = null;
  if (!isDecisionGrade) {
    decisionGateMessage = `Insufficient evidence for decision-grade recommendation (${qualityScore.overall}/100, Grade ${qualityScore.grade}). ${qualityScore.downgradeReason ?? ""}`;
    // Suppress the strategic recommendation text
    recommendedAction = "⚠ Not decision-grade — insufficient evidence to generate a reliable recommendation. " + (qualityScore.downgradeReason ?? "");
    // Update the section
    sections[sections.length - 1] = {
      classification: "AI_RECOMMENDATION",
      label: "Recommendation suppressed",
      content: recommendedAction,
    };
  }

  // --- Traceability ---
  const metricTypes = [met, cat].filter(Boolean);
  const traceability = buildTraceability({
    datasetId: input.datasetId ?? "active-dataset",
    datasetName: input.datasetName,
    dataRowsUsed: input.dataRowsUsed ?? sampleSize,
    metricTypes: metricTypes.length > 0 ? metricTypes : ["unknown"],
    modelUsed: sampleSize >= 12
      ? (input.calibrationApplied ? "Calibrated statistical model" : "Statistical inference")
      : "Heuristic rule-based engine",
    limitations: sampleSize < 12 ? ["Insufficient data for statistical significance"] : [],
  });

  return {
    sections,
    whatHappened,
    whyItMatters,
    recommendedAction,
    suggestedOwner: inferOwner(input.category, input.metricType),
    suggestedDeadlineDays: deadlineDays,
    successMetrics,
    assumptions,
    riskIfWrong,
    evidenceBasis,
    confidenceBasis,
    qualityScore,
    isDecisionGrade,
    traceability,
    decisionGateMessage,
  };
}

function inferSuccessMetrics(category: string, metricType: string): string[] {
  const key = [category, metricType].filter(Boolean).join(" ").toLowerCase();

  if (key.includes("churn") || key.includes("retention")) {
    return ["Monthly churn rate (% change)", "At-risk cohort size reduction", "NPS / CSAT delta"];
  } else if (key.includes("revenue")) {
    return ["MRR / ARR recovery trajectory", "Revenue variance vs. plan", "Pipeline conversion rate"];
  } else if (key.includes("cost")) {
    return ["Cost per unit reduction", "Burn rate change", "Gross margin improvement"];
  } else if (key.includes("margin")) {
    return ["Gross margin %", "Contribution margin delta", "EBITDA trajectory"];
  } else if (key.includes("growth")) {
    return ["Growth rate (MoM)", "New customer acquisition rate", "Expansion revenue %"];
  } else if (key.includes("calibration")) {
    return ["Calibration score improvement", "Brier score reduction", "Pending outcomes closed"];
  }
  return ["KPI trend direction", "Variance from baseline", "Time to resolution"];
}
