export * from './types'
export * from './sql-safety'
export * from './nl-to-sql'
export * from './sql-executor'
export * from './result-explainer'

import { supabase } from '@/integrations/supabase/client'
import { naturalLanguageToSQL } from './nl-to-sql'
import { isSQLSafe } from './sql-safety'
import { executeSQL } from './sql-executor'
import { explainResults } from './result-explainer'
import type { SQLAgentQuery, SQLAgentContext } from './types'
import type { ConnectionConfig } from '@/connectors/base/types'

export async function runSQLAgent(
  naturalLanguage: string,
  context: SQLAgentContext,
  config: ConnectionConfig,
): Promise<SQLAgentQuery> {
  const id = `query-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const createdAt = new Date().toISOString()

  // 1. Natural language → SQL
  const { sql, safetyFlags, confidence: _confidence } = await naturalLanguageToSQL(naturalLanguage, context)

  if (!sql) {
    return {
      id,
      connectorId: context.connectorId,
      naturalLanguage,
      generatedSQL: '',
      status: 'error',
      error: 'Could not generate SQL from your question.',
      safetyFlags,
      createdAt,
    }
  }

  // 2. Safety check
  if (!isSQLSafe(sql)) {
    return {
      id,
      connectorId: context.connectorId,
      naturalLanguage,
      generatedSQL: sql,
      status: 'error',
      error: 'Generated SQL failed safety validation.',
      safetyFlags,
      createdAt,
    }
  }

  // 3. Execute
  let executionResult
  try {
    executionResult = await executeSQL(sql, config)
  } catch (e) {
    return {
      id,
      connectorId: context.connectorId,
      naturalLanguage,
      generatedSQL: sql,
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
      safetyFlags,
      createdAt,
    }
  }

  // 4. Explain
  const explanation = explainResults(naturalLanguage, executionResult)

  // 5. Emit audit event
  try {
    await supabase.from('audit_log').insert({
      action: 'sql_agent_query',
      resource_type: 'sql_agent',
      resource_id: id,
      details: {
        connectorId: context.connectorId,
        naturalLanguage,
        rowCount: executionResult.rowCount,
        executionMs: executionResult.executionMs,
      },
    })
  } catch {
    // Non-fatal
  }

  return {
    id,
    connectorId: context.connectorId,
    naturalLanguage,
    generatedSQL: sql,
    status: 'success',
    rows: executionResult.rows,
    rowCount: executionResult.rowCount,
    executionMs: executionResult.executionMs,
    explanation: explanation.headline,
    safetyFlags,
    createdAt,
  }
}
