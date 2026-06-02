import { calculateIncrementalLift } from '@/lib/attribution-models'
import type { ScenarioOutcome } from './types'

export interface ImpactEstimate {
  absoluteImpact: number
  relativeImpact: number
  confidence: number
  isSignificant: boolean
  metricName: string
}

export function estimateImpact(params: {
  scenario: ScenarioOutcome
  baselineValues: number[]
  treatmentValues: number[]
  metricName: string
}): ImpactEstimate {
  const { baselineValues, treatmentValues, metricName } = params
  const lift = calculateIncrementalLift(baselineValues, treatmentValues, metricName)
  return {
    absoluteImpact: lift.absoluteLift,
    relativeImpact: lift.relativeLift,
    confidence: lift.confidence,
    isSignificant: lift.isSignificant,
    metricName: lift.metric,
  }
}
