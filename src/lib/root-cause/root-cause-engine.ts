import { correlateAnomalies, toCorrelationSignals } from './anomaly-correlator'
import { analyzeDependencies } from './dependency-analyzer'
import { rankCauses } from './cause-ranking'
import { narrateRootCause } from './root-cause-narrator'
import { findImpactedAssets } from '@/lib/metadata-graph/impact-analysis'
import { shortestPath } from '@/lib/metadata-graph/lineage-tracer'
import { supabase } from '@/integrations/supabase/client'
import type { MetadataGraph } from '@/lib/metadata-graph/types'
import type { SemanticAnomaly } from '@/lib/semantic/anomaly-detector'
import type { ObservabilityAlert } from '@/lib/observability/types'
import type { RootCauseAnalysis } from './types'

export async function analyzeRootCause(params: {
  triggerId: string
  triggerType: 'alert' | 'anomaly' | 'manual'
  metric?: string
  changeDescription: string
  affectedColumnIds: string[]
  columnNodeMap: Record<string, string>
  graph: MetadataGraph
  alerts: ObservabilityAlert[]
  anomalies: SemanticAnomaly[]
}): Promise<RootCauseAnalysis> {
  const {
    triggerId, triggerType, metric, changeDescription,
    affectedColumnIds, columnNodeMap, graph, alerts, anomalies,
  } = params

  // Step 1
  const correlations = correlateAnomalies({ anomalies, columnNodeMap, graph })
  const correlationSignals = toCorrelationSignals(correlations)

  // Step 2
  const dependencyFailures = analyzeDependencies({ columnNodeIds: affectedColumnIds, graph, alerts })

  // Step 3
  const rootCauses = rankCauses({ correlations, dependencyFailures, alerts, anomalies })
  const topCause = rootCauses[0]

  // Step 4
  const affectedAssets = affectedColumnIds[0]
    ? findImpactedAssets(affectedColumnIds[0], graph)
    : []

  // Step 5
  let lineagePath = null
  if (affectedColumnIds.length >= 2) {
    try {
      lineagePath = shortestPath(affectedColumnIds[0], affectedColumnIds[1], graph)
    } catch {
      lineagePath = null
    }
  }

  const confidence = topCause?.confidence ?? 0

  const analysisWithoutNarrative: Omit<RootCauseAnalysis, 'narrative' | 'id'> = {
    triggerId,
    triggerType,
    metric,
    changeDescription,
    rootCauses,
    topCause,
    affectedAssets,
    lineagePath,
    correlations: correlationSignals,
    dependencyFailures,
    confidence,
    analyzedAt: new Date().toISOString(),
  }

  const narrative = narrateRootCause(analysisWithoutNarrative)

  const analysis: RootCauseAnalysis = {
    id: crypto.randomUUID(),
    ...analysisWithoutNarrative,
    narrative,
  }

  // Step 8: audit log (non-fatal)
  try {
    await supabase.from('audit_log').insert({
      action_type: 'root_cause:analysis_completed',
      actor_type: 'system',
      resource_type: 'root_cause_analysis',
      resource_id: triggerId,
      payload: {
        analysisId: analysis.id,
        topCauseCategory: topCause?.category,
        confidence,
      },
    })
  } catch {
    // Non-fatal
  }

  return analysis
}
