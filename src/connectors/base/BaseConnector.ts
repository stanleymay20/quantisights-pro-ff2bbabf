import { supabase } from '@/integrations/supabase/client'
import type { Connector, ConnectionConfig, TableInfo, TableMetadata, TableProfile, ColumnProfile } from './types'

export abstract class BaseConnector implements Connector {
  constructor(protected config: ConnectionConfig) {}

  protected async callEdgeFunction(action: string, extra?: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await supabase.functions.invoke('db-connector', {
      body: { action, connector: this.config, ...extra }
    })
    if (error) throw new Error(`db-connector error: ${error.message}`)
    return data
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.callEdgeFunction('test') as { success: boolean }
      return result.success === true
    } catch {
      return false
    }
  }

  async listSchemas(): Promise<string[]> {
    const result = await this.callEdgeFunction('discover') as { schemas?: string[]; tables?: Array<{ schema: string }> }
    if (result.schemas) return result.schemas
    // Derive from tables if schemas not returned separately
    const schemas = new Set((result.tables ?? []).map(t => t.schema).filter(Boolean))
    return Array.from(schemas)
  }

  async listTables(schema?: string): Promise<TableInfo[]> {
    const result = await this.callEdgeFunction('discover', schema ? { schema } : {}) as { tables?: Array<{ schema: string; name: string; rowCount?: number }> }
    return (result.tables ?? []).map(t => ({
      schema: t.schema,
      name: t.name,
      tableId: `${t.schema}.${t.name}`,
      rowCount: t.rowCount,
    }))
  }

  async getTableMetadata(tableId: string): Promise<TableMetadata> {
    const result = await this.callEdgeFunction('discover', { tableId }) as {
      columns?: Array<{ name: string; type: string; nullable?: boolean; primaryKey?: boolean; ordinalPosition?: number }>
      rowCount?: number
    }
    const [schema, name] = tableId.split('.')
    return {
      tableId,
      schema,
      name,
      columns: (result.columns ?? []).map((c, i) => ({
        name: c.name,
        ordinalPosition: c.ordinalPosition ?? i,
        dataType: c.type,
        isNullable: c.nullable ?? true,
        isPrimaryKey: c.primaryKey ?? false,
        isForeignKey: false,
      })),
      rowCount: result.rowCount,
    }
  }

  async previewTable(tableId: string, limit = 50): Promise<Record<string, unknown>[]> {
    const result = await this.callEdgeFunction('preview', { tableId, limit }) as { rows?: Record<string, unknown>[] }
    return result.rows ?? []
  }

  async profileTable(tableId: string): Promise<TableProfile> {
    const rows = await this.previewTable(tableId, 1000)
    if (rows.length === 0) {
      return { tableId, rowCount: 0, columnProfiles: [], profiledAt: new Date().toISOString() }
    }
    const headers = Object.keys(rows[0])
    const columnProfiles: ColumnProfile[] = headers.map(name => {
      const values = rows.map(r => r[name]).filter(v => v != null)
      const nullCount = rows.length - values.length
      const distinct = new Set(values.map(String))
      const numerics = values.map(Number).filter(n => !isNaN(n))
      const avg = numerics.length ? numerics.reduce((a, b) => a + b, 0) / numerics.length : undefined
      const sorted = [...values.map(String)].sort()
      const topValueMap = new Map<string, number>()
      for (const v of values.map(String)) topValueMap.set(v, (topValueMap.get(v) ?? 0) + 1)
      const topValues = [...topValueMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }))
      return {
        name,
        dataType: 'unknown',
        nullCount,
        distinctCount: distinct.size,
        minValue: sorted[0],
        maxValue: sorted[sorted.length - 1],
        avgValue: avg !== undefined ? String(avg.toFixed(4)) : undefined,
        topValues,
      }
    })
    return {
      tableId,
      rowCount: rows.length,
      columnProfiles,
      profiledAt: new Date().toISOString(),
    }
  }
}
