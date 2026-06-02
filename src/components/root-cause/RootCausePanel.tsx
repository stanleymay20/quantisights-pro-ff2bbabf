import { Skeleton } from '@/components/ui/skeleton'
import { CauseWaterfall } from './CauseWaterfall'
import type { RootCauseAnalysis } from '@/lib/root-cause/types'

interface Props {
  analysis: RootCauseAnalysis | null
  isLoading: boolean
}

export function RootCausePanel({ analysis, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="space-y-6">
      {/* Narrative */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
        {analysis.narrative}
      </div>

      {/* Waterfall */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Probability Breakdown</h3>
        <CauseWaterfall causes={analysis.rootCauses} />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Dependency Failures</h3>
          {analysis.dependencyFailures.length === 0 ? (
            <p className="text-xs text-muted-foreground">No dependency failures detected</p>
          ) : (
            <ul className="space-y-1">
              {analysis.dependencyFailures.map((f, i) => (
                <li key={i} className="text-xs border rounded p-2">
                  <span className="font-medium">{f.label}</span>
                  <span className="ml-2 text-muted-foreground">{f.failureType}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Affected Assets</h3>
          {analysis.affectedAssets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No downstream assets affected</p>
          ) : (
            <ul className="space-y-1">
              {analysis.affectedAssets.map((a, i) => (
                <li key={i} className="text-xs border rounded p-2">
                  <span className="font-medium">{a.label}</span>
                  <span className="ml-2 text-muted-foreground">{a.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
