import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInvoke = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: mockInvoke },
  },
}))

const config = {
  id: 'conn1',
  type: 'postgres' as const,
  name: 'Test',
  host: 'localhost',
  port: 5432,
  database: 'db',
  username: 'u',
  password: 'p',
  ssl: false,
  createdAt: '2024-01-01',
}

describe('executeSQL', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns rows, rowCount, columns on success', async () => {
    mockInvoke.mockResolvedValue({
      data: { rows: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
      error: null,
    })
    const { executeSQL } = await import('@/lib/sql-agent/sql-executor')
    const result = await executeSQL('SELECT id, name FROM users LIMIT 2', config)
    expect(result.rows).toHaveLength(2)
    expect(result.rowCount).toBe(2)
    expect(result.columns).toEqual(['id', 'name'])
  })

  it('executionMs is a positive number', async () => {
    mockInvoke.mockResolvedValue({ data: { rows: [{ x: 1 }] }, error: null })
    const { executeSQL } = await import('@/lib/sql-agent/sql-executor')
    const result = await executeSQL('SELECT 1 as x', config)
    expect(result.executionMs).toBeGreaterThanOrEqual(0)
  })

  it('throws on edge function error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Connection refused' } })
    const { executeSQL } = await import('@/lib/sql-agent/sql-executor')
    await expect(executeSQL('SELECT 1', config)).rejects.toThrow('Connection refused')
  })

  it('throws when data.error is set', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'syntax error at or near SELECT' }, error: null })
    const { executeSQL } = await import('@/lib/sql-agent/sql-executor')
    await expect(executeSQL('BAD SQL', config)).rejects.toThrow('syntax error')
  })

  it('handles empty result set', async () => {
    mockInvoke.mockResolvedValue({ data: { rows: [] }, error: null })
    const { executeSQL } = await import('@/lib/sql-agent/sql-executor')
    const result = await executeSQL('SELECT * FROM empty_table LIMIT 10', config)
    expect(result.rows).toHaveLength(0)
    expect(result.columns).toHaveLength(0)
  })
})
