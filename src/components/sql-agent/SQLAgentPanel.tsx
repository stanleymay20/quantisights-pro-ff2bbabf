import { useState, useRef, useCallback } from 'react'
import { SQLInput } from './SQLInput'
import { SQLOutput } from './SQLOutput'
import { SQLHistory } from './SQLHistory'
import { runSQLAgent } from '@/lib/sql-agent'
import type { SQLAgentQuery, SQLAgentContext } from '@/lib/sql-agent/types'
import type { ConnectionConfig } from '@/connectors/base/types'

interface SQLAgentPanelProps {
  connectorId: string
  config: ConnectionConfig
  tableContext?: SQLAgentContext['tableContext']
}

export function SQLAgentPanel({ connectorId, config, tableContext }: SQLAgentPanelProps) {
  const [queries, setQueries] = useState<SQLAgentQuery[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleSubmit = useCallback(async (naturalLanguage: string) => {
    setIsLoading(true)
    const context: SQLAgentContext = { connectorId, tableContext, previousQueries: queries.slice(-3) }
    const result = await runSQLAgent(naturalLanguage, context, config)
    setIsLoading(false)
    setQueries(prev => [...prev, result])
    setSelectedId(result.id)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [connectorId, config, tableContext, queries])

  const selectedQuery = queries.find(q => q.id === selectedId) ?? queries[queries.length - 1]

  return (
    <div className="flex h-full gap-4 overflow-hidden">
      {/* History sidebar */}
      <div className="w-56 shrink-0 border rounded-lg overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b bg-muted/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</p>
        </div>
        <div className="flex-1 overflow-auto">
          <SQLHistory queries={queries} onSelect={setSelectedId} />
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden">
        <div className="flex-1 overflow-auto space-y-4 pr-1">
          {selectedQuery ? (
            <SQLOutput query={selectedQuery} />
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              Ask a question about your data to get started.
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="shrink-0">
          <SQLInput onSubmit={handleSubmit} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}
