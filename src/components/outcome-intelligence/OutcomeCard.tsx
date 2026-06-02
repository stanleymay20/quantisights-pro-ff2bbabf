import React from 'react'
import type { OutcomeRecord } from '@/lib/outcome-intelligence/types'

const outcomeColors: Record<OutcomeRecord['outcome'], string> = {
  better_than_expected: 'bg-green-100 text-green-700',
  as_expected: 'bg-blue-100 text-blue-700',
  worse_than_expected: 'bg-red-100 text-red-700',
  not_measured: 'bg-gray-100 text-gray-600',
}

const outcomeLabels: Record<OutcomeRecord['outcome'], string> = {
  better_than_expected: 'Better than expected',
  as_expected: 'As expected',
  worse_than_expected: 'Worse than expected',
  not_measured: 'Not measured',
}

interface OutcomeCardProps {
  outcome: OutcomeRecord
}

export function OutcomeCard({ outcome }: OutcomeCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-2 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{outcome.predictedMetric}</p>
          <p className="text-xs text-muted-foreground">Decision: {outcome.decisionId.slice(0, 8)}…</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${outcomeColors[outcome.outcome]}`}>
          {outcomeLabels[outcome.outcome]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Predicted</p>
          <p className="font-medium">{outcome.predictedValue}</p>
        </div>
        {outcome.actualValue !== undefined ? (
          <div>
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="font-medium">{outcome.actualValue}</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-muted-foreground">Actual</p>
            <p className="text-muted-foreground">—</p>
          </div>
        )}
      </div>

      {outcome.deviationPercent !== undefined && (
        <div className="text-xs text-muted-foreground">
          Deviation: {outcome.deviationPercent > 0 ? '+' : ''}{outcome.deviationPercent.toFixed(1)}%
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Window: {outcome.measurementWindowDays} days
      </div>
    </div>
  )
}
