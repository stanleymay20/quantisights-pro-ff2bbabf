import React, { useState } from 'react'
import type { MetadataGraph, GraphNode } from '@/lib/metadata-graph/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  graph: MetadataGraph
  onSelectNode: (node: GraphNode) => void
  selectedNodeId?: string
}

const TYPE_LABELS: Record<string, string> = {
  database: 'DB',
  schema: 'SCH',
  table: 'TBL',
  column: 'COL',
  dashboard: 'DASH',
  report: 'RPT',
  business_metric: 'METRIC',
  decision: 'DEC',
}

const TYPE_COLORS: Record<string, string> = {
  database: 'bg-blue-100 text-blue-800',
  schema: 'bg-purple-100 text-purple-800',
  table: 'bg-green-100 text-green-800',
  column: 'bg-gray-100 text-gray-800',
  dashboard: 'bg-orange-100 text-orange-800',
  report: 'bg-yellow-100 text-yellow-800',
  business_metric: 'bg-red-100 text-red-800',
  decision: 'bg-indigo-100 text-indigo-800',
}

function NodeRow({ node, depth, onSelectNode, selectedNodeId, children }: {
  node: GraphNode
  depth: number
  onSelectNode: (node: GraphNode) => void
  selectedNodeId?: string
  children?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = React.Children.count(children) > 0

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 rounded cursor-pointer hover:bg-muted/50 text-sm',
          selectedNodeId === node.id && 'bg-primary/10 font-medium'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelectNode(node)}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0"
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        ) : (
          <span className="w-4" />
        )}
        <Badge variant="outline" className={cn('text-xs px-1 py-0', TYPE_COLORS[node.type])}>
          {TYPE_LABELS[node.type] || node.type}
        </Badge>
        <span className="truncate">{node.label}</span>
      </div>
      {expanded && hasChildren && <div>{children}</div>}
    </div>
  )
}

export function GraphViewer({ graph, onSelectNode, selectedNodeId }: Props) {
  const dbNodes = [...graph.nodes.values()].filter(n => n.type === 'database')

  function getChildren(nodeId: string, type: GraphNode['type']): GraphNode[] {
    const childIds = graph.edges.filter(e => e.fromNodeId === nodeId).map(e => e.toNodeId)
    return childIds.map(id => graph.nodes.get(id)).filter(Boolean).filter(n => n!.type === type) as GraphNode[]
  }

  function getAllChildren(nodeId: string): GraphNode[] {
    const childIds = graph.edges.filter(e => e.fromNodeId === nodeId).map(e => e.toNodeId)
    return childIds.map(id => graph.nodes.get(id)).filter(Boolean) as GraphNode[]
  }

  if (dbNodes.length === 0) {
    return <div className="text-sm text-muted-foreground p-4">No nodes in graph.</div>
  }

  return (
    <div className="overflow-auto">
      {dbNodes.map(db => {
        const schemas = getChildren(db.id, 'schema')
        return (
          <NodeRow key={db.id} node={db} depth={0} onSelectNode={onSelectNode} selectedNodeId={selectedNodeId}>
            {schemas.map(schema => {
              const tables = getChildren(schema.id, 'table')
              return (
                <NodeRow key={schema.id} node={schema} depth={1} onSelectNode={onSelectNode} selectedNodeId={selectedNodeId}>
                  {tables.map(table => {
                    const columns = getAllChildren(table.id)
                    return (
                      <NodeRow key={table.id} node={table} depth={2} onSelectNode={onSelectNode} selectedNodeId={selectedNodeId}>
                        {columns.map(col => (
                          <NodeRow key={col.id} node={col} depth={3} onSelectNode={onSelectNode} selectedNodeId={selectedNodeId} />
                        ))}
                      </NodeRow>
                    )
                  })}
                </NodeRow>
              )
            })}
          </NodeRow>
        )
      })}
    </div>
  )
}
