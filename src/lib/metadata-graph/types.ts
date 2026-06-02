export type NodeType =
  | 'database' | 'schema' | 'table' | 'column'
  | 'dashboard' | 'report' | 'business_metric' | 'decision'

export type EdgeType =
  | 'contains'
  | 'references'
  | 'feeds'
  | 'measures'
  | 'informs'
  | 'derived_from'

export interface GraphNode {
  id: string
  type: NodeType
  label: string
  metadata: Record<string, unknown>
  discoveredAt: string
}

export interface GraphEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  type: EdgeType
  confidence: number
  metadata: Record<string, unknown>
}

export interface LineagePath {
  nodes: GraphNode[]
  edges: GraphEdge[]
  depth: number
}

export interface BusinessMetric {
  id: string
  name: string
  description: string
  formula?: string
  linkedColumnIds: string[]
  linkedTableIds: string[]
  owner?: string
  category: 'financial' | 'operational' | 'customer' | 'people' | 'risk' | 'growth'
  createdAt: string
}

export interface DataAsset {
  id: string
  nodeId: string
  name: string
  type: NodeType
  trustScore?: number
  freshnessScore?: number
  rowCount?: number
  lastSeen: string
}

export interface MetadataGraph {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  version: number
  lastUpdated: string
}

export interface ImpactedAsset {
  nodeId: string
  label: string
  type: NodeType
  impactDistance: number
  impactType: 'direct' | 'indirect'
}
