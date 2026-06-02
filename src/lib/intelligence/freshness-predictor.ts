import type { PredictionResult } from './types'

export function predictFreshnessFailure(params: {
  tableId: string
  freshnessHistory: Array<{ timestamp: string; stalenessScore: number }>
  expectedRefreshHours: number
}): PredictionResult {
  const { tableId, freshnessHistory } = params

  if (freshnessHistory.length < 2) {
    return {
      id: crypto.randomUUID(),
      target: 'freshness_failure',
      tableId,
      probability: 0.20,
      confidence: 0.5,
      predictedAt: new Date().toISOString(),
      horizon: 'next_30d',
      evidence: ['Insufficient history'],
      recommendation: 'Schedule refresh or investigate ingestion pipeline',
      severity: 'low',
    }
  }

  // Linear regression slope
  const n = freshnessHistory.length
  const tMean = (n - 1) / 2
  const sMean = freshnessHistory.reduce((s, p) => s + p.stalenessScore, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    const tDiff = i - tMean
    const sDiff = freshnessHistory[i].stalenessScore - sMean
    num += tDiff * sDiff
    den += tDiff * tDiff
  }
  const slope = den !== 0 ? num / den : 0

  let probability: number
  let severity: PredictionResult['severity']
  let horizon: PredictionResult['horizon']

  if (slope > 2.0) {
    probability = 0.80; severity = 'critical'; horizon = 'next_24h'
  } else if (slope > 0.5) {
    probability = 0.55; severity = 'high'; horizon = 'next_7d'
  } else if (slope > 0) {
    probability = 0.30; severity = 'medium'; horizon = 'next_30d'
  } else {
    probability = 0.10; severity = 'low'; horizon = 'next_30d'
  }

  const confidence = Math.min(0.95, 0.5 + n * 0.05)

  return {
    id: crypto.randomUUID(),
    target: 'freshness_failure',
    tableId,
    probability,
    confidence,
    predictedAt: new Date().toISOString(),
    horizon,
    evidence: [
      `Staleness trend slope: ${slope.toFixed(2)}`,
      `Based on ${n} observations`,
    ],
    recommendation: 'Schedule refresh or investigate ingestion pipeline',
    severity,
  }
}
