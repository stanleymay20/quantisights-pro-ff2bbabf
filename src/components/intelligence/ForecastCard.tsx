import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PredictionResult } from '@/lib/intelligence/types'

interface Props {
  prediction: PredictionResult
}

const targetIcon: Record<string, string> = {
  freshness_failure: 'FRESH',
  schema_drift: 'SCHEMA',
  volume_anomaly: 'VOL',
  quality_degradation: 'QUAL',
  kpi_change: 'KPI',
}

function probColor(p: number): string {
  if (p > 0.6) return 'text-red-600'
  if (p > 0.4) return 'text-amber-600'
  return 'text-green-600'
}

const severityVariant: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
}

export function ForecastCard({ prediction: p }: Props) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-start gap-3">
          <div className="text-xs font-bold bg-muted px-2 py-1 rounded">
            {targetIcon[p.target] ?? p.target.toUpperCase()}
          </div>
          <div className="flex-1">
            <div className={`text-2xl font-bold ${probColor(p.probability)}`}>
              {Math.round(p.probability * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">{p.metricName ?? p.tableId}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={severityVariant[p.severity] ?? 'outline'}>{p.severity}</Badge>
            <Badge variant="outline" className="text-xs">{p.horizon}</Badge>
          </div>
        </div>
        {p.evidence.length > 0 && (
          <ul className="text-xs text-muted-foreground list-disc list-inside">
            {p.evidence.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
        <p className="text-xs italic text-muted-foreground">{p.recommendation}</p>
      </CardContent>
    </Card>
  )
}
