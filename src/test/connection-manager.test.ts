import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConnectionManager } from '@/services/connection-manager'
import { PostgresConnector } from '@/connectors/postgres'
import { MySQLConnector } from '@/connectors/mysql'
import { SQLServerConnector } from '@/connectors/sqlserver'
import { SnowflakeConnector } from '@/connectors/snowflake'
import { BigQueryConnector } from '@/connectors/bigquery'
import type { ConnectionConfig } from '@/connectors/base/types'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'test-id', created_at: '2024-01-01' }, error: null }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  },
}))

function makeConfig(type: ConnectionConfig['type'], id = 'c1'): ConnectionConfig {
  return { id, type, name: 'Test', host: 'localhost', port: 5432, database: 'db', username: 'u', password: 'p', ssl: false, createdAt: '2024-01-01' }
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager

  beforeEach(() => {
    manager = new ConnectionManager()
  })

  it('listAvailableSources returns all 5 types', () => {
    const sources = manager.listAvailableSources()
    expect(sources).toContain('postgres')
    expect(sources).toContain('mysql')
    expect(sources).toContain('sqlserver')
    expect(sources).toContain('snowflake')
    expect(sources).toContain('bigquery')
    expect(sources).toHaveLength(5)
  })

  it('registerConnector then getConnector returns the same connector', () => {
    const config = makeConfig('postgres')
    manager.registerConnector(config)
    const connector = manager.getConnector('c1')
    expect(connector).toBeInstanceOf(PostgresConnector)
  })

  it('removeConnector then getConnector throws', () => {
    const config = makeConfig('postgres')
    manager.registerConnector(config)
    manager.removeConnector('c1')
    expect(() => manager.getConnector('c1')).toThrow('No connector registered with id: c1')
  })

  it('registers correct connector instance for each type', () => {
    const types: Array<[ConnectionConfig['type'], unknown]> = [
      ['postgres', PostgresConnector],
      ['mysql', MySQLConnector],
      ['sqlserver', SQLServerConnector],
      ['snowflake', SnowflakeConnector],
      ['bigquery', BigQueryConnector],
    ]
    for (const [type, Cls] of types) {
      const config = makeConfig(type, type)
      manager.registerConnector(config)
      expect(manager.getConnector(type)).toBeInstanceOf(Cls as never)
    }
  })

  it('testConnection calls connector.testConnection', async () => {
    const config = makeConfig('postgres')
    manager.registerConnector(config)
    const result = await manager.testConnection('c1')
    expect(typeof result).toBe('boolean')
  })
})
