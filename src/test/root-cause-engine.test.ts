import { describe, it, expect, vi } from 'vitest'
import { correlateAnomalies, toCorrelationSignals } from '@/lib/root-cause/anomaly-correlator'
import { rankCauses } from '@/lib/root-cause/cause-ranking'
import { narrateRootCause } from '@/lib/root-cause/root-cause-narrator'
import { analyzeDependencies } from '@/lib/root-cause/dependency-analyzer'

// Mock external dependencies that may not be in the worktree
vi.mock('@/lib/metadata-graph/impact-analysis', () => ({
  findUpstreamSources: vi.fn(() => []),
  findImpactedAssets: vi.fn(() => []),
}))
vi.mock('@/lib/metadata-graph/lineage-tracer', () => ({
  traceColumnLineage: vi.fn(() => ({ nodes: [], edges: [], depth: 0 })),
  shortestPath: vi.fn(() => null),
}))
vi.mock('@/lib/observability/freshness-monitor', () => ({
  checkFreshness: vi.fn(),
}))

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

function makeGraph() {
  return { nodes: new Map(), edges: [] }
}

describe('correlateAnomalies', () => {
  it('returns empty array with empty anomalies', () => {
    const result = correlateAnomalies({ anomalies: [], columnNodeMap: {}, graph: makeGraph() })
    expect(result).toEqual([])
  })

  it('returns correlation for known column', () => {
    const anomaly = { column: 'revenue', severity: 'high' as const, kind: 'spike' as const, affectedRows: 10, explanation: 'Spike', recommendation: 'Check' }
    const result = correlateAnomalies({
      anomalies: [anomaly],
      columnNodeMap: { revenue: 'node-1' },
      graph: makeGraph(),
    })
    expect(result).toHaveLength(1)
    expect(result[0].nodeId).toBe('node-1')
    expect(result[0].columnName).toBe('revenue')
  })
})

describe('toCorrelationSignals', () => {
  it('maps severity to correlation strength correctly', () => {
    const anomaly = { column: 'orders', severity: 'critical' as const, kind: 'drop' as const, affectedRows: 5, explanation: 'Drop', recommendation: 'Fix' }
    const correlations = [{ nodeId: 'n1', columnName: 'orders', upstreamSources: [], anomaly }]
    const signals = toCorrelationSignals(correlations)
    expect(signals[0].correlationStrength).toBe(0.9)
  })
})

describe('rankCauses', () => {
  it('ranks schema_change #1 with a critical schema alert', () => {
    const alert = { id: '1', tableId: 't1', connectorId: 'c1', category: 'schema' as const, severity: 'critical' as const, title: 'Schema change', message: 'Column removed', detectedAt: new Date().toISOString(), metadata: { backwardCompatible: false } }
    const causes = rankCauses({ correlations: [], dependencyFailures: [], alerts: [alert], anomalies: [] })
    expect(causes[0].category).toBe('schema_change')
    expect(causes[0].rank).toBe(1)
  })

  it('includes volume_anomaly in top causes for critical volume alert', () => {
    const alert = { id: '2', tableId: 't1', connectorId: 'c1', category: 'volume' as const, severity: 'critical' as const, title: 'Volume drop', message: 'Rows missing', detectedAt: new Date().toISOString(), metadata: {} }
    const causes = rankCauses({ correlations: [], dependencyFailures: [], alerts: [alert], anomalies: [] })
    const categories = causes.map((c) => c.category)
    expect(categories).toContain('volume_anomaly')
  })

  it('probabilities sum to <= 1.0', () => {
    const alerts = [
      { id: '1', tableId: 't1', connectorId: 'c1', category: 'schema' as const, severity: 'critical' as const, title: 'S', message: 'M', detectedAt: new Date().toISOString(), metadata: { backwardCompatible: false } },
      { id: '2', tableId: 't1', connectorId: 'c1', category: 'volume' as const, severity: 'warning' as const, title: 'V', message: 'M', detectedAt: new Date().toISOString(), metadata: {} },
    ]
    const causes = rankCauses({ correlations: [], dependencyFailures: [], alerts, anomalies: [] })
    const sum = causes.reduce((s, c) => s + c.probability, 0)
    expect(sum).toBeLessThanOrEqual(1.001) // small float tolerance
  })

  it('returns unknown cause when no alerts', () => {
    const causes = rankCauses({ correlations: [], dependencyFailures: [], alerts: [], anomalies: [] })
    expect(causes.some((c) => c.category === 'unknown')).toBe(true)
  })
})

describe('narrateRootCause', () => {
  const baseAnalysis = {
    triggerId: 'demo',
    triggerType: 'manual' as const,
    changeDescription: 'Revenue dropped 20%',
    rootCauses: [{
      id: 'c1', hypothesis: 'Data quality issue', probability: 0.7, confidence: 0.8,
      evidence: ['Anomaly detected'], affectedAssets: [], category: 'data_quality' as const, rank: 1,
    }],
    topCause: {
      id: 'c1', hypothesis: 'Data quality issue', probability: 0.7, confidence: 0.8,
      evidence: [], affectedAssets: [], category: 'data_quality' as const, rank: 1,
    },
    affectedAssets: [],
    lineagePath: null,
    correlations: [],
    dependencyFailures: [],
    confidence: 0.8,
    analyzedAt: new Date().toISOString(),
  }

  it('contains change description', () => {
    const text = narrateRootCause(baseAnalysis)
    expect(text).toContain('Revenue dropped 20%')
  })

  it('contains probability percentage', () => {
    const text = narrateRootCause(baseAnalysis)
    expect(text).toContain('70%')
  })
})

describe('analyzeDependencies', () => {
  it('returns empty array for empty inputs', () => {
    const result = analyzeDependencies({ columnNodeIds: [], graph: makeGraph(), alerts: [] })
    expect(result).toEqual([])
  })
})
