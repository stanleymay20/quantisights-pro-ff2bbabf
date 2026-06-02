import { describe, it, expect, vi } from 'vitest'
import { simulateScenario } from '@/lib/decision-intelligence/scenario-simulator'
import { rankRecommendations, buildRecommendationsFromScenarios } from '@/lib/decision-intelligence/recommendation-ranker'
import { estimateImpact } from '@/lib/decision-intelligence/impact-estimator'
import type { Scenario, ScenarioOutcome } from '@/lib/decision-intelligence/types'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

const baseScenario: Scenario = {
  id: 's1',
  name: 'Increase inventory',
  description: 'Boost inventory by 20%',
  assumptions: [],
  inputChanges: { inventory: 0.2 },
}

describe('simulateScenario', () => {
  it('predicts positive revenue change with positive inventory input', () => {
    const outcome = simulateScenario({ scenario: baseScenario, baselineMetrics: {} })
    expect(outcome.predictedChanges.revenue).toBeGreaterThan(0)
  })

  it('caps confidence at 0.85', () => {
    const outcome = simulateScenario({ scenario: baseScenario, baselineMetrics: {} })
    expect(outcome.confidence).toBeLessThanOrEqual(0.85)
  })

  it('returns low risk for small changes', () => {
    const s: Scenario = { id: 's2', name: 'Tiny', description: '', assumptions: [], inputChanges: { inventory: 0.01 } }
    const outcome = simulateScenario({ scenario: s, baselineMetrics: {} })
    expect(outcome.riskLevel).toBe('low')
  })

  it('returns high risk for large changes (> 0.30)', () => {
    const s: Scenario = { id: 's3', name: 'Big', description: '', assumptions: [], inputChanges: { price: -1.0 } }
    const outcome = simulateScenario({ scenario: s, baselineMetrics: {} })
    expect(outcome.riskLevel).toBe('high')
  })
})

describe('rankRecommendations', () => {
  const mockOutcome: ScenarioOutcome = {
    scenarioId: 's1',
    scenarioName: 'Test',
    predictedChanges: { revenue: 0.1 },
    confidence: 0.7,
    riskLevel: 'medium',
    expectedImpactLabel: '+10% revenue',
    timeHorizonDays: 3,
    assumptions: [],
  }

  it('returns array sorted by rank ascending', () => {
    const recs = buildRecommendationsFromScenarios({
      scenarios: [mockOutcome, { ...mockOutcome, scenarioId: 's2', scenarioName: 'Test2', confidence: 0.5 }],
      rootCauseCategory: 'data_quality',
    })
    const ranked = rankRecommendations(recs)
    expect(ranked[0].rank).toBe(1)
    expect(ranked[1].rank).toBe(2)
  })

  it('rank 1 has highest compositeScore', () => {
    const recs = buildRecommendationsFromScenarios({
      scenarios: [mockOutcome, { ...mockOutcome, scenarioId: 's2', confidence: 0.3, riskLevel: 'high' }],
      rootCauseCategory: 'data_quality',
    })
    const ranked = rankRecommendations(recs)
    expect(ranked[0].compositeScore).toBeGreaterThanOrEqual(ranked[1].compositeScore)
  })
})

describe('buildRecommendationsFromScenarios', () => {
  it('returns one recommendation per scenario', () => {
    const scenarios: ScenarioOutcome[] = [
      { scenarioId: 's1', scenarioName: 'A', predictedChanges: {}, confidence: 0.6, riskLevel: 'low', expectedImpactLabel: 'None', timeHorizonDays: 7, assumptions: [] },
      { scenarioId: 's2', scenarioName: 'B', predictedChanges: {}, confidence: 0.7, riskLevel: 'medium', expectedImpactLabel: 'Some', timeHorizonDays: 3, assumptions: [] },
    ]
    const recs = buildRecommendationsFromScenarios({ scenarios, rootCauseCategory: 'schema_change' })
    expect(recs).toHaveLength(2)
  })
})

describe('estimateImpact', () => {
  it('returns object with metricName and confidence in 0-1 range', () => {
    const outcome: ScenarioOutcome = {
      scenarioId: 's1', scenarioName: 'Test', predictedChanges: { revenue: 0.1 },
      confidence: 0.7, riskLevel: 'low', expectedImpactLabel: '+10%', timeHorizonDays: 7, assumptions: [],
    }
    const result = estimateImpact({
      scenario: outcome,
      baselineValues: [100, 110, 105, 108],
      treatmentValues: [120, 125, 118, 122],
      metricName: 'revenue',
    })
    expect(result.metricName).toBe('revenue')
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })
})
