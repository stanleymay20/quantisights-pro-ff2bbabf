import { findUpstreamSources } from '@/lib/metadata-graph/impact-analysis'
import type { MetadataGraph, ImpactedAsset } from '@/lib/metadata-graph/types'
import type { SemanticAnomaly } from '@/lib/semantic/anomaly-detector'
import type { CorrelationSignal } from './types'

export interface AnomalyCorrelation {
  nodeId: string
  columnName: string
  upstreamSources: ImpactedAsset[]
  anomaly: SemanticAnomaly
}

export function correlateAnomalies(params: {
  anomalies: SemanticAnomaly[]
  columnNodeMap: Record<string, string>  // column name → nodeId
  graph: MetadataGraph
}): AnomalyCorrelation[] {
  const { anomalies, columnNodeMap, graph } = params
  return anomalies.map((anomaly) => {
    const nodeId = columnNodeMap[anomaly.column]
    const upstreamSources = nodeId ? findUpstreamSources(nodeId, graph) : []
    return {
      nodeId: nodeId ?? '',
      columnName: anomaly.column,
      upstreamSources,
      anomaly,
    }
  })
}

export function toCorrelationSignals(correlations: AnomalyCorrelation[]): CorrelationSignal[] {
  const severityMap: Record<string, number> = {
    critical: 0.9,
    high: 0.75,
    medium: 0.5,
    low: 0.25,
    info: 0.1,
  }
  return correlations.map((c) => ({
    nodeId: c.nodeId,
    columnName: c.columnName,
    correlationStrength: severityMap[c.anomaly.severity] ?? 0.1,
    anomalyKind: c.anomaly.kind,
    temporalLag: 0,
  }))
}
