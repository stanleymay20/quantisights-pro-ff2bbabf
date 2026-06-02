import { computeCostOfDelay } from '@/lib/cost-of-delay'
import { scoreDecisionQuality, buildConfidenceBasis } from '@/lib/evidence-contract'
import type { ActionRecommendation, ScenarioOutcome } from './types'

export function buildRecommendationsFromScenarios(params: {
  scenarios: ScenarioOutcome[]
  rootCauseCategory: string
  metric?: string
}): Omit<ActionRecommendation, 'rank' | 'compositeScore'>[] {
  const { scenarios, rootCauseCategory, metric } = params

  const ownerMap: Record<string, string> = {
    schema_change: 'Engineering',
    volume_anomaly: 'Data Engineering',
    data_quality: 'Data Steward',
    latency: 'Infrastructure',
  }
  const owner = ownerMap[rootCauseCategory] ?? 'Data Team'

  return scenarios.map((scenario) => {
    const action = `Implement ${scenario.scenarioName}`
    const rationale = scenario.assumptions.join('; ') || `Address ${rootCauseCategory} through ${scenario.scenarioName}`

    const timelineLabel =
      scenario.riskLevel === 'high' ? '24h'
      : scenario.riskLevel === 'medium' ? '72h'
      : '1 week'

    const successMetrics = Object.keys(scenario.predictedChanges)

    const confidenceBasis = buildConfidenceBasis({
      sampleSize: scenario.assumptions.length || 1,
      dataCoverage: scenario.confidence * 100,
      variance: null,
      calibrationApplied: false,
    })

    const qualityScore = scoreDecisionQuality({
      observation: action,
      evidence: scenario.assumptions,
      reasoning: rationale,
      confidenceBasis,
    })

    const cod = computeCostOfDelay({
      severity: scenario.riskLevel as 'high' | 'medium' | 'low',
      confidence: scenario.confidence * 100,
    })

    return {
      id: crypto.randomUUID(),
      action,
      rationale,
      expectedImpactLabel: scenario.expectedImpactLabel,
      confidenceScore: Math.round(scenario.confidence * 100),
      riskLevel: scenario.riskLevel,
      costOfDelayLabel: cod.estimatedDelayCost,
      owner,
      timelineLabel,
      successMetrics,
      scenarioOutcome: scenario,
      qualityScore,
      metric,
    } as Omit<ActionRecommendation, 'rank' | 'compositeScore'>
  })
}

export function rankRecommendations(
  recommendations: Omit<ActionRecommendation, 'rank' | 'compositeScore'>[]
): ActionRecommendation[] {
  const riskWeight = (level: string) =>
    level === 'high' ? 0.9 : level === 'medium' ? 0.5 : 0.1

  const ranked = recommendations.map((r) => {
    const confidence = r.confidenceScore / 100
    const rw = riskWeight(r.riskLevel)
    const urgency = rw  // high risk = more urgent
    const compositeScore = confidence * 0.4 + (1 - rw) * 0.3 + urgency * 0.3
    return { ...r, compositeScore, rank: 0 }
  })

  ranked.sort((a, b) => b.compositeScore - a.compositeScore)
  ranked.forEach((r, i) => { r.rank = i + 1 })
  return ranked
}
