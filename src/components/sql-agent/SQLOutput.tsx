import { useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import type { SQLAgentQuery } from '@/lib/sql-agent/types'

interface SQLOutputProps {
  query: SQLAgentQuery
}

const SEVERITY_CLASS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  error: 'bg-red-100 text-red-800 border-red-200',
}

export function SQLOutput({ query }: SQLOutputProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(query.generatedSQL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [query.generatedSQL])

  const displayRows = (query.rows ?? []).slice(0, 100)
  const columns = displayRows.length > 0 ? Object.keys(displayRows[0]) : []

  return (
    <div className="space-y-4">
      {/* Generated SQL */}
      {query.generatedSQL && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Generated SQL</p>
            <button
              onClick={handleCopy}
              className="text-xs text-primary hover:underline"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {query.generatedSQL}
          </pre>
        </div>
      )}

      {/* Safety flags */}
      {query.safetyFlags && query.safetyFlags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {query.safetyFlags.map((flag, i) => (
            <span
              key={i}
              className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASS[flag.severity] ?? ''}`}
              title={flag.message}
            >
              {flag.severity}: {flag.rule}
            </span>
          ))}
        </div>
      )}

      {/* Error */}
      {query.status === 'error' && query.error && (
        <p className="text-sm text-red-600">{query.error}</p>
      )}

      {/* Execution metadata */}
      {query.status === 'success' && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{query.rowCount ?? 0} rows</span>
          {query.executionMs !== undefined && <span>{query.executionMs}ms</span>}
        </div>
      )}

      {/* Explanation */}
      {query.explanation && (
        <div className="rounded-md border p-3 bg-muted/30 space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Explanation</p>
          <p className="text-sm">{query.explanation}</p>
        </div>
      )}

      {/* Results table */}
      {displayRows.length > 0 && (
        <div className="overflow-auto rounded-md border max-h-72">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {columns.map(col => (
                  <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => (
                <tr key={i} className="border-t hover:bg-muted/30">
                  {columns.map(col => (
                    <td key={col} className="px-3 py-1.5 whitespace-nowrap">
                      {row[col] === null || row[col] === undefined ? (
                        <span className="text-muted-foreground italic">null</span>
                      ) : (
                        String(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
