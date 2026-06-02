import { traceColumnLineage } from '@/lib/metadata-graph/lineage-tracer'
import type { MetadataGraph } from '@/lib/metadata-graph/types'
import type { ObservabilityAlert } from '@/lib/observability/types'
import type { DependencyFailure } from './types'

export function analyzeDependencies(params: {
  columnNodeIds: string[]
  graph: MetadataGraph
  alerts: ObservabilityAlert[]
}): DependencyFailure[] {
  const { columnNodeIds, graph, alerts } = params
  const failures: DependencyFailure[] = []

  for (const nodeId of columnNodeIds) {
    const lineagePath = traceColumnLineage(nodeId, graph)
    const lineageNodeIds = new Set(lineagePath.nodes.map((n) => n.id))

    for (const alert of alerts) {
      const alertNodeId = alert.tableId
      if (!lineageNodeIds.has(alertNodeId)) continue

      let failureType: DependencyFailure['failureType']
      if (alert.category === 'schema') {
        failureType = 'schema_mismatch'
      } else if (alert.category === 'volume' && alert.severity === 'critical') {
        failureType = 'missing_data'
      } else if (alert.category === 'freshness') {
        failureType = 'stale'
      } else {
        failureType = 'quality_degradation'
      }

      const confidence =
        alert.severity === 'critical' ? 0.7
        : alert.severity === 'warning' ? 0.5
        : 0.3

      failures.push({
        nodeId: alertNodeId,
        label: alert.title,
        failureType,
        confidence,
        evidence: [alert.title, alert.message],
      })
    }
  }

  return failures
}
