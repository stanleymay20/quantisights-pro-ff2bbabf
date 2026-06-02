import { Skeleton } from '@/components/ui/skeleton'
import { ForecastCard } from './ForecastCard'
import type { IntelligenceForecast, PredictionResult } from '@/lib/intelligence/types'

interface Props {
  forecast: IntelligenceForecast | null
  isLoading: boolean
}

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

export function IntelligenceFeed({ forecast, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    )
  }
  if (!forecast) return null

  const sorted: PredictionResult[] = [...forecast.predictions].sort((a, b) => {
    const so = (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
    if (so !== 0) return so
    return b.probability - a.probability
  })

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex gap-4 p-3 bg-muted rounded-lg text-sm">
        <div><span className="text-muted-foreground">Coverage: </span><strong>{forecast.coverageScore}%</strong></div>
        <div><span className="text-muted-foreground">High-risk: </span><strong className="text-red-600">{forecast.highRiskPredictions.length}</strong></div>
        <div><span className="text-muted-foreground">Total: </span><strong>{forecast.predictions.length}</strong></div>
      </div>
      <div className="space-y-2">
        {sorted.map((p) => <ForecastCard key={p.id} prediction={p} />)}
      </div>
    </div>
  )
}
