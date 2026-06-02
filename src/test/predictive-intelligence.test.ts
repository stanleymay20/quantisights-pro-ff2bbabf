import { describe, it, expect, vi } from 'vitest'
import { predictFreshnessFailure } from '@/lib/intelligence/freshness-predictor'
import { predictSchemaDrift, predictVolumeDrift } from '@/lib/intelligence/drift-predictor'
import { predictKPIChange } from '@/lib/intelligence/kpi-predictor'
import { intelligenceService } from '@/lib/intelligence/intelligence-service'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

describe('predictFreshnessFailure', () => {
  it('returns probability 0.20 and low severity with < 2 history points', () => {
    const result = predictFreshnessFailure({ tableId: 't1', freshnessHistory: [{ timestamp: '2024-01-01', stalenessScore: 5 }], expectedRefreshHours: 24 })
    expect(result.probability).toBe(0.20)
    expect(result.severity).toBe('low')
  })

  it('returns probability > 0.5 with increasing staleness trend', () => {
    const history = [
      { timestamp: '2024-01-01', stalenessScore: 1 },
      { timestamp: '2024-01-02', stalenessScore: 5 },
      { timestamp: '2024-01-03', stalenessScore: 12 },
    ]
    const result = predictFreshnessFailure({ tableId: 't1', freshnessHistory: history, expectedRefreshHours: 24 })
    expect(result.probability).toBeGreaterThan(0.5)
  })

  it('returns probability <= 0.30 with decreasing trend', () => {
    const history = [
      { timestamp: '2024-01-01', stalenessScore: 10 },
      { timestamp: '2024-01-02', stalenessScore: 5 },
      { timestamp: '2024-01-03', stalenessScore: 2 },
    ]
    const result = predictFreshnessFailure({ tableId: 't1', freshnessHistory: history, expectedRefreshHours: 24 })
    expect(result.probability).toBeLessThanOrEqual(0.30)
  })
})

describe('predictSchemaDrift', () => {
  it('returns low probability with < 3 history points', () => {
    const result = predictSchemaDrift({ tableId: 't1', changeHistory: [{ timestamp: '2024-01-01', changeCount: 1 }] })
    expect(result.probability).toBeLessThan(0.3)
  })

  it('returns elevated probability with high avg changes', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({ timestamp: `2024-01-0${i + 1}`, changeCount: 3 }))
    const result = predictSchemaDrift({ tableId: 't1', changeHistory: history })
    expect(result.probability).toBeGreaterThan(0.3)
  })
})

describe('predictVolumeDrift', () => {
  it('returns low probability with consistent history (low CV)', () => {
    const history = [100, 101, 100, 99, 101].map((r, i) => ({ timestamp: `2024-01-0${i + 1}`, rowCount: r }))
    const result = predictVolumeDrift({ tableId: 't1', volumeHistory: history, expectedRows: 100 })
    expect(result.probability).toBeLessThan(0.3)
  })

  it('returns probability > 0.5 with high variance', () => {
    const history = [100, 500, 50, 800, 20].map((r, i) => ({ timestamp: `2024-01-0${i + 1}`, rowCount: r }))
    const result = predictVolumeDrift({ tableId: 't1', volumeHistory: history, expectedRows: 100 })
    expect(result.probability).toBeGreaterThan(0.5)
  })
})

describe('predictKPIChange', () => {
  it('returns probability around 0.25 with < 3 values', () => {
    const result = predictKPIChange({ metricName: 'revenue', recentValues: [100, 110], horizon: 'next_7d' })
    expect(result.probability).toBe(0.25)
  })

  it('returns probability in [0, 1] range', () => {
    const result = predictKPIChange({ metricName: 'revenue', recentValues: [100, 200, 50, 300, 80, 250], horizon: 'next_30d' })
    expect(result.probability).toBeGreaterThanOrEqual(0)
    expect(result.probability).toBeLessThanOrEqual(1)
  })
})

describe('intelligenceService.generateForecast', () => {
  it('with empty tables returns forecast with 0 predictions', async () => {
    const forecast = await intelligenceService.generateForecast({ connectorId: 'test', tables: [], kpis: [] })
    expect(forecast.predictions).toHaveLength(0)
    expect(forecast.connectorId).toBe('test')
  })
})
