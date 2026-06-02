import type { AnomalyCorrelation } from './anomaly-correlator'
import type { DependencyFailure, RootCause, RootCauseCategory } from './types'
import type { ObservabilityAlert } from '@/lib/observability/types'
import type { SemanticAnomaly } from '@/lib/semantic/anomaly-detector'

export function rankCauses(params: {
  correlations: AnomalyCorrelation[]
  dependencyFailures: DependencyFailure[]
  alerts: ObservabilityAlert[]
  anomalies: SemanticAnomaly[]
}): RootCause[] {
  const { correlations: _correlations, dependencyFailures, alerts, anomalies } = params

  const scores: Record<string, number> = {
    schema_change: 0,
    volume_anomaly: 0,
    data_quality: 0,
    latency: 0,
  }

  // Evidence collections
  const evidence: Record<string, string[]> = {
    schema_change: [],
    volume_anomaly: [],
    data_quality: [],
    latency: [],
  }

  // Step 2: score from alerts
  for (const alert of alerts) {
    if (alert.category === 'schema') {
      const backwardCompat = (alert.metadata as Record<string, unknown>)?.backwardCompatible
      if (!backwardCompat) {
        scores.schema_change += 0.35
      } else {
        scores.schema_change += 0.15
      }
      evidence.schema_change.push(alert.title)
    } else if (alert.category === 'volume') {
      if (alert.severity === 'critical') {
        scores.volume_anomaly += 0.30
      } else {
        scores.volume_anomaly += 0.15
      }
      evidence.volume_anomaly.push(alert.title)
    } else if (alert.category === 'freshness') {
      if (alert.severity === 'critical') {
        scores.latency += 0.20
      } else {
        scores.latency += 0.10
      }
      evidence.latency.push(alert.title)
    } else if (alert.category === 'quality') {
      if (alert.severity === 'critical') {
        scores.data_quality += 0.25
      } else {
        scores.data_quality += 0.15
      }
      evidence.data_quality.push(alert.title)
    }
  }

  // Step 3: dependency failures
  for (const failure of dependencyFailures) {
    const catMap: Record<string, string> = {
      schema_mismatch: 'schema_change',
      missing_data: 'volume_anomaly',
      stale: 'latency',
      quality_degradation: 'data_quality',
    }
    const cat = catMap[failure.failureType]
    if (cat) {
      scores[cat] += 0.10
      evidence[cat].push(...failure.evidence)
    }
  }

  // Step 4: anomalies
  for (const anomaly of anomalies) {
    if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
      scores.data_quality += 0.08
      evidence.data_quality.push(anomaly.explanation)
    }
  }

  // Step 5: normalize
  const total = Object.values(scores).reduce((s, v) => s + v, 0)
  const causes: RootCause[] = []

  for (const [cat, score] of Object.entries(scores)) {
    if (total > 0) {
      const prob = Math.min(0.95, score / total)
      if (prob >= 0.05) {
        causes.push({
          id: crypto.randomUUID(),
          hypothesis: hypothesisFor(cat as RootCauseCategory),
          probability: prob,
          confidence: 0,
          evidence: [...new Set(evidence[cat])],
          affectedAssets: [],
          category: cat as RootCauseCategory,
          rank: 0,
        })
      }
    }
  }

  // Step 7: add unknown if total probability too low
  const sumProb = causes.reduce((s, c) => s + c.probability, 0)
  if (sumProb < 0.5) {
    causes.push({
      id: crypto.randomUUID(),
      hypothesis: 'Unknown root cause — insufficient signal',
      probability: Math.max(0, 1 - sumProb),
      confidence: 0,
      evidence: ['No matching alert categories found'],
      affectedAssets: [],
      category: 'unknown',
      rank: 0,
    })
  }

  // Step 8: sort and rank
  causes.sort((a, b) => b.probability - a.probability)
  const alertCount = alerts.length
  const uncertaintyFactor = 1 / (1 + alertCount)
  const confidence = Math.max(0, 0.95 - 0.1 * uncertaintyFactor)

  causes.forEach((c, i) => {
    c.rank = i + 1
    c.confidence = confidence
  })

  return causes
}

function hypothesisFor(cat: RootCauseCategory): string {
  switch (cat) {
    case 'schema_change': return 'Schema change in upstream table caused data contract violation'
    case 'volume_anomaly': return 'Unexpected volume change detected in data pipeline'
    case 'data_quality': return 'Data quality degradation in source or transformation'
    case 'latency': return 'Pipeline latency or ingestion delay causing stale data'
    case 'external': return 'External system or third-party data source failure'
    case 'unknown': return 'Unknown root cause — insufficient signal'
  }
}
