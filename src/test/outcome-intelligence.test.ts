import { describe, it, expect } from 'vitest'
import {
  computeAccuracyScore,
  determineCalibration,
  verifyRecommendation,
} from '../lib/outcome-intelligence/recommendation-verifier'
import {
  extractLearningRecord,
  applyFeedbackToConfidence,
  aggregateSummary,
} from '../lib/outcome-intelligence/feedback-loop'
import type { OutcomeRecord, RecommendationVerification } from '../lib/outcome-intelligence/types'

function makeOutcome(overrides: Partial<OutcomeRecord> = {}): OutcomeRecord {
  return {
    id: crypto.randomUUID(),
    decisionId: 'dec-1',
    recommendationId: 'rec-1',
    organizationId: 'org-1',
    predictedImpact: 'increase',
    predictedMetric: 'revenue',
    predictedValue: 100,
    outcome: 'as_expected',
    measurementWindowDays: 30,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeVerification(overrides: Partial<RecommendationVerification> = {}): RecommendationVerification {
  return {
    recommendationId: 'rec-1',
    decisionId: 'dec-1',
    wasFollowed: true,
    outcomeRecords: [],
    averageDeviation: 0,
    accuracyScore: 85,
    calibrationStatus: 'well_calibrated',
    verifiedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('computeAccuracyScore', () => {
  it('with no outcomes → 0', () => {
    expect(computeAccuracyScore([])).toBe(0)
  })

  it('with 0% deviation → 100', () => {
    const o = makeOutcome({ deviationPercent: 0 })
    expect(computeAccuracyScore([o])).toBe(100)
  })

  it('with 20% deviation → 80', () => {
    const o = makeOutcome({ deviationPercent: 20 })
    expect(computeAccuracyScore([o])).toBe(80)
  })
})

describe('determineCalibration', () => {
  it('with < 3 outcomes → insufficient_data', () => {
    expect(determineCalibration(90, 2)).toBe('insufficient_data')
  })

  it('with accuracy >= 80 → well_calibrated', () => {
    expect(determineCalibration(85, 5)).toBe('well_calibrated')
  })
})

describe('verifyRecommendation', () => {
  it('with all as_expected → well_calibrated', () => {
    const outcomes = [
      makeOutcome({ deviationPercent: 2 }),
      makeOutcome({ deviationPercent: 3 }),
      makeOutcome({ deviationPercent: 1 }),
    ]
    const result = verifyRecommendation({ recommendationId: 'r1', decisionId: 'd1', wasFollowed: true, outcomes })
    expect(result.calibrationStatus).toBe('well_calibrated')
    expect(result.accuracyScore).toBeGreaterThanOrEqual(90)
  })

  it('with wasFollowed=false → still computes calibration', () => {
    const outcomes = [
      makeOutcome({ deviationPercent: 5 }),
      makeOutcome({ deviationPercent: 3 }),
      makeOutcome({ deviationPercent: 2 }),
    ]
    const result = verifyRecommendation({ recommendationId: 'r1', decisionId: 'd1', wasFollowed: false, outcomes })
    expect(result.wasFollowed).toBe(false)
    expect(result.calibrationStatus).toBeDefined()
  })
})

describe('extractLearningRecord', () => {
  it('success → recommendationAdjustment = +0.05', () => {
    const v = makeVerification({ calibrationStatus: 'well_calibrated' })
    const record = extractLearningRecord({ verification: v, scenarioType: 'inventory', rootCauseCategory: 'supply', recommendedAction: 'increase' })
    expect(record.recommendationAdjustment).toBe(0.05)
    expect(record.outcome).toBe('success')
  })

  it('failure → recommendationAdjustment = -0.10', () => {
    const v = makeVerification({ calibrationStatus: 'overconfident' })
    const record = extractLearningRecord({ verification: v, scenarioType: 'inventory', rootCauseCategory: 'supply', recommendedAction: 'increase' })
    expect(record.recommendationAdjustment).toBe(-0.10)
    expect(record.outcome).toBe('failure')
  })
})

describe('applyFeedbackToConfidence', () => {
  it('with matching learning records → adjusted confidence', () => {
    const v = makeVerification({ calibrationStatus: 'well_calibrated' })
    const lr = extractLearningRecord({ verification: v, scenarioType: 'test', rootCauseCategory: 'x', recommendedAction: 'y' })
    const result = applyFeedbackToConfidence(0.7, [lr], 'test')
    expect(result).toBeCloseTo(0.75, 2)
  })

  it('result always clamped to [0.05, 0.95]', () => {
    const v1 = makeVerification({ calibrationStatus: 'overconfident' })
    const lr1 = extractLearningRecord({ verification: v1, scenarioType: 'x', rootCauseCategory: 'y', recommendedAction: 'z' })
    const lr1Low = { ...lr1, recommendationAdjustment: -0.99 }
    const r1 = applyFeedbackToConfidence(0.06, [lr1Low], 'x')
    expect(r1).toBeGreaterThanOrEqual(0.05)

    const r2 = applyFeedbackToConfidence(0.94, [{ ...lr1, recommendationAdjustment: 0.99 }], 'x')
    expect(r2).toBeLessThanOrEqual(0.95)
  })
})

describe('aggregateSummary', () => {
  it('with 3 verifications → correct averageAccuracy', () => {
    const verifications = [
      makeVerification({ accuracyScore: 80, calibrationStatus: 'well_calibrated' }),
      makeVerification({ accuracyScore: 70, calibrationStatus: 'overconfident' }),
      makeVerification({ accuracyScore: 90, calibrationStatus: 'well_calibrated' }),
    ]
    const summary = aggregateSummary({ organizationId: 'org-1', verifications, learningRecords: [] })
    expect(summary.averageAccuracy).toBeCloseTo(80, 0)
    expect(summary.wellCalibratedCount).toBe(2)
    expect(summary.overconfidentCount).toBe(1)
  })
})
