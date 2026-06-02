import { computeTrustScore } from '@/lib/semantic/trust-score'
import type { TrustScoreInput } from '@/lib/semantic/trust-score'
import type { QualityMonitorResult } from './types'

export function checkQuality(params: {
  tableId: string
  trustInput: TrustScoreInput
}): QualityMonitorResult {
  const { tableId, trustInput } = params
  const result = computeTrustScore(trustInput)

  return {
    tableId,
    trustGrade: result.grade,
    trustScore: result.score,
    riskFlags: result.rationale,
    checkedAt: new Date().toISOString(),
  }
}
