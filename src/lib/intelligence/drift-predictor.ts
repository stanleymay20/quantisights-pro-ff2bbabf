import { detectSeasonality } from '@/lib/advanced-statistics'
import type { PredictionResult, PredictionHorizon } from './types'

export function predictSchemaDrift(params: {
  tableId: string
  changeHistory: Array<{ timestamp: string; changeCount: number }>
}): PredictionResult {
  const { tableId, changeHistory } = params

  if (changeHistory.length < 3) {
    return {
      id: crypto.randomUUID(),
      target: 'schema_drift',
      tableId,
      probability: 0.15,
      confidence: 0.4,
      predictedAt: new Date().toISOString(),
      horizon: 'next_30d',
      evidence: ['Insufficient history (< 3 data points)'],
      recommendation: 'Monitor schema changes and set up alerts',
      severity: 'low',
    }
  }

  const counts = changeHistory.map((h) => h.changeCount)
  const seasonality = detectSeasonality(counts)

  const avg = counts.reduce((s, v) => s + v, 0) / counts.length

  let probability: number
  let severity: PredictionResult['severity']
  let horizon: PredictionHorizon

  if (seasonality.detected && seasonality.strength > 0.6) {
    probability = 0.70; severity = 'high'; horizon = 'next_7d'
  } else if (avg > 2) {
    probability = 0.65; severity = 'high'; horizon = 'next_7d'
  } else if (avg > 0.5) {
    probability = 0.40; severity = 'medium'; horizon = 'next_30d'
  } else {
    probability = 0.15; severity = 'low'; horizon = 'next_30d'
  }

  const confidence = Math.min(0.95, 0.5 + changeHistory.length * 0.03)

  return {
    id: crypto.randomUUID(),
    target: 'schema_drift',
    tableId,
    probability,
    confidence,
    predictedAt: new Date().toISOString(),
    horizon,
    evidence: [
      `Average changes per period: ${avg.toFixed(2)}`,
      `Seasonality detected: ${seasonality.detected}`,
    ],
    recommendation: 'Review schema change management and add backward-compat checks',
    severity,
  }
}

export function predictVolumeDrift(params: {
  tableId: string
  volumeHistory: Array<{ timestamp: string; rowCount: number }>
  expectedRows: number
}): PredictionResult {
  const { tableId, volumeHistory } = params

  if (volumeHistory.length < 2) {
    return {
      id: crypto.randomUUID(),
      target: 'volume_anomaly',
      tableId,
      probability: 0.20,
      confidence: 0.4,
      predictedAt: new Date().toISOString(),
      horizon: 'next_30d',
      evidence: ['Insufficient history'],
      recommendation: 'Monitor volume trends with more data',
      severity: 'low',
    }
  }

  const counts = volumeHistory.map((h) => h.rowCount)
  const mean = counts.reduce((s, v) => s + v, 0) / counts.length
  const variance = counts.reduce((s, v) => s + (v - mean) ** 2, 0) / counts.length
  const stdDev = Math.sqrt(variance)
  const cv = mean !== 0 ? stdDev / mean : 0

  let probability: number
  let severity: PredictionResult['severity']
  let horizon: PredictionHorizon

  if (cv > 0.30) {
    probability = 0.72; severity = 'high'; horizon = 'next_7d'
  } else if (cv > 0.15) {
    probability = 0.45; severity = 'medium'; horizon = 'next_30d'
  } else {
    probability = 0.18; severity = 'low'; horizon = 'next_30d'
  }

  const confidence = Math.min(0.95, 0.5 + volumeHistory.length * 0.04)

  return {
    id: crypto.randomUUID(),
    target: 'volume_anomaly',
    tableId,
    probability,
    confidence,
    predictedAt: new Date().toISOString(),
    horizon,
    evidence: [
      `CV: ${cv.toFixed(3)}`,
      `Mean rows: ${mean.toFixed(0)}`,
    ],
    recommendation: 'Investigate data pipeline for volume inconsistencies',
    severity,
  }
}
