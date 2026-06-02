import { writeAuditLog } from '@/lib/lifecycle/audit'
import { eventBus } from '@/lib/realtime/event-bus'
import type { RecommendationVerification, LearningRecord, OutcomeIntelligenceSummary } from './types'

export function extractLearningRecord(params: {
  verification: RecommendationVerification
  scenarioType: string
  rootCauseCategory: string
  recommendedAction: string
}): LearningRecord {
  const { verification, scenarioType, rootCauseCategory, recommendedAction } = params

  const outcomeLabel: LearningRecord['outcome'] =
    verification.calibrationStatus === 'well_calibrated'
      ? 'success'
      : verification.calibrationStatus === 'overconfident'
      ? 'failure'
      : 'partial'

  const rawAdj = outcomeLabel === 'success' ? 0.05 : outcomeLabel === 'partial' ? -0.05 : -0.10
  const recommendationAdjustment = Math.max(-0.10, Math.min(0.10, rawAdj))

  const lessonsLearned: string[] = [
    `Scenario: ${scenarioType} — calibration was ${verification.calibrationStatus}`,
    `Average deviation: ${verification.averageDeviation.toFixed(1)}%`,
    `Accuracy score: ${verification.accuracyScore.toFixed(1)}%`,
  ]

  return {
    id: crypto.randomUUID(),
    scenarioType,
    rootCauseCategory,
    recommendedAction,
    outcome: outcomeLabel,
    outcomeDeviation: verification.averageDeviation,
    lessonsLearned,
    recommendationAdjustment,
    recordedAt: new Date().toISOString(),
  }
}

export function aggregateSummary(params: {
  organizationId: string
  verifications: RecommendationVerification[]
  learningRecords: LearningRecord[]
}): OutcomeIntelligenceSummary {
  const { organizationId, verifications } = params
  const measured = verifications.filter((v) => v.calibrationStatus !== 'insufficient_data')
  const avgAccuracy =
    measured.length > 0
      ? measured.reduce((s, v) => s + v.accuracyScore, 0) / measured.length
      : 0
  const topSuccessPatterns = params.learningRecords
    .filter((r) => r.outcome === 'success')
    .slice(0, 3)
    .map((r) => r.scenarioType)
  const topFailurePatterns = params.learningRecords
    .filter((r) => r.outcome === 'failure')
    .slice(0, 3)
    .map((r) => r.scenarioType)

  return {
    organizationId,
    totalDecisions: verifications.length,
    measuredDecisions: measured.length,
    averageAccuracy: avgAccuracy,
    wellCalibratedCount: verifications.filter((v) => v.calibrationStatus === 'well_calibrated').length,
    overconfidentCount: verifications.filter((v) => v.calibrationStatus === 'overconfident').length,
    underconfidentCount: verifications.filter((v) => v.calibrationStatus === 'underconfident').length,
    topSuccessPatterns,
    topFailurePatterns,
    generatedAt: new Date().toISOString(),
  }
}

export async function publishLearningEvent(record: LearningRecord): Promise<void> {
  eventBus.publish({
    id: crypto.randomUUID(),
    category: 'decision',
    type: 'outcome.learning.recorded',
    priority: 'normal',
    payload: record as unknown as Record<string, unknown>,
    timestamp: new Date().toISOString(),
  })
  await writeAuditLog({
    organization_id: 'system',
    actor_id: null,
    action_type: 'outcome:learning_recorded',
    resource_type: 'learning_record',
    resource_id: record.id,
    payload: record as unknown as Record<string, unknown>,
  })
}

export function applyFeedbackToConfidence(
  baseConfidence: number,
  learningRecords: LearningRecord[],
  scenarioType: string
): number {
  const matching = learningRecords.filter((r) => r.scenarioType === scenarioType)
  if (matching.length === 0) return Math.max(0.05, Math.min(0.95, baseConfidence))
  const meanAdj = matching.reduce((s, r) => s + r.recommendationAdjustment, 0) / matching.length
  return Math.max(0.05, Math.min(0.95, baseConfidence + meanAdj))
}
