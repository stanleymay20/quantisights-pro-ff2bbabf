import type { MetadataGraph, LineagePath, GraphNode, GraphEdge } from './types'

export function traceColumnLineage(columnNodeId: string, graph: MetadataGraph): LineagePath {
  const visited = new Set<string>([columnNodeId])
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  const startNode = graph.nodes.get(columnNodeId)
  if (startNode) nodes.push(startNode)

  // Follow upstream (reverse) edges
  let current = columnNodeId
  let found = true
  while (found) {
    found = false
    for (const edge of graph.edges) {
      if (edge.toNodeId === current && !visited.has(edge.fromNodeId)) {
        const upstream = graph.nodes.get(edge.fromNodeId)
        if (upstream) {
          visited.add(edge.fromNodeId)
          nodes.unshift(upstream)
          edges.unshift(edge)
          current = edge.fromNodeId
          found = true
          break
        }
      }
    }
  }

  return { nodes, edges, depth: nodes.length }
}

export function shortestPath(fromNodeId: string, toNodeId: string, graph: MetadataGraph): LineagePath | null {
  if (fromNodeId === toNodeId) {
    const node = graph.nodes.get(fromNodeId)
    return node ? { nodes: [node], edges: [], depth: 1 } : null
  }

  const visited = new Set<string>([fromNodeId])
  const queue: Array<{ id: string; nodes: GraphNode[]; edges: GraphEdge[] }> = []

  const startNode = graph.nodes.get(fromNodeId)
  if (!startNode) return null
  queue.push({ id: fromNodeId, nodes: [startNode], edges: [] })

  while (queue.length > 0) {
    const { id, nodes, edges } = queue.shift()!

    for (const edge of graph.edges) {
      if (edge.fromNodeId !== id) continue
      const nextId = edge.toNodeId
      if (visited.has(nextId)) continue
      visited.add(nextId)

      const nextNode = graph.nodes.get(nextId)
      if (!nextNode) continue

      const newNodes = [...nodes, nextNode]
      const newEdges = [...edges, edge]

      if (nextId === toNodeId) {
        return { nodes: newNodes, edges: newEdges, depth: newNodes.length }
      }

      queue.push({ id: nextId, nodes: newNodes, edges: newEdges })
    }
  }

  return null
}
