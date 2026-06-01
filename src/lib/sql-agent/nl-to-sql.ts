import { supabase } from '@/integrations/supabase/client'
import { validateSQL } from './sql-safety'
import type { SQLAgentContext, SQLSafetyFlag, SQLDialect } from './types'

export interface NLToSQLResult {
  sql: string
  safetyFlags: SQLSafetyFlag[]
  confidence: number
}

function buildPrompt(query: string, context: SQLAgentContext, dialect: SQLDialect): string {
  const dialectLabel = dialect
  let tableContext = ''
  if (context.tableContext) {
    const cols = context.tableContext.columns.map(c => `${c.name} (${c.dataType})`).join(', ')
    tableContext = `\nTable context:\n${context.tableContext.tableId}: columns ${cols}`
  }

  return `You are a SQL expert for ${dialectLabel}. Generate a single safe SELECT query for:

Question: ${query}
${tableContext}

Rules:
- SELECT only, no DDL or DML
- Always include LIMIT 500 unless the question asks for aggregation
- Return ONLY the SQL wrapped in \`\`\`sql ... \`\`\``
}

function extractSQL(content: string): { sql: string; confidence: number } {
  // Try to extract from ```sql ... ``` blocks
  const fenceMatch = content.match(/```sql\s*([\s\S]+?)```/i)
  if (fenceMatch) {
    return { sql: fenceMatch[1].trim(), confidence: 1.0 }
  }

  // Try generic ``` block
  const genericMatch = content.match(/```\s*([\s\S]+?)```/)
  if (genericMatch) {
    return { sql: genericMatch[1].trim(), confidence: 0.8 }
  }

  // Try raw SQL heuristic — must start with SELECT
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
  const selectIdx = lines.findIndex(l => /^SELECT\b/i.test(l))
  if (selectIdx >= 0) {
    return { sql: lines.slice(selectIdx).join('\n'), confidence: 0.5 }
  }

  return { sql: '', confidence: 0 }
}

export async function naturalLanguageToSQL(
  query: string,
  context: SQLAgentContext,
  dialect: SQLDialect = 'postgresql',
): Promise<NLToSQLResult> {
  const prompt = buildPrompt(query, context, dialect)

  const { data, error } = await supabase.functions.invoke('executive-copilot', {
    body: { prompt },
  })

  if (error || !data) {
    return {
      sql: '',
      safetyFlags: [{ severity: 'error', rule: 'llm-error', message: error?.message ?? 'No response from AI' }],
      confidence: 0,
    }
  }

  // The edge function may return { content } or { answer } or a string
  const rawContent: string =
    typeof data === 'string'
      ? data
      : (data as Record<string, unknown>).content as string
        ?? (data as Record<string, unknown>).answer as string
        ?? JSON.stringify(data)

  const { sql, confidence } = extractSQL(rawContent)

  if (!sql) {
    return {
      sql: '',
      safetyFlags: [{ severity: 'error', rule: 'no-sql-extracted', message: 'Could not extract SQL from AI response.' }],
      confidence: 0,
    }
  }

  const safetyFlags = validateSQL(sql)
  return { sql, safetyFlags, confidence }
}
