import { simulateScenario } from './scenario-simulator'
import { buildRecommendationsFromScenarios, rankRecommendations } from './recommendation-ranker'
import { narrateDecision } from './decision-narrator'
import { supabase } from '@/integrations/supabase/client'
import type { Scenario, DecisionIntelligenceResult, ScenarioOutcome } from './types'
import type { RootCauseAnalysis } from '@/lib/root-cause/types'

export async function runDecisionIntelligence(params: {
  rootCause: RootCauseAnalysis
  scenarios: Scenario[]
  baselineMetrics: Record<string, number>
}): Promise<DecisionIntelligenceResult> {
  const { rootCause, scenarios, baselineMetrics } = params

  // Step 1: simulate scenarios
  const simulatedScenarios: ScenarioOutcome[] = scenarios.map((s) =>
    simulateScenario({ scenario: s, baselineMetrics })
  )

  // Step 2: build recommendations
  const rawRecs = buildRecommendationsFromScenarios({
    scenarios: simulatedScenarios,
    rootCauseCategory: rootCause.topCause.category,
    metric: rootCause.metric,
  })

  // Step 3: rank
  const recommendations = rankRecommendations(rawRecs)
  const topRecommendation = recommendations[0]

  const overallConfidence = recommendations.length > 0
    ? Math.round(
        recommendations.reduce((s, r) => s + r.confidenceScore, 0) / recommendations.length
      )
    : 0

  const result: DecisionIntelligenceResult = {
    id: crypto.randomUUID(),
    rootCauseAnalysisId: rootCause.id,
    scenarios: simulatedScenarios,
    recommendations,
    topRecommendation,
    narrative: '',
    generatedAt: new Date().toISOString(),
    overallConfidence,
  }

  result.narrative = narrateDecision(result)

  // Step 6: audit log (non-fatal)
  try {
    await supabase.from('audit_log').insert({
      action_type: 'decision_intelligence:analysis_completed',
      actor_type: 'system',
      resource_type: 'decision_intelligence',
      resource_id: rootCause.id,
      payload: {
        resultId: result.id,
        scenarioCount: scenarios.length,
        recommendationCount: recommendations.length,
        overallConfidence,
      },
    })
  } catch {
    // Non-fatal
  }

  return result
}
