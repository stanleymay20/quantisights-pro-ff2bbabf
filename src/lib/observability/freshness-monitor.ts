import type { FreshnessStatus } from './types'

export function checkFreshness(params: {
  tableId: string
  lastUpdated: string | null
  expectedRefreshHours: number
}): FreshnessStatus {
  const { tableId, lastUpdated, expectedRefreshHours } = params

  if (!lastUpdated) {
    return {
      tableId,
      lastUpdated: null,
      expectedRefreshHours,
      actualAgeHours: 0,
      stalenessScore: 50,
      status: 'unknown',
      nextExpectedRefresh: null,
    }
  }

  const now = Date.now()
  const updatedMs = new Date(lastUpdated).getTime()
  const actualAgeHours = (now - updatedMs) / 3600000
  const stalenessScore = Math.min(100, Math.round((actualAgeHours / expectedRefreshHours) * 50))
  const status = actualAgeHours < expectedRefreshHours ? 'fresh' : 'stale'
  const nextExpectedRefresh = new Date(updatedMs + expectedRefreshHours * 3600000).toISOString()

  return { tableId, lastUpdated, expectedRefreshHours, actualAgeHours, stalenessScore, status, nextExpectedRefresh }
}
