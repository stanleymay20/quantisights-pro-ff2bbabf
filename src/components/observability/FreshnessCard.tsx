import type { FreshnessStatus } from '@/lib/observability/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface Props {
  status: FreshnessStatus
}

export function FreshnessCard({ status }: Props) {
  const barColor = status.stalenessScore < 30
    ? 'bg-green-500'
    : status.stalenessScore < 70
    ? 'bg-amber-500'
    : 'bg-red-500'

  const badgeVariant = status.status === 'fresh' ? 'default' : status.status === 'stale' ? 'destructive' : 'secondary'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="truncate">{status.tableId}</span>
          <Badge variant={badgeVariant}>{status.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Last updated: {status.lastUpdated ? new Date(status.lastUpdated).toLocaleString() : 'Unknown'}
        </div>
        <div className="text-xs">
          Age: {status.actualAgeHours.toFixed(1)}h / Expected every {status.expectedRefreshHours}h
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Staleness</span>
            <span>{status.stalenessScore}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className={cn('h-full transition-all', barColor)} style={{ width: `${status.stalenessScore}%` }} />
          </div>
        </div>
        {status.nextExpectedRefresh && (
          <div className="text-xs text-muted-foreground">
            Next expected: {new Date(status.nextExpectedRefresh).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
