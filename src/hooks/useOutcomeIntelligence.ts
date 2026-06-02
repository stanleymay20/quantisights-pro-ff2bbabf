import { useState, useCallback } from 'react'
import {
  getRecentOutcomes,
  updateOutcomeWithActual,
} from '@/lib/outcome-intelligence/decision-outcome-tracker'
import {
  verifyRecommendation,
} from '@/lib/outcome-intelligence/recommendation-verifier'
import {
  aggregateSummary,
  publishLearningEvent,
  extractLearningRecord,
} from '@/lib/outcome-intelligence/feedback-loop'
import type { OutcomeRecord, OutcomeIntelligenceSummary } from '@/lib/outcome-intelligence/types'

export function useOutcomeIntelligence(organizationId: string | null): {
  recentOutcomes: OutcomeRecord[]
  summary: OutcomeIntelligenceSummary | null
  isLoading: boolean
  loadOutcomes: () => Promise<void>
  recordActualValue: (outcomeId: string, actualValue: number, actualImpact: string) => Promise<void>
  refreshSummary: () => void
} {
  const [recentOutcomes, setRecentOutcomes] = useState<OutcomeRecord[]>([])
  const [summary, setSummary] = useState<OutcomeIntelligenceSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loadOutcomes = useCallback(async () => {
    if (!organizationId) return
    setIsLoading(true)
    try {
      const outcomes = await getRecentOutcomes(organizationId, 20)
      setRecentOutcomes(outcomes)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  const recordActualValue = useCallback(
    async (outcomeId: string, actualValue: number, actualImpact: string) => {
      const updated = await updateOutcomeWithActual({ outcomeId, actualValue, actualImpact })
      setRecentOutcomes((prev) =>
        prev.map((o) => (o.id === outcomeId ? updated : o))
      )
    },
    []
  )

  const refreshSummary = useCallback(() => {
    if (!organizationId || recentOutcomes.length === 0) return
    // Group outcomes by decision and create verifications
    const byDecision = recentOutcomes.reduce<Record<string, OutcomeRecord[]>>((acc, o) => {
      if (!acc[o.decisionId]) acc[o.decisionId] = []
      acc[o.decisionId].push(o)
      return acc
    }, {})

    const verifications = Object.entries(byDecision).map(([decisionId, outcomes]) =>
      verifyRecommendation({
        recommendationId: outcomes[0].recommendationId,
        decisionId,
        wasFollowed: true,
        outcomes,
      })
    )

    const learningRecords = verifications.map((v) =>
      extractLearningRecord({
        verification: v,
        scenarioType: 'general',
        rootCauseCategory: 'unknown',
        recommendedAction: v.recommendationId,
      })
    )

    const s = aggregateSummary({ organizationId, verifications, learningRecords })
    setSummary(s)

    learningRecords.forEach((lr) => publishLearningEvent(lr).catch(() => {}))
  }, [organizationId, recentOutcomes])

  return { recentOutcomes, summary, isLoading, loadOutcomes, recordActualValue, refreshSummary }
}
