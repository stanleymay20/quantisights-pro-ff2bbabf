import type { OutcomeRecord, RecommendationVerification, FeedbackSignal } from './types'

export function computeAccuracyScore(outcomes: OutcomeRecord[]): number {
  const measured = outcomes.filter((o) => o.deviationPercent !== undefined)
  if (measured.length === 0) return 0
  const sum = measured.reduce((acc, o) => acc + (100 - Math.min(100, Math.abs(o.deviationPercent!))), 0)
  return sum / measured.length
}

export function determineCalibration(
  accuracyScore: number,
  outcomesCount: number
): RecommendationVerification['calibrationStatus'] {
  if (outcomesCount < 3) return 'insufficient_data'
  if (accuracyScore >= 80) return 'well_calibrated'
  return 'overconfident' // default for < 80, overridden below
}

export function verifyRecommendation(params: {
  recommendationId: string
  decisionId: string
  wasFollowed: boolean
  outcomes: OutcomeRecord[]
}): RecommendationVerification {
  const { recommendationId, decisionId, wasFollowed, outcomes } = params
  const accuracyScore = computeAccuracyScore(outcomes)
  const measured = outcomes.filter((o) => o.deviationPercent !== undefined)

  let calibrationStatus: RecommendationVerification['calibrationStatus']
  if (measured.length < 3) {
    calibrationStatus = 'insufficient_data'
  } else if (accuracyScore >= 80) {
    calibrationStatus = 'well_calibrated'
  } else {
    const betterCount = outcomes.filter((o) => o.outcome === 'better_than_expected').length
    const worseCount = outcomes.filter((o) => o.outcome === 'worse_than_expected').length
    calibrationStatus = betterCount > worseCount ? 'underconfident' : 'overconfident'
  }

  const deviations = measured.map((o) => Math.abs(o.deviationPercent!))
  const averageDeviation = deviations.length > 0
    ? deviations.reduce((a, b) => a + b, 0) / deviations.length
    : 0

  return {
    recommendationId,
    decisionId,
    wasFollowed,
    outcomeRecords: outcomes,
    averageDeviation,
    accuracyScore,
    calibrationStatus,
    verifiedAt: new Date().toISOString(),
  }
}

export function toFeedbackSignals(verification: RecommendationVerification): FeedbackSignal[] {
  const signal: FeedbackSignal['signal'] =
    verification.calibrationStatus === 'well_calibrated'
      ? 'positive'
      : verification.calibrationStatus === 'overconfident'
      ? 'negative'
      : 'neutral'
  const weight = verification.accuracyScore / 100
  return [
    {
      id: crypto.randomUUID(),
      source: 'outcome_record',
      recommendationId: verification.recommendationId,
      signal,
      weight,
      evidence: `Calibration: ${verification.calibrationStatus}, accuracy: ${verification.accuracyScore.toFixed(1)}%`,
      recordedAt: new Date().toISOString(),
    },
  ]
}
