import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { RootCause } from '@/lib/root-cause/types'

interface Props {
  causes: RootCause[]
}

function categoryColor(category: string): string {
  switch (category) {
    case 'schema_change': return 'bg-red-500'
    case 'volume_anomaly': return 'bg-amber-500'
    case 'data_quality': return 'bg-yellow-500'
    case 'latency': return 'bg-orange-400'
    case 'external': return 'bg-purple-500'
    default: return 'bg-gray-400'
  }
}

export function CauseWaterfall({ causes }: Props) {
  return (
    <div className="space-y-2">
      {[...causes].sort((a, b) => a.rank - b.rank).map((cause) => (
        <Card key={cause.id} className="p-3">
          <CardContent className="p-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-5">#{cause.rank}</span>
              <span className="text-sm font-medium flex-1 truncate" title={cause.hypothesis}>
                {cause.hypothesis.length > 60
                  ? cause.hypothesis.slice(0, 60) + '…'
                  : cause.hypothesis}
              </span>
              <Badge variant="outline" className="text-xs">{cause.category}</Badge>
            </div>
            <div className="flex items-center gap-2 pl-7">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${categoryColor(cause.category)}`}
                  style={{ width: `${Math.round(cause.probability * 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right">
                {Math.round(cause.probability * 100)}%
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
