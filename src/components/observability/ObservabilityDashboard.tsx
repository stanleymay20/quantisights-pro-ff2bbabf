import { useEffect, useState, useCallback } from 'react'
import type { ObservabilityAlert } from '@/lib/observability/types'
import { observabilityService } from '@/lib/observability/observability-service'
import { AlertFeed } from './AlertFeed'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

interface Props {
  connectorId: string
}

export function ObservabilityDashboard({ connectorId }: Props) {
  const [alerts, setAlerts] = useState<ObservabilityAlert[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const history = await observabilityService.loadAlertHistory(connectorId)
    setAlerts(history)
    setLoading(false)
  }, [connectorId])

  useEffect(() => { load() }, [load])

  const critical = alerts.filter(a => a.severity === 'critical').length
  const warning = alerts.filter(a => a.severity === 'warning').length
  const info = alerts.filter(a => a.severity === 'info').length

  const handleDismiss = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Card className="px-3 py-2 min-w-[80px]">
            <CardContent className="p-0 text-center">
              <p className="text-2xl font-bold text-red-600">{critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </CardContent>
          </Card>
          <Card className="px-3 py-2 min-w-[80px]">
            <CardContent className="p-0 text-center">
              <p className="text-2xl font-bold text-amber-600">{warning}</p>
              <p className="text-xs text-muted-foreground">Warning</p>
            </CardContent>
          </Card>
          <Card className="px-3 py-2 min-w-[80px]">
            <CardContent className="p-0 text-center">
              <p className="text-2xl font-bold text-blue-600">{info}</p>
              <p className="text-xs text-muted-foreground">Info</p>
            </CardContent>
          </Card>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Alert Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertFeed alerts={alerts} onDismiss={handleDismiss} />
        </CardContent>
      </Card>
    </div>
  )
}
