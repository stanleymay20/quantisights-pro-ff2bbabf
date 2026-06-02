export type PredictionTarget =
  | 'freshness_failure' | 'schema_drift' | 'volume_anomaly'
  | 'quality_degradation' | 'kpi_change'

export type PredictionHorizon = 'next_24h' | 'next_7d' | 'next_30d'

export interface PredictionResult {
  id: string
  target: PredictionTarget
  tableId?: string
  metricName?: string
  probability: number        // 0–1
  confidence: number         // 0–0.95
  predictedAt: string
  horizon: PredictionHorizon
  evidence: string[]
  recommendation: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface IntelligenceForecast {
  id: string
  connectorId: string
  predictions: PredictionResult[]
  highRiskPredictions: PredictionResult[]
  generatedAt: string
  coverageScore: number
  summaryLabel: string
}

export interface TableObservationHistory {
  tableId: string
  freshnessHistory?: Array<{ timestamp: string; stalenessScore: number }>
  volumeHistory?: Array<{ timestamp: string; rowCount: number }>
  changeHistory?: Array<{ timestamp: string; changeCount: number }>
  expectedRefreshHours?: number
  expectedRows?: number
}

export interface KPIHistory {
  metricName: string
  recentValues: number[]
  horizon: PredictionHorizon
}
