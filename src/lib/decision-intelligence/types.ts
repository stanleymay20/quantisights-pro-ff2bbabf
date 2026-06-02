import type { RootCauseAnalysis } from '@/lib/root-cause/types'
import type { DecisionQualityScore } from '@/lib/evidence-contract'

export type { RootCauseAnalysis }

export interface Scenario {
  id: string
  name: string
  description: string
  assumptions: string[]
  inputChanges: Record<string, number>   // metric key → fractional delta (e.g. 0.2 = +20%)
}

export interface ScenarioOutcome {
  scenarioId: string
  scenarioName: string
  predictedChanges: Record<string, number>   // metric → predicted fractional delta
  confidence: number                          // 0–0.85 (epistemic cap)
  riskLevel: 'low' | 'medium' | 'high'
  expectedImpactLabel: string
  timeHorizonDays: number
  assumptions: string[]
}

export interface ActionRecommendation {
  id: string
  action: string
  rationale: string
  expectedImpactLabel: string
  confidenceScore: number       // 0–100
  riskLevel: 'low' | 'medium' | 'high'
  costOfDelayLabel: string
  owner: string
  timelineLabel: string
  successMetrics: string[]
  scenarioOutcome: ScenarioOutcome
  qualityScore: DecisionQualityScore
  rank: number
  compositeScore: number
}

export interface DecisionIntelligenceResult {
  id: string
  rootCauseAnalysisId: string
  scenarios: ScenarioOutcome[]
  recommendations: ActionRecommendation[]
  topRecommendation: ActionRecommendation
  narrative: string
  generatedAt: string
  overallConfidence: number
}
