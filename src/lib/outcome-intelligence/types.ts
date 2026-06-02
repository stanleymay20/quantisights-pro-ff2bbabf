export interface OutcomeRecord {
  id: string
  decisionId: string
  recommendationId: string
  organizationId: string
  predictedImpact: string
  actualImpact?: string
  predictedMetric: string
  predictedValue: number
  actualValue?: number
  deviationPercent?: number
  outcome: 'better_than_expected' | 'as_expected' | 'worse_than_expected' | 'not_measured'
  measurementWindowDays: number
  measuredAt?: string
  verifiedAt?: string
  notes?: string
  createdAt: string
}

export interface RecommendationVerification {
  recommendationId: string
  decisionId: string
  wasFollowed: boolean
  outcomeRecords: OutcomeRecord[]
  averageDeviation: number
  accuracyScore: number
  calibrationStatus: 'well_calibrated' | 'overconfident' | 'underconfident' | 'insufficient_data'
  verifiedAt: string
}

export interface FeedbackSignal {
  id: string
  source: 'outcome_record' | 'user_override' | 'automated_measurement'
  recommendationId: string
  signal: 'positive' | 'negative' | 'neutral'
  weight: number
  evidence: string
  recordedAt: string
}

export interface LearningRecord {
  id: string
  scenarioType: string
  rootCauseCategory: string
  recommendedAction: string
  outcome: 'success' | 'partial' | 'failure'
  outcomeDeviation: number
  lessonsLearned: string[]
  recommendationAdjustment: number
  recordedAt: string
}

export interface OutcomeIntelligenceSummary {
  organizationId: string
  totalDecisions: number
  measuredDecisions: number
  averageAccuracy: number
  wellCalibratedCount: number
  overconfidentCount: number
  underconfidentCount: number
  topSuccessPatterns: string[]
  topFailurePatterns: string[]
  generatedAt: string
}
