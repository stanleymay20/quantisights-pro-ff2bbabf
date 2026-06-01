import { supabase } from '@/integrations/supabase/client'
import type { ConnectionConfig } from '@/connectors/base/types'

export interface SQLExecutionResult {
  rows: Record<string, unknown>[]
  rowCount: number
  executionMs: number
  columns: string[]
}

export async function executeSQL(
  sql: string,
  config: ConnectionConfig,
): Promise<SQLExecutionResult> {
  const start = Date.now()

  const { data, error } = await supabase.functions.invoke('db-connector', {
    body: { action: 'query', connector: config, sql },
  })

  const executionMs = Date.now() - start

  if (error) {
    throw new Error(`SQL execution failed: ${error.message}`)
  }

  const result = data as { rows?: Record<string, unknown>[]; error?: string }

  if (result?.error) {
    throw new Error(`SQL execution error: ${result.error}`)
  }

  const rows: Record<string, unknown>[] = result?.rows ?? []
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  return {
    rows,
    rowCount: rows.length,
    executionMs,
    columns,
  }
}
