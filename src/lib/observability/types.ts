export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertCategory = 'freshness' | 'volume' | 'schema' | 'quality'

export interface FreshnessStatus {
  tableId: string
  lastUpdated: string | null
  expectedRefreshHours: number
  actualAgeHours: number
  stalenessScore: number
  status: 'fresh' | 'stale' | 'unknown'
  nextExpectedRefresh: string | null
}

export interface VolumeSnapshot {
  tableId: string
  expectedRows: number
  actualRows: number
  deviationPercent: number
  status: 'normal' | 'low' | 'high' | 'critical'
  measuredAt: string
}

export interface SchemaMonitorResult {
  tableId: string
  hasChanges: boolean
  changeCount: number
  backwardCompatible: boolean
  checkedAt: string
}

export interface QualityMonitorResult {
  tableId: string
  trustGrade: string
  trustScore: number
  riskFlags: string[]
  checkedAt: string
}

export interface ObservabilityAlert {
  id: string
  tableId: string
  connectorId: string
  category: AlertCategory
  severity: AlertSeverity
  title: string
  message: string
  detectedAt: string
  resolvedAt?: string
  metadata: Record<string, unknown>
}

export interface ObservabilitySnapshot {
  connectorId: string
  tableId: string
  freshness?: FreshnessStatus
  volume?: VolumeSnapshot
  schema?: SchemaMonitorResult
  quality?: QualityMonitorResult
  alerts: ObservabilityAlert[]
  generatedAt: string
}
