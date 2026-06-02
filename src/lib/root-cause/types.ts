import type { ImpactedAsset, LineagePath } from '@/lib/metadata-graph/types'

export type RootCauseCategory =
  | 'data_quality' | 'schema_change' | 'volume_anomaly'
  | 'latency' | 'external' | 'unknown'

export interface RootCause {
  id: string
  hypothesis: string
  probability: number        // 0–1, normalized so all sum ≤ 1
  confidence: number         // 0–0.95 epistemic cap
  evidence: string[]
  affectedAssets: string[]   // nodeIds
  category: RootCauseCategory
  rank: number               // 1 = most likely
}

export interface CorrelationSignal {
  nodeId: string
  columnName: string
  correlationStrength: number   // 0–1
  anomalyKind: string
  temporalLag: number           // estimated lag in hours
}

export interface DependencyFailure {
  nodeId: string
  label: string
  failureType: 'missing_data' | 'schema_mismatch' | 'stale' | 'quality_degradation'
  confidence: number
  evidence: string[]
}

export interface RootCauseAnalysis {
  id: string
  triggerId: string
  triggerType: 'alert' | 'anomaly' | 'manual'
  metric?: string
  changeDescription: string
  rootCauses: RootCause[]
  topCause: RootCause
  affectedAssets: ImpactedAsset[]
  lineagePath: LineagePath | null
  correlations: CorrelationSignal[]
  dependencyFailures: DependencyFailure[]
  narrative: string
  confidence: number
  analyzedAt: string
}
