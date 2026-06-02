import { useState, useEffect } from 'react'
import { metadataCatalog } from '@/lib/catalog/metadata-catalog'
import { observabilityService } from '@/lib/observability/observability-service'
import { checkFreshness } from '@/lib/observability/freshness-monitor'
import { checkVolumeDeviation } from '@/lib/observability/volume-monitor'
import type { FreshnessStatus, VolumeSnapshot, ObservabilityAlert } from '@/lib/observability/types'
import { FreshnessCard } from '@/components/observability/FreshnessCard'
import { VolumeCard } from '@/components/observability/VolumeCard'
import { AlertFeed } from '@/components/observability/AlertFeed'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function ObservabilityDashboardPage() {
  const catalog = metadataCatalog.getSnapshot()
  const connectors = catalog.databases.map(db => db.connectorId)
  const [selectedConnector, setSelectedConnector] = useState<string | null>(connectors[0] ?? null)
  const [alerts, setAlerts] = useState<ObservabilityAlert[]>([])
  const [freshnessStatuses, setFreshnessStatuses] = useState<FreshnessStatus[]>([])
  const [volumeSnapshots, setVolumeSnapshots] = useState<VolumeSnapshot[]>([])

  useEffect(() => {
    if (!selectedConnector) return
    observabilityService.loadAlertHistory(selectedConnector).then(setAlerts)

    const db = catalog.databases.find(d => d.connectorId === selectedConnector)
    const tables = db?.schemas.flatMap(s => s.tables) ?? []
    const freshness = tables.map(t => checkFreshness({
      tableId: t.tableId,
      lastUpdated: t.discoveredAt,
      expectedRefreshHours: 24,
    }))
    const volumes = tables.map(t => checkVolumeDeviation({
      tableId: t.tableId,
      expectedRows: t.rowCount ?? 1000,
      actualRows: t.rowCount ?? 1000,
    }))
    setFreshnessStatuses(freshness)
    setVolumeSnapshots(volumes)
  }, [selectedConnector])

  const critical = alerts.filter(a => a.severity === 'critical').length
  const warning = alerts.filter(a => a.severity === 'warning').length
  const info = alerts.filter(a => a.severity === 'info').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Observability</h1>
        {connectors.length > 0 && (
          <Select value={selectedConnector ?? ''} onValueChange={setSelectedConnector}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select connector" />
            </SelectTrigger>
            <SelectContent>
              {connectors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex gap-3">
        {[
          { label: 'Total', count: alerts.length, cls: 'text-foreground' },
          { label: 'Critical', count: critical, cls: 'text-red-600' },
          { label: 'Warning', count: warning, cls: 'text-amber-600' },
          { label: 'Info', count: info, cls: 'text-blue-600' },
        ].map(({ label, count, cls }) => (
          <Card key={label} className="px-4 py-2">
            <CardContent className="p-0 text-center">
              <p className={`text-2xl font-bold ${cls}`}>{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {freshnessStatuses.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Freshness</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {freshnessStatuses.map(s => <FreshnessCard key={s.tableId} status={s} />)}
          </div>
        </div>
      )}

      {volumeSnapshots.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2">Volume</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {volumeSnapshots.map(s => <VolumeCard key={s.tableId} snapshot={s} />)}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-2">Alert Feed</h2>
        <AlertFeed alerts={alerts} onDismiss={id => setAlerts(prev => prev.filter(a => a.id !== id))} />
      </div>
    </div>
  )
}
