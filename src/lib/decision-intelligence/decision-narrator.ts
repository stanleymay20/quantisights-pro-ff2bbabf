import { generateRecommendation } from '@/lib/decision-recommendation'
import type { DecisionIntelligenceResult } from './types'

export function narrateDecision(result: DecisionIntelligenceResult): string {
  const top = result.topRecommendation
  const structured = generateRecommendation({
    signalType: 'advisory',
    severity: top.riskLevel,
    confidence: top.confidenceScore,
    metricType: top.successMetrics[0] ?? null,
    diagnosticFindings: top.rationale,
    causalFactors: top.scenarioOutcome.scenarioName,
  })

  const metrics = top.successMetrics.slice(0, 3).join(', ') || 'N/A'
  return `${structured.recommendedAction}

Why it matters: ${structured.whyItMatters}

Success metrics: ${metrics}

Overall confidence: ${result.overallConfidence}%`
}
