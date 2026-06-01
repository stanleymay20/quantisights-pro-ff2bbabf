import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInvoke = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}))

const context = {
  connectorId: 'conn1',
  tableContext: {
    tableId: 'public.orders',
    columns: [
      { name: 'id', dataType: 'int4' },
      { name: 'amount', dataType: 'numeric' },
    ],
  },
}

describe('naturalLanguageToSQL', () => {
  beforeEach(() => vi.clearAllMocks())

  it('extracts SQL from ```sql ... ``` fences', async () => {
    mockInvoke.mockResolvedValue({
      data: { content: '```sql\nSELECT id, amount FROM public.orders LIMIT 100\n```' },
      error: null,
    })
    const { naturalLanguageToSQL } = await import('@/lib/sql-agent/nl-to-sql')
    const result = await naturalLanguageToSQL('Show all orders', context)
    expect(result.sql).toBe('SELECT id, amount FROM public.orders LIMIT 100')
    expect(result.confidence).toBe(1.0)
  })

  it('extracts raw SQL without code fences', async () => {
    mockInvoke.mockResolvedValue({
      data: { content: 'SELECT id FROM public.orders LIMIT 10' },
      error: null,
    })
    const { naturalLanguageToSQL } = await import('@/lib/sql-agent/nl-to-sql')
    const result = await naturalLanguageToSQL('List order ids', context)
    expect(result.sql).toContain('SELECT')
    expect(result.confidence).toBeGreaterThan(0)
  })

  it('returns safety flags alongside SQL', async () => {
    mockInvoke.mockResolvedValue({
      data: { content: '```sql\nSELECT * FROM public.orders\n```' },
      error: null,
    })
    const { naturalLanguageToSQL } = await import('@/lib/sql-agent/nl-to-sql')
    const result = await naturalLanguageToSQL('Show all orders', context)
    expect(Array.isArray(result.safetyFlags)).toBe(true)
  })

  it('returns error flag on empty response', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Function error' } })
    const { naturalLanguageToSQL } = await import('@/lib/sql-agent/nl-to-sql')
    const result = await naturalLanguageToSQL('Show orders', context)
    expect(result.sql).toBe('')
    expect(result.safetyFlags.some(f => f.severity === 'error')).toBe(true)
    expect(result.confidence).toBe(0)
  })

  it('returns error flag when no SQL can be extracted', async () => {
    mockInvoke.mockResolvedValue({ data: { content: 'I cannot help with that.' }, error: null })
    const { naturalLanguageToSQL } = await import('@/lib/sql-agent/nl-to-sql')
    const result = await naturalLanguageToSQL('Show orders', context)
    expect(result.sql).toBe('')
    expect(result.safetyFlags.some(f => f.rule === 'no-sql-extracted')).toBe(true)
  })
})
