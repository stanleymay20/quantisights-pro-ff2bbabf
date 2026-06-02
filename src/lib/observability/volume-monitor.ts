import type { VolumeSnapshot } from './types'

export function checkVolumeDeviation(params: {
  tableId: string
  expectedRows: number
  actualRows: number
}): VolumeSnapshot {
  const { tableId, expectedRows, actualRows } = params
  const deviationPercent = ((actualRows - expectedRows) / expectedRows) * 100
  const abs = Math.abs(deviationPercent)

  let status: VolumeSnapshot['status']
  if (abs > 80) status = 'critical'
  else if (deviationPercent < -20) status = 'low'
  else if (deviationPercent > 50) status = 'high'
  else status = 'normal'

  return { tableId, expectedRows, actualRows, deviationPercent, status, measuredAt: new Date().toISOString() }
}
