/**
 * Decision Context Engine
 *
 * Enforces that all analysis is scoped to a Decision Context.
 * Provides contextual insight formatting and simulation guards.
 */

import type { DecisionContext } from "@/hooks/useDecisionContexts";

// ═══════════════════════════════════════════════════════
// CONTEXTUAL INSIGHT STRUCTURE
// ═══════════════════════════════════════════════════════

export interface ContextualInsight {
  observedFact: string;
  statisticalInference: string;
  decisionRelevance: string;
  recommendation: string;
  confidenceBasis: {
    sampleSize: number;
    method: string;
    pValue?: number | null;
    variance?: number | null;
  };
  traceability: {
    datasetId: string;
    decisionContextId: string;
    decisionType: string;
    variablesUsed: string[];
    analysisMethod: string;
    generatedAt: string;
    assumptions: string[];
    limitations: string[];
  };
}

// ═══════════════════════════════════════════════════════
// CONTEXT VALIDATION
// ═══════════════════════════════════════════════════════

export interface ContextValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that required scoping is present before any analysis.
 */
export function validateAnalysisScope(
  organizationId: string | null,
  datasetId: string | null,
  decisionContextId: string | null
): ContextValidationResult {
  const errors: string[] = [];
  if (!organizationId) errors.push("Organization ID required.");
  if (!datasetId) errors.push("Dataset ID required. Select a dataset to scope analysis.");
  if (!decisionContextId) errors.push("Decision context required. Create or select a decision context.");
  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════
// SIMULATION BASELINE GUARD
// ═══════════════════════════════════════════════════════

export interface SimulationBaseline {
  metric: string;
  value: number;
  source: "dataset" | "manual";
  datasetId: string;
}

/**
 * Validates simulation baselines — refuses fabricated defaults.
 */
export function validateSimulationBaselines(
  baselines: SimulationBaseline[]
): ContextValidationResult {
  const errors: string[] = [];

  if (baselines.length === 0) {
    errors.push("Simulation unavailable: baseline metrics missing. Upload data or compute KPIs first.");
    return { valid: false, errors };
  }

  for (const b of baselines) {
    if (b.value === undefined || b.value === null || !isFinite(b.value)) {
      errors.push(`Invalid baseline for ${b.metric}: value is not a finite number.`);
    }
    if (!b.datasetId) {
      errors.push(`Baseline for ${b.metric} must reference a dataset.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════
// CONTEXTUAL INSIGHT FORMATTER
// ═══════════════════════════════════════════════════════

/**
 * Formats a raw insight into a decision-context-aware structure.
 */
export function formatContextualInsight(
  observedFact: string,
  inference: string,
  context: DecisionContext,
  datasetId: string,
  meta: {
    sampleSize: number;
    method: string;
    pValue?: number | null;
    variance?: number | null;
    variablesUsed: string[];
    assumptions?: string[];
    limitations?: string[];
  }
): ContextualInsight {
  const decisionType = context.decision_type;
  const relevance = deriveDecisionRelevance(observedFact, inference, decisionType, context.objective);

  return {
    observedFact,
    statisticalInference: inference,
    decisionRelevance: relevance.relevance,
    recommendation: relevance.recommendation,
    confidenceBasis: {
      sampleSize: meta.sampleSize,
      method: meta.method,
      pValue: meta.pValue ?? null,
      variance: meta.variance ?? null,
    },
    traceability: {
      datasetId,
      decisionContextId: context.id,
      decisionType,
      variablesUsed: meta.variablesUsed,
      analysisMethod: meta.method,
      generatedAt: new Date().toISOString(),
      assumptions: meta.assumptions ?? [],
      limitations: meta.limitations ?? [],
    },
  };
}

// ═══════════════════════════════════════════════════════
// DECISION RELEVANCE DERIVATION
// ═══════════════════════════════════════════════════════

function deriveDecisionRelevance(
  fact: string,
  inference: string,
  decisionType: string,
  objective: string | null
): { relevance: string; recommendation: string } {
  const objectiveStr = objective ? ` (Objective: ${objective})` : "";

  const typeFraming: Record<string, { lens: string; action: string }> = {
    growth_strategy: {
      lens: "This finding impacts growth trajectory",
      action: "Evaluate whether current growth levers remain effective",
    },
    operational_efficiency: {
      lens: "This affects operational performance",
      action: "Investigate process or resource optimization opportunities",
    },
    risk_management: {
      lens: "This represents a risk signal requiring monitoring",
      action: "Assess exposure and consider mitigation strategies",
    },
    pricing_strategy: {
      lens: "This may affect pricing elasticity or margin",
      action: "Analyze pricing impact on affected segments",
    },
    policy_analysis: {
      lens: "This has policy implications",
      action: "Evaluate policy effectiveness against observed outcomes",
    },
    market_expansion: {
      lens: "This is relevant to market opportunity assessment",
      action: "Factor into market entry risk/reward analysis",
    },
    investment_decision: {
      lens: "This affects the investment thesis",
      action: "Reassess expected returns given this evidence",
    },
    retention_strategy: {
      lens: "This impacts customer/user retention",
      action: "Review retention interventions targeting affected segments",
    },
    cost_optimization: {
      lens: "This relates to cost structure efficiency",
      action: "Identify cost reduction opportunities in affected areas",
    },
    general: {
      lens: "This is relevant to the current strategic evaluation",
      action: "Investigate further to determine actionability",
    },
  };

  const framing = typeFraming[decisionType] ?? typeFraming.general;

  return {
    relevance: `${framing.lens}${objectiveStr}. ${inference}`,
    recommendation: `${framing.action}. Based on: ${fact}`,
  };
}

// ═══════════════════════════════════════════════════════
// CONTEXT-SCOPED QUERY HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Returns filter params for scoped queries.
 */
export function scopedQueryParams(
  organizationId: string,
  datasetId: string,
  decisionContextId?: string | null
) {
  const params: Record<string, string> = {
    organization_id: organizationId,
    dataset_id: datasetId,
  };
  if (decisionContextId) {
    params.decision_context_id = decisionContextId;
  }
  return params;
}
