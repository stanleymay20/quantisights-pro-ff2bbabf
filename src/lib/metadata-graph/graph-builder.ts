import type { MetadataGraph, GraphNode, GraphEdge, EdgeType } from './types'
import type { MetadataCatalog } from '@/lib/catalog/metadata-catalog'

type LineageNode = {
  source_id: string
  target_id: string
  source_type: string
  target_type: string
  source_name?: string
  target_name?: string
  transformation?: string
}

function makeNode(id: string, type: GraphNode['type'], label: string, metadata: Record<string, unknown> = {}): GraphNode {
  return { id, type, label, metadata, discoveredAt: new Date().toISOString() }
}

function makeEdge(fromNodeId: string, toNodeId: string, type: EdgeType): GraphEdge {
  return {
    id: `${fromNodeId}→${toNodeId}:${type}`,
    fromNodeId,
    toNodeId,
    type,
    confidence: 1,
    metadata: {},
  }
}

export function buildGraph(
  catalog: MetadataCatalog,
  lineageNodes?: LineageNode[]
): MetadataGraph {
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []

  for (const db of catalog.databases) {
    const dbId = `db:${db.connectorId}`
    nodes.set(dbId, makeNode(dbId, 'database', db.name || db.connectorId))

    for (const schema of db.schemas) {
      const schemaId = `schema:${db.connectorId}.${schema.name}`
      nodes.set(schemaId, makeNode(schemaId, 'schema', schema.name))
      edges.push(makeEdge(dbId, schemaId, 'contains'))

      for (const table of schema.tables) {
        const tableId = `table:${table.tableId}`
        nodes.set(tableId, makeNode(tableId, 'table', table.name, { rowCount: table.rowCount }))
        edges.push(makeEdge(schemaId, tableId, 'contains'))

        for (const col of table.columns) {
          const colId = `col:${table.tableId}.${col.name}`
          const colMeta: Record<string, unknown> = { dataType: col.dataType, isNullable: col.isNullable }
          if (col.isPrimaryKey) colMeta.isPK = true
          if (col.isForeignKey) colMeta.isFK = true
          nodes.set(colId, makeNode(colId, 'column', col.name, colMeta))
          edges.push(makeEdge(tableId, colId, 'contains'))
        }
      }
    }
  }

  if (lineageNodes) {
    for (const ln of lineageNodes) {
      let edgeType: EdgeType = 'derived_from'
      if (ln.transformation) {
        const t = ln.transformation.toLowerCase()
        if (t.includes('feed') || t.includes('dashboard') || t.includes('report')) edgeType = 'feeds'
        else if (t.includes('measure') || t.includes('metric')) edgeType = 'measures'
        else if (t.includes('inform') || t.includes('decision')) edgeType = 'informs'
        else if (t.includes('ref') || t.includes('fk') || t.includes('foreign')) edgeType = 'references'
      }
      const srcType = ln.source_type as GraphNode['type']
      const tgtType = ln.target_type as GraphNode['type']
      if (!nodes.has(ln.source_id)) {
        nodes.set(ln.source_id, makeNode(ln.source_id, srcType, ln.source_name || ln.source_id))
      }
      if (!nodes.has(ln.target_id)) {
        nodes.set(ln.target_id, makeNode(ln.target_id, tgtType, ln.target_name || ln.target_id))
      }
      edges.push({
        id: `${ln.source_id}→${ln.target_id}:${edgeType}`,
        fromNodeId: ln.source_id,
        toNodeId: ln.target_id,
        type: edgeType,
        confidence: 0.9,
        metadata: { transformation: ln.transformation },
      })
    }
  }

  return { nodes, edges, version: 1, lastUpdated: new Date().toISOString() }
}
