import type { VolumeSnapshot } from '@/lib/observability/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  snapshot: VolumeSnapshot
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  normal: 'default',
  low: 'outline',
  high: 'secondary',
  critical: 'destructive',
}

export function VolumeCard({ snapshot }: Props) {
  const deviationColor = snapshot.deviationPercent < 0
    ? 'text-red-600'
    : snapshot.deviationPercent > 0
    ? 'text-amber-600'
    : 'text-green-600'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="truncate">{snapshot.tableId}</span>
          <Badge variant={STATUS_VARIANT[snapshot.status]}>{snapshot.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Expected</span>
          <span>{snapshot.expectedRows.toLocaleString()} rows</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Actual</span>
          <span>{snapshot.actualRows.toLocaleString()} rows</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Deviation</span>
          <span className={cn('font-medium', deviationColor)}>
            {snapshot.deviationPercent > 0 ? '+' : ''}{snapshot.deviationPercent.toFixed(1)}%
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
