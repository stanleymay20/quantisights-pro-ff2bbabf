import { profileDistribution } from '@/lib/advanced-statistics'
import type { PredictionResult, PredictionHorizon } from './types'

export function predictKPIChange(params: {
  metricName: string
  recentValues: number[]
  horizon: PredictionHorizon
}): PredictionResult {
  const { metricName, recentValues, horizon } = params

  if (recentValues.length < 3) {
    return {
      id: crypto.randomUUID(),
      target: 'kpi_change',
      metricName,
      probability: 0.25,
      confidence: 0.3,
      predictedAt: new Date().toISOString(),
      horizon,
      evidence: ['Insufficient data (< 3 values)'],
      recommendation: `Monitor ${metricName} closely; consider threshold alert`,
      severity: 'low',
    }
  }

  const profile = profileDistribution(recentValues)
  const mean = recentValues.reduce((s, v) => s + v, 0) / recentValues.length
  const first = recentValues[0]
  const last = recentValues[recentValues.length - 1]
  const slope = (last - first) / Math.max(1, recentValues.length - 1)

  let probability: number
  if (profile.type === 'bimodal') {
    probability = 0.75
  } else if (profile.type === 'heavy_tailed') {
    probability = 0.60
  } else if (Math.abs(slope) > Math.abs(mean) * 0.10 && !profile.isNormal) {
    probability = 0.65
  } else {
    probability = 0.30
  }

  const severity: PredictionResult['severity'] =
    probability > 0.70 ? 'high' : probability > 0.50 ? 'medium' : 'low'

  const confidence = Math.min(0.95, 0.5 + recentValues.length * 0.03)

  return {
    id: crypto.randomUUID(),
    target: 'kpi_change',
    metricName,
    probability,
    confidence,
    predictedAt: new Date().toISOString(),
    horizon,
    evidence: [
      `Distribution type: ${profile.type}`,
      `Skewness: ${profile.skewness.toFixed(2)}`,
    ],
    recommendation: `Monitor ${metricName} closely; consider threshold alert`,
    severity,
  }
}
