import { detectDrift } from '@/lib/schema-evolution'
import type { SchemaSnapshot } from '@/lib/schema-evolution'
import type { SchemaMonitorResult } from './types'

export function checkSchemaDrift(params: {
  tableId: string
  previous: SchemaSnapshot | null
  current: SchemaSnapshot
}): SchemaMonitorResult {
  const { tableId, previous, current } = params
  const report = detectDrift(previous, current)

  return {
    tableId,
    hasChanges: report.totalChanges > 0,
    changeCount: report.totalChanges,
    backwardCompatible: report.backwardCompatible,
    checkedAt: new Date().toISOString(),
  }
}
