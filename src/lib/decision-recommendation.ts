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
  const confLabel = conf >= 70 ? "high confidence" : conf >= 40 ? "moderate confidence" : "early-stage signal";
  const deadlineDays = inferDeadlineDays(input.severity, conf);

  // --- What happened (always prefer the real signal message) ---
  let whatHappened: string;
  if (input.signalType === "advisory" && input.priorAdvisoryAction) {
    whatHappened = input.priorAdvisoryAction;
  } else if (msg.length > 20) {
    // Use the ACTUAL insight/signal message — this is real AI-generated or data-driven text
    whatHappened = msg.slice(0, 200);
  } else {
    // Only fall back to a constructed sentence when no substantive message exists
    const metricLabel = met || cat || "monitored metric";
    const trendVerb = trend === "up" ? "increasing" : trend === "down" ? "declining" : "shifting";
    whatHappened = `${input.severity === "critical" ? "Critical" : "Notable"} ${trendVerb} signal detected in ${metricLabel} affecting ${segment}.`;
  }

  // --- Why it matters (cite specific evidence, not generic statements) ---
  const whyParts: string[] = [];
  whyParts.push(`Detected at ${confLabel} (${conf}%)`);
  if (input.severity === "critical") {
    whyParts.push("classified as critical severity — immediate attention required");
  } else if (input.severity === "high") {
    whyParts.push("classified as high severity — material business impact likely");
  }
  if (input.diagnosticFindings) {
    whyParts.push(`root cause analysis: ${input.diagnosticFindings}`);
  }
  if (input.causalFactors) {
    whyParts.push(`contributing factors: ${input.causalFactors}`);
  }
  if (trend === "down") whyParts.push("negative trajectory compounds exposure over time");
  if (trend === "up" && (cat.includes("cost") || met.includes("cost"))) {
    whyParts.push("rising cost trend erodes margin if unchecked");
  }
  // Add data-specific context from the message itself
  if (msg.length > 20 && input.diagnosticFindings == null) {
    // Extract any percentage or number from the message for specificity
    const numMatch = msg.match(/(\d+\.?\d*)\s*%/);
    if (numMatch) {
      whyParts.push(`signal magnitude: ${numMatch[0]}`);
    }
  }
  const whyItMatters = whyParts.join(". ") + ".";

  // --- Action (contextualized with actual signal data, not generic playbooks) ---
  let recommendedAction: string;
  if (input.signalType === "pending_outcome") {
    recommendedAction = `Record the actual outcome of this decision to close the feedback loop and improve calibration accuracy. Decision has been pending — outcome data is overdue.`;
  } else {
    // Build action from the actual context rather than category templates
    const actionParts: string[] = [];
    
    // Step 1: Always start with investigation grounded in the specific signal
    if (msg.length > 20) {
      actionParts.push(`Investigate the specific signal: "${msg.slice(0, 100)}${msg.length > 100 ? "..." : ""}".`);
    } else {
      actionParts.push(`Investigate ${met || cat || "this signal"} via the diagnostic engine to identify root cause.`);
    }

    // Step 2: Quantify — always reference what we know
    actionParts.push(`Quantify impact using ${conf}% confidence signal (${confLabel}).`);

    // Step 3: Domain-specific next step based on category
    if (cat.includes("churn") || met.includes("churn")) {
      actionParts.push(`Run cohort analysis on ${segment} to identify at-risk accounts and activate retention playbook.`);
    } else if (cat.includes("revenue") || met.includes("revenue")) {
      actionParts.push(`Diagnose variance by segment/channel and simulate recovery scenarios.`);
    } else if (cat.includes("cost") || met.includes("cost")) {
      actionParts.push(`Audit top cost drivers and evaluate optimization scenarios.`);
    } else if (cat.includes("growth")) {
      actionParts.push(`Analyze by acquisition channel and reallocate to highest-ROI vectors.`);
    } else {
      actionParts.push(`Approve corrective action and set measurement checkpoint.`);
    }

    // Step 4: Always include deadline
    actionParts.push(`Target resolution within ${deadlineDays}d.`);
    
    recommendedAction = actionParts.join(" ");
  }

  return {
    whatHappened,
    whyItMatters,
    recommendedAction,
    suggestedOwner: inferOwner(input.category, input.metricType),
    suggestedDeadlineDays: deadlineDays,
    successMetrics: inferSuccessMetrics(input.category, input.metricType),
  };
}
