import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ActionRecommendation } from '@/lib/decision-intelligence/types'

interface Props {
  recommendation: ActionRecommendation
  isTop?: boolean
}

const riskColors: Record<string, string> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
}

const gradeColors: Record<string, string> = {
  A: 'text-green-600',
  B: 'text-blue-600',
  C: 'text-yellow-600',
  D: 'text-orange-600',
  F: 'text-red-600',
}

export function RecommendationCard({ recommendation: r, isTop = false }: Props) {
  return (
    <Card className={isTop ? 'border-primary border-2' : ''}>
      <CardHeader className="pb-2 flex flex-row items-start gap-3">
        <span className="text-lg font-bold text-primary">#{r.rank}</span>
        <div className="flex-1">
          <p className="text-sm font-semibold">{r.action}</p>
          <p className="text-xs text-muted-foreground mt-1">{r.expectedImpactLabel}</p>
        </div>
        <Badge variant={riskColors[r.riskLevel] as 'destructive' | 'secondary' | 'outline'}>
          {r.riskLevel} risk
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><span className="text-muted-foreground">Confidence:</span> <strong>{r.confidenceScore}%</strong></div>
          <div><span className="text-muted-foreground">Owner:</span> <strong>{r.owner}</strong></div>
          <div><span className="text-muted-foreground">Timeline:</span> <strong>{r.timelineLabel}</strong></div>
          <div><span className="text-muted-foreground">Cost of delay:</span> <strong>{r.costOfDelayLabel}</strong></div>
          <div>
            <span className="text-muted-foreground">Quality grade: </span>
            <strong className={gradeColors[r.qualityScore.grade]}>{r.qualityScore.grade}</strong>
          </div>
        </div>
        {r.successMetrics.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Success metrics:</p>
            <div className="flex flex-wrap gap-1">
              {r.successMetrics.map((m, i) => (
                <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
