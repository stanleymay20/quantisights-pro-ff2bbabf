import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SQLAgentPanel } from '@/components/sql-agent/SQLAgentPanel'
import { connectionManager } from '@/services/connection-manager'
import type { ConnectionConfig } from '@/connectors/base/types'

export default function SQLAgentPage() {
  const [configs, setConfigs] = useState<ConnectionConfig[]>([])
  const [selectedId, setSelectedId] = useState<string>('')

  useEffect(() => {
    connectionManager.loadPersistedConnectors().then(setConfigs).catch(console.error)
  }, [])

  const selectedConfig = configs.find(c => c.id === selectedId)

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">AI SQL Agent</h1>
          <p className="text-sm text-muted-foreground">Ask questions about your database in plain English.</p>
        </div>
        <div className="w-56">
          {configs.length > 0 ? (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select connector…" />
              </SelectTrigger>
              <SelectContent>
                {configs.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">No connectors found.</p>
          )}
        </div>
      </div>

      {/* Body */}
      {!selectedConfig ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              No database connector selected.
            </p>
            <Link to="/database" className="text-sm text-primary underline">
              Connect a database →
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <SQLAgentPanel connectorId={selectedConfig.id} config={selectedConfig} />
        </div>
      )}
    </div>
  )
}
