import type { Scenario, ScenarioOutcome } from './types'

const DEFAULT_CORRELATIONS: Record<string, Record<string, number>> = {
  inventory: { revenue: 0.65, customer_satisfaction: 0.40 },
  price: { revenue: -0.30, volume: -0.55, margin: 0.45 },
  headcount: { productivity: 0.50, cost: 0.80 },
  marketing_spend: { leads: 0.70, revenue: 0.45 },
  quality: { returns: -0.60, nps: 0.55 },
}

export function simulateScenario(params: {
  scenario: Scenario
  baselineMetrics: Record<string, number>
  correlationMatrix?: Record<string, Record<string, number>>
}): ScenarioOutcome {
  const { scenario, correlationMatrix } = params
  const matrix = correlationMatrix ?? DEFAULT_CORRELATIONS
  const predictedChanges: Record<string, number> = {}

  for (const [metric, inputDelta] of Object.entries(scenario.inputChanges)) {
    const correls = matrix[metric] ?? {}
    for (const [correlMetric, coeff] of Object.entries(correls)) {
      predictedChanges[correlMetric] = (predictedChanges[correlMetric] ?? 0) + inputDelta * coeff
    }
  }

  const confidence = Math.min(0.85, 0.85 / (1 + 0.1 * scenario.assumptions.length))

  const maxAbsChange = Object.values(predictedChanges).reduce(
    (max, v) => Math.max(max, Math.abs(v)), 0
  )
  const riskLevel: 'low' | 'medium' | 'high' =
    maxAbsChange > 0.30 ? 'high' : maxAbsChange > 0.15 ? 'medium' : 'low'

  // Find largest absolute predicted change for label
  let labelMetric = ''
  let labelValue = 0
  for (const [m, v] of Object.entries(predictedChanges)) {
    if (Math.abs(v) > Math.abs(labelValue)) {
      labelValue = v
      labelMetric = m
    }
  }
  const sign = labelValue >= 0 ? '+' : ''
  const expectedImpactLabel = labelMetric
    ? `${sign}${(labelValue * 100).toFixed(1)}% ${labelMetric}`
    : 'No significant predicted change'

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    predictedChanges,
    confidence,
    riskLevel,
    expectedImpactLabel,
    timeHorizonDays: riskLevel === 'high' ? 1 : riskLevel === 'medium' ? 3 : 7,
    assumptions: scenario.assumptions,
  }
}
