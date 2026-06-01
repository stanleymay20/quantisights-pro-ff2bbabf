export interface SQLAgentQuery {
  id: string
  connectorId: string
  naturalLanguage: string
  generatedSQL: string
  status: 'pending' | 'executing' | 'success' | 'error'
  rows?: Record<string, unknown>[]
  error?: string
  rowCount?: number
  executionMs?: number
  explanation?: string
  safetyFlags?: SQLSafetyFlag[]
  createdAt: string
}

export interface SQLSafetyFlag {
  severity: 'info' | 'warning' | 'error'
  rule: string
  message: string
}

export interface SQLAgentContext {
  connectorId: string
  tableContext?: {
    tableId: string
    columns: Array<{ name: string; dataType: string }>
    sampleValues?: Record<string, string[]>
  }
  previousQueries?: SQLAgentQuery[]
}

export type SQLDialect = 'postgresql' | 'mysql' | 'tsql' | 'snowflake' | 'bigquery'
