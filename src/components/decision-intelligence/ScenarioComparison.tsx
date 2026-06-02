import type { ScenarioOutcome } from '@/lib/decision-intelligence/types'

interface Props {
  scenarios: ScenarioOutcome[]
}

function deltaColor(v: number): string {
  if (v > 0.01) return 'bg-green-100 text-green-800'
  if (v < -0.01) return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-700'
}

export function ScenarioComparison({ scenarios }: Props) {
  if (scenarios.length === 0) return null

  const allMetrics = Array.from(
    new Set(scenarios.flatMap((s) => Object.keys(s.predictedChanges)))
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left p-2 bg-muted font-semibold border">Metric</th>
            {scenarios.map((s) => (
              <th key={s.scenarioId} className="p-2 bg-muted font-semibold border text-center">
                {s.scenarioName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allMetrics.map((metric) => (
            <tr key={metric}>
              <td className="p-2 border font-medium">{metric}</td>
              {scenarios.map((s) => {
                const v = s.predictedChanges[metric]
                return (
                  <td key={s.scenarioId} className={`p-2 border text-center ${v != null ? deltaColor(v) : ''}`}>
                    {v != null
                      ? `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
          <tr className="bg-muted/50">
            <td className="p-2 border font-semibold">Confidence</td>
            {scenarios.map((s) => (
              <td key={s.scenarioId} className="p-2 border text-center font-semibold">
                {Math.round(s.confidence * 100)}%
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
