import type { ObservabilitySnapshot, ObservabilityAlert } from './types'
import { checkFreshness } from './freshness-monitor'
import { checkVolumeDeviation } from './volume-monitor'
import { generateAlerts } from './alert-engine'
import { supabase } from '@/integrations/supabase/client'

class ObservabilityService {
  async runMonitors(params: {
    connectorId: string
    tableId: string
    lastUpdated?: string | null
    expectedRefreshHours?: number
    expectedRows?: number
    actualRows?: number
  }): Promise<ObservabilitySnapshot> {
    const { connectorId, tableId } = params

    const freshness = (params.lastUpdated !== undefined)
      ? checkFreshness({
          tableId,
          lastUpdated: params.lastUpdated ?? null,
          expectedRefreshHours: params.expectedRefreshHours ?? 24,
        })
      : undefined

    const volume = (params.expectedRows !== undefined && params.actualRows !== undefined)
      ? checkVolumeDeviation({
          tableId,
          expectedRows: params.expectedRows,
          actualRows: params.actualRows,
        })
      : undefined

    const alerts = generateAlerts({ connectorId, tableId, freshness, volume })

    return {
      connectorId,
      tableId,
      freshness,
      volume,
      alerts,
      generatedAt: new Date().toISOString(),
    }
  }

  async persistAlerts(alerts: ObservabilityAlert[]): Promise<void> {
    try {
      for (const alert of alerts) {
        await supabase.from('audit_log').insert({
          action_type: `observability:${alert.category}:${alert.severity}`,
          resource_type: 'table',
          resource_id: alert.tableId,
          metadata: {
            alert_id: alert.id,
            connectorId: alert.connectorId,
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            category: alert.category,
            detectedAt: alert.detectedAt,
            ...alert.metadata,
          },
        })
      }
    } catch {
      // non-fatal
    }
  }

  async loadAlertHistory(connectorId: string, limit = 100): Promise<ObservabilityAlert[]> {
    try {
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .like('action_type', 'observability:%')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!data) return []

      return data
        .filter(row => (row.metadata as Record<string, unknown>)?.connectorId === connectorId)
        .map(row => {
          const meta = row.metadata as Record<string, unknown>
          return {
            id: (meta.alert_id as string) || row.id,
            tableId: row.resource_id || '',
            connectorId: (meta.connectorId as string) || connectorId,
            category: ((meta.category as string) || 'freshness') as ObservabilityAlert['category'],
            severity: ((meta.severity as string) || 'info') as ObservabilityAlert['severity'],
            title: (meta.title as string) || '',
            message: (meta.message as string) || '',
            detectedAt: (meta.detectedAt as string) || row.created_at || new Date().toISOString(),
            metadata: meta,
          }
        })
    } catch {
      return []
    }
  }
}

export const observabilityService = new ObservabilityService()
