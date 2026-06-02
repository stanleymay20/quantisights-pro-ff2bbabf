import { useState, useMemo } from 'react'
import { metadataCatalog } from '@/lib/catalog/metadata-catalog'
import { buildGraph } from '@/lib/metadata-graph/graph-builder'
import { businessGlossary } from '@/lib/metadata-graph/business-glossary'
import { traceColumnLineage } from '@/lib/metadata-graph/lineage-tracer'
import type { GraphNode, LineagePath } from '@/lib/metadata-graph/types'
import { GraphViewer } from '@/components/metadata-graph/GraphViewer'
import { NodeInspector } from '@/components/metadata-graph/NodeInspector'
import { ImpactPanel } from '@/components/metadata-graph/ImpactPanel'
import { LineagePathView } from '@/components/metadata-graph/LineagePathView'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function MetadataGraphPage() {
  const catalog = metadataCatalog.getSnapshot()
  const connectors = catalog.databases.map(db => db.connectorId)

  const [selectedConnector, setSelectedConnector] = useState<string | null>(connectors[0] ?? null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [lineagePath, setLineagePath] = useState<LineagePath | null>(null)

  const graph = useMemo(() => {
    if (!selectedConnector) return buildGraph({ databases: [], lastUpdated: '' })
    const db = catalog.databases.find(d => d.connectorId === selectedConnector)
    return buildGraph({ databases: db ? [db] : [], lastUpdated: catalog.lastUpdated })
  }, [selectedConnector, catalog])

  const terms = businessGlossary.getSnapshot().terms

  function handleSelectNode(node: GraphNode) {
    setSelectedNode(node)
    setLineagePath(null)
  }

  function handleTraceImpact(nodeId: string) {
    setLineagePath(traceColumnLineage(nodeId, graph))
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Metadata Graph</h1>
        {connectors.length > 0 && (
          <Select value={selectedConnector ?? ''} onValueChange={setSelectedConnector}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select connector" />
            </SelectTrigger>
            <SelectContent>
              {connectors.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedConnector || connectors.length === 0 ? (
        <p className="text-muted-foreground">Connect a data source to explore the metadata graph.</p>
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-160px)]">
          <div className="border rounded overflow-auto">
            <GraphViewer
              graph={graph}
              onSelectNode={handleSelectNode}
              selectedNodeId={selectedNode?.id}
            />
          </div>
          <div className="space-y-4 overflow-auto">
            <NodeInspector
              node={selectedNode}
              graph={graph}
              businessTerms={terms}
              onTraceImpact={handleTraceImpact}
              onFindSources={handleTraceImpact}
            />
            <ImpactPanel nodeId={selectedNode?.id ?? null} graph={graph} />
            {lineagePath && (
              <div className="border rounded">
                <p className="text-sm font-medium p-3 border-b">Lineage Path</p>
                <LineagePathView path={lineagePath} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
