import { describe, it, expect } from 'vitest'
import { checkFreshness } from '@/lib/observability/freshness-monitor'
import { checkVolumeDeviation } from '@/lib/observability/volume-monitor'
import { generateAlerts } from '@/lib/observability/alert-engine'
import { checkSchemaDrift } from '@/lib/observability/schema-monitor'
import { checkQuality } from '@/lib/observability/quality-monitor'
import type { SchemaSnapshot } from '@/lib/schema-evolution'

describe('checkFreshness', () => {
  it('with null lastUpdated → status unknown, score 50', () => {
    const r = checkFreshness({ tableId: 't1', lastUpdated: null, expectedRefreshHours: 24 })
    expect(r.status).toBe('unknown')
    expect(r.stalenessScore).toBe(50)
  })

  it('within refresh window → status fresh', () => {
    const recent = new Date(Date.now() - 1 * 3600000).toISOString()
    const r = checkFreshness({ tableId: 't1', lastUpdated: recent, expectedRefreshHours: 24 })
    expect(r.status).toBe('fresh')
  })

  it('past refresh window → status stale', () => {
    const old = new Date(Date.now() - 48 * 3600000).toISOString()
    const r = checkFreshness({ tableId: 't1', lastUpdated: old, expectedRefreshHours: 24 })
    expect(r.status).toBe('stale')
  })
})

describe('checkVolumeDeviation', () => {
  it('within 10% → status normal', () => {
    const r = checkVolumeDeviation({ tableId: 't1', expectedRows: 1000, actualRows: 1050 })
    expect(r.status).toBe('normal')
  })

  it('-50% deviation → status critical', () => {
    const r = checkVolumeDeviation({ tableId: 't1', expectedRows: 1000, actualRows: 100 })
    expect(r.status).toBe('critical')
  })

  it('+60% deviation → status high', () => {
    const r = checkVolumeDeviation({ tableId: 't1', expectedRows: 1000, actualRows: 1600 })
    expect(r.status).toBe('high')
  })
})

describe('generateAlerts', () => {
  it('stale freshness → returns warning alert', () => {
    const old = new Date(Date.now() - 30 * 3600000).toISOString()
    const freshness = checkFreshness({ tableId: 't1', lastUpdated: old, expectedRefreshHours: 24 })
    const alerts = generateAlerts({ connectorId: 'c1', tableId: 't1', freshness })
    expect(alerts.some(a => a.category === 'freshness' && a.severity === 'warning')).toBe(true)
  })

  it('critical staleness → returns critical alert', () => {
    const old = new Date(Date.now() - 400 * 3600000).toISOString()
    const freshness = checkFreshness({ tableId: 't1', lastUpdated: old, expectedRefreshHours: 24 })
    expect(freshness.stalenessScore).toBeGreaterThan(75)
    const alerts = generateAlerts({ connectorId: 'c1', tableId: 't1', freshness })
    expect(alerts.some(a => a.category === 'freshness' && a.severity === 'critical')).toBe(true)
  })

  it('no issues → returns empty array', () => {
    const recent = new Date(Date.now() - 1 * 3600000).toISOString()
    const freshness = checkFreshness({ tableId: 't1', lastUpdated: recent, expectedRefreshHours: 24 })
    const volume = checkVolumeDeviation({ tableId: 't1', expectedRows: 1000, actualRows: 1000 })
    const alerts = generateAlerts({ connectorId: 'c1', tableId: 't1', freshness, volume })
    expect(alerts).toHaveLength(0)
  })
})

describe('checkSchemaDrift', () => {
  it('with no previous → no changes', () => {
    const current: SchemaSnapshot = {
      datasetId: 'ds1',
      versionNumber: 1,
      columns: [{ name: 'id', type: 'number', role: 'metric' }],
      capturedAt: new Date().toISOString(),
    }
    const r = checkSchemaDrift({ tableId: 't1', previous: null, current })
    expect(r.hasChanges).toBe(false)
    expect(r.changeCount).toBe(0)
  })
})

describe('checkQuality', () => {
  it('with low trust → returns risk flags', () => {
    const r = checkQuality({
      tableId: 't1',
      trustInput: {
        diagnostics: null,
        drift: { fromVersion: 1, toVersion: 2, totalChanges: 5, changes: [], backwardCompatible: false },
        anomalies: null,
        hasLineage: false,
      },
    })
    expect(r.trustScore).toBeLessThan(80)
    expect(r.riskFlags.length).toBeGreaterThan(0)
  })
})
