import type { ObservabilityAlert } from '@/lib/observability/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  alerts: ObservabilityAlert[]
  onDismiss?: (id: string) => void
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }
const SEVERITY_COLORS = {
  critical: 'border-l-red-500 bg-red-50 dark:bg-red-950/20',
  warning: 'border-l-amber-500 bg-amber-50 dark:bg-amber-950/20',
  info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
}
const BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  critical: 'destructive',
  warning: 'secondary',
  info: 'outline',
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function AlertFeed({ alerts, onDismiss }: Props) {
  const sorted = [...alerts].sort((a, b) => {
    const sd = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sd !== 0) return sd
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  })

  if (sorted.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">No alerts.</div>
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-[400px]">
      {sorted.map(alert => (
        <div
          key={alert.id}
          className={cn('border-l-4 rounded p-3 flex items-start gap-2', SEVERITY_COLORS[alert.severity])}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={BADGE_VARIANTS[alert.severity]} className="text-xs">{alert.severity}</Badge>
              <Badge variant="outline" className="text-xs">{alert.category}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">{timeAgo(alert.detectedAt)}</span>
            </div>
            <p className="text-sm font-medium">{alert.title}</p>
            <p className="text-xs text-muted-foreground">{alert.message}</p>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => onDismiss(alert.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
