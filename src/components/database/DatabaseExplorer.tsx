import { useState, useCallback, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { SchemaTree } from './SchemaTree'
import { ColumnInspector } from './ColumnInspector'
import { TableBrowser } from './TableBrowser'
import { connectionManager } from '@/services/connection-manager'
import { discoverDatabase } from '@/services/database-discovery'
import { analyzeTable, type DatabaseIntelligenceResult } from '@/adapters/database-intelligence-adapter'
import type { TableInfo, TableMetadata } from '@/connectors/base/types'

interface DatabaseExplorerProps {
  connectorId: string
  connectorName: string
}

export function DatabaseExplorer({ connectorId, connectorName }: DatabaseExplorerProps) {
  const [schemas, setSchemas] = useState<string[]>([])
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string>('')
  const [metadata, setMetadata] = useState<TableMetadata | null>(null)
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([])
  const [intelligenceResult, setIntelligenceResult] = useState<DatabaseIntelligenceResult | null>(null)
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isLoadingIntel, setIsLoadingIntel] = useState(false)

  // Load discovery on mount
  useEffect(() => {
    setIsLoadingDiscovery(true)
    discoverDatabase(connectorId)
      .then(result => {
        setSchemas(result.schemas)
        setTables(result.tables)
      })
      .catch(console.error)
      .finally(() => setIsLoadingDiscovery(false))
  }, [connectorId])

  const handleSelectTable = useCallback(async (tableId: string) => {
    setSelectedTableId(tableId)
    setMetadata(null)
    setPreviewRows([])
    setIntelligenceResult(null)
    setIsLoadingPreview(true)
    setIsLoadingIntel(false)
    try {
      const connector = connectionManager.getConnector(connectorId)
      const [meta, rows] = await Promise.all([
        connector.getTableMetadata(tableId),
        connector.previewTable(tableId, 50),
      ])
      setMetadata(meta)
      setPreviewRows(rows)
      setIsLoadingIntel(true)
      try {
        const intel = await analyzeTable(tableId, meta, rows)
        setIntelligenceResult(intel)
      } catch (e) {
        console.error('Intelligence analysis failed', e)
      } finally {
        setIsLoadingIntel(false)
      }
    } catch (e) {
      console.error('Failed to load table', e)
    } finally {
      setIsLoadingPreview(false)
    }
  }, [connectorId])

  return (
    <div className="flex h-full gap-4">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border rounded-lg overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b bg-muted/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {connectorName}
          </p>
          {isLoadingDiscovery && (
            <p className="text-xs text-muted-foreground mt-0.5">Discovering…</p>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <SchemaTree
            connectorId={connectorId}
            schemas={schemas}
            tables={tables}
            onSelectTable={handleSelectTable}
            selectedTableId={selectedTableId}
          />
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0">
        {selectedTableId ? (
          <Tabs defaultValue="preview" className="h-full flex flex-col">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="columns">Columns</TabsTrigger>
              <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="flex-1 overflow-hidden">
              <TableBrowser
                rows={previewRows}
                isLoading={isLoadingPreview}
                tableId={selectedTableId}
              />
            </TabsContent>
            <TabsContent value="columns" className="flex-1 overflow-hidden">
              <ColumnInspector metadata={metadata} isLoading={isLoadingPreview} />
            </TabsContent>
            <TabsContent value="intelligence" className="flex-1 overflow-auto p-4 space-y-4">
              {isLoadingIntel && (
                <p className="text-sm text-muted-foreground">Running intelligence analysis…</p>
              )}
              {intelligenceResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Trust Score</span>
                    <Badge className="text-lg px-3 py-1">{intelligenceResult.trust.grade}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {intelligenceResult.trust.score}/100
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Copilot Summary</p>
                    <p className="text-sm text-muted-foreground">{intelligenceResult.copilot.headline}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">KPIs Detected</p>
                    <p className="text-sm text-muted-foreground">
                      {intelligenceResult.ingestion.dictionary.fields.length} fields catalogued
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Select a table from the sidebar to begin exploring.
          </div>
        )}
      </div>
    </div>
  )
}
