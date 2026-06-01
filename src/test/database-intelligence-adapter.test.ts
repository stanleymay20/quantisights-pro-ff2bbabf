import { describe, it, expect, vi } from 'vitest'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

describe('analyzeTable', () => {
  const metadata = {
    tableId: 'public.orders',
    schema: 'public',
    name: 'orders',
    columns: [
      { name: 'id', ordinalPosition: 0, dataType: 'int4', isNullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'amount', ordinalPosition: 1, dataType: 'numeric', isNullable: true, isPrimaryKey: false, isForeignKey: false },
      { name: 'created_at', ordinalPosition: 2, dataType: 'timestamptz', isNullable: true, isPrimaryKey: false, isForeignKey: false },
    ],
    rowCount: 3,
  }

  const previewRows = [
    { id: 1, amount: 100.5, created_at: '2024-01-01' },
    { id: 2, amount: 200.0, created_at: '2024-01-02' },
    { id: 3, amount: null, created_at: '2024-01-03' },
  ]

  it('returns DatabaseIntelligenceResult with correct shape', async () => {
    const { analyzeTable } = await import('@/adapters/database-intelligence-adapter')
    const result = await analyzeTable('public.orders', metadata, previewRows)
    expect(result.tableId).toBe('public.orders')
    expect(result.ingestion).toBeDefined()
    expect(result.copilot).toBeDefined()
    expect(result.trust).toBeDefined()
    expect(result.analyzedAt).toBeDefined()
  })

  it('trust score is between 0 and 100', async () => {
    const { analyzeTable } = await import('@/adapters/database-intelligence-adapter')
    const result = await analyzeTable('public.orders', metadata, previewRows)
    expect(result.trust.score).toBeGreaterThanOrEqual(0)
    expect(result.trust.score).toBeLessThanOrEqual(100)
  })

  it('copilot brief has a headline string', async () => {
    const { analyzeTable } = await import('@/adapters/database-intelligence-adapter')
    const result = await analyzeTable('public.orders', metadata, previewRows)
    expect(typeof result.copilot.headline).toBe('string')
    expect(result.copilot.headline.length).toBeGreaterThan(0)
  })

  it('ingestion result has dictionary with fields', async () => {
    const { analyzeTable } = await import('@/adapters/database-intelligence-adapter')
    const result = await analyzeTable('public.orders', metadata, previewRows)
    expect(Array.isArray(result.ingestion.dictionary.fields)).toBe(true)
  })

  it('analyzedAt is a valid ISO date string', async () => {
    const { analyzeTable } = await import('@/adapters/database-intelligence-adapter')
    const result = await analyzeTable('public.orders', metadata, previewRows)
    const parsed = new Date(result.analyzedAt)
    expect(parsed.toString()).not.toBe('Invalid Date')
  })
})
