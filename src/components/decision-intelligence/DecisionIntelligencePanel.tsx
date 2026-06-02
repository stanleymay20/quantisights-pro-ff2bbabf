import { Skeleton } from '@/components/ui/skeleton'
import { RecommendationCard } from './RecommendationCard'
import { ScenarioComparison } from './ScenarioComparison'
import type { DecisionIntelligenceResult } from '@/lib/decision-intelligence/types'

interface Props {
  result: DecisionIntelligenceResult | null
  isLoading: boolean
}

export function DecisionIntelligencePanel({ result, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    )
  }
  if (!result) return null

  return (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
        {result.narrative}
      </div>
      <div>
        <h3 className="text-sm font-semibold mb-2">Top Recommendation</h3>
        <RecommendationCard recommendation={result.topRecommendation} isTop />
      </div>
      {result.scenarios.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Scenario Comparison</h3>
          <ScenarioComparison scenarios={result.scenarios} />
        </div>
      )}
      <div>
        <h3 className="text-sm font-semibold mb-2">All Recommendations</h3>
        <div className="space-y-2">
          {result.recommendations.map((r) => (
            <RecommendationCard key={r.id} recommendation={r} />
          ))}
        </div>
      </div>
    </div>
  )
}
