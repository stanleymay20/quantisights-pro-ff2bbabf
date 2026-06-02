import type { FreshnessStatus, VolumeSnapshot, SchemaMonitorResult, QualityMonitorResult, ObservabilityAlert, AlertSeverity } from './types'

function makeAlert(params: {
  connectorId: string
  tableId: string
  category: ObservabilityAlert['category']
  severity: AlertSeverity
  title: string
  message: string
  metadata?: Record<string, unknown>
}): ObservabilityAlert {
  return {
    id: crypto.randomUUID(),
    tableId: params.tableId,
    connectorId: params.connectorId,
    category: params.category,
    severity: params.severity,
    title: params.title,
    message: params.message,
    detectedAt: new Date().toISOString(),
    metadata: params.metadata ?? {},
  }
}

export function generateAlerts(params: {
  connectorId: string
  tableId: string
  freshness?: FreshnessStatus
  volume?: VolumeSnapshot
  schema?: SchemaMonitorResult
  quality?: QualityMonitorResult
}): ObservabilityAlert[] {
  const { connectorId, tableId, freshness, volume, schema, quality } = params
  const alerts: ObservabilityAlert[] = []

  if (freshness) {
    if (freshness.status === 'stale') {
      const severity: AlertSeverity = freshness.stalenessScore > 75 ? 'critical' : 'warning'
      alerts.push(makeAlert({
        connectorId, tableId, category: 'freshness', severity,
        title: 'Stale data detected',
        message: `Table ${tableId} is ${freshness.actualAgeHours.toFixed(1)}h old (expected refresh every ${freshness.expectedRefreshHours}h). Staleness score: ${freshness.stalenessScore}.`,
        metadata: { stalenessScore: freshness.stalenessScore },
      }))
    }
  }

  if (volume) {
    if (volume.status === 'critical') {
      alerts.push(makeAlert({
        connectorId, tableId, category: 'volume', severity: 'critical',
        title: 'Critical volume deviation',
        message: `Table ${tableId} has ${volume.actualRows} rows vs expected ${volume.expectedRows} (${volume.deviationPercent.toFixed(1)}% deviation).`,
        metadata: { deviationPercent: volume.deviationPercent },
      }))
    } else if (volume.status === 'low' || volume.status === 'high') {
      alerts.push(makeAlert({
        connectorId, tableId, category: 'volume', severity: 'warning',
        title: `Volume ${volume.status}`,
        message: `Table ${tableId} has ${volume.actualRows} rows vs expected ${volume.expectedRows} (${volume.deviationPercent.toFixed(1)}% deviation).`,
        metadata: { deviationPercent: volume.deviationPercent },
      }))
    }
  }

  if (schema && schema.hasChanges) {
    const severity: AlertSeverity = schema.backwardCompatible ? 'warning' : 'critical'
    alerts.push(makeAlert({
      connectorId, tableId, category: 'schema', severity,
      title: schema.backwardCompatible ? 'Schema changed (compatible)' : 'Breaking schema change',
      message: `Table ${tableId} has ${schema.changeCount} schema change(s). Backward compatible: ${schema.backwardCompatible}.`,
      metadata: { changeCount: schema.changeCount, backwardCompatible: schema.backwardCompatible },
    }))
  }

  if (quality) {
    if (quality.trustScore < 50) {
      alerts.push(makeAlert({
        connectorId, tableId, category: 'quality', severity: 'critical',
        title: 'Critical data quality issue',
        message: `Table ${tableId} trust score is ${quality.trustScore} (grade ${quality.trustGrade}).`,
        metadata: { trustScore: quality.trustScore, trustGrade: quality.trustGrade },
      }))
    } else if (quality.trustScore < 70) {
      alerts.push(makeAlert({
        connectorId, tableId, category: 'quality', severity: 'warning',
        title: 'Data quality below threshold',
        message: `Table ${tableId} trust score is ${quality.trustScore} (grade ${quality.trustGrade}).`,
        metadata: { trustScore: quality.trustScore, trustGrade: quality.trustGrade },
      }))
    }
  }

  return alerts
}
