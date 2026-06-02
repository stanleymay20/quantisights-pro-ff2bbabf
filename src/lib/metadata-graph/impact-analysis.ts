import type { MetadataGraph, ImpactedAsset } from './types'

function bfsImpact(
  nodeId: string,
  graph: MetadataGraph,
  maxDepth: number,
  direction: 'forward' | 'reverse'
): ImpactedAsset[] {
  const visited = new Set<string>([nodeId])
  const result: ImpactedAsset[] = []
  const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }]

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!
    if (depth > 0) {
      const node = graph.nodes.get(id)
      if (node) {
        result.push({
          nodeId: id,
          label: node.label,
          type: node.type,
          impactDistance: depth,
          impactType: depth === 1 ? 'direct' : 'indirect',
        })
      }
    }
    if (depth < maxDepth) {
      for (const edge of graph.edges) {
        const matchId = direction === 'forward' ? edge.fromNodeId : edge.toNodeId
        const nextId = direction === 'forward' ? edge.toNodeId : edge.fromNodeId
        if (matchId === id && !visited.has(nextId)) {
          visited.add(nextId)
          queue.push({ id: nextId, depth: depth + 1 })
        }
      }
    }
  }

  return result.sort((a, b) => a.impactDistance - b.impactDistance)
}

export function findImpactedAssets(
  nodeId: string,
  graph: MetadataGraph,
  maxDepth = 10
): ImpactedAsset[] {
  return bfsImpact(nodeId, graph, maxDepth, 'forward')
}

export function findUpstreamSources(
  nodeId: string,
  graph: MetadataGraph,
  maxDepth = 10
): ImpactedAsset[] {
  return bfsImpact(nodeId, graph, maxDepth, 'reverse')
}
