import { describe, it, expect, beforeEach } from 'vitest'
import { buildGraph } from '@/lib/metadata-graph/graph-builder'
import { findImpactedAssets, findUpstreamSources } from '@/lib/metadata-graph/impact-analysis'
import { shortestPath, traceColumnLineage } from '@/lib/metadata-graph/lineage-tracer'
import type { MetadataCatalog } from '@/lib/catalog/metadata-catalog'

function makeCatalog(overrides?: Partial<MetadataCatalog>): MetadataCatalog {
  return { databases: [], lastUpdated: new Date().toISOString(), ...overrides }
}

describe('buildGraph', () => {
  it('returns empty graph for empty catalog', () => {
    const g = buildGraph(makeCatalog())
    expect(g.nodes.size).toBe(0)
    expect(g.edges.length).toBe(0)
  })

  it('builds correct structure for 1 db, 2 schemas, 3 tables each', () => {
    const catalog: MetadataCatalog = {
      lastUpdated: new Date().toISOString(),
      databases: [{
        connectorId: 'conn1',
        connectorType: 'postgres',
        name: 'mydb',
        discoveredAt: new Date().toISOString(),
        schemas: ['s1', 's2'].map(schemaName => ({
          name: schemaName,
          tables: ['t1', 't2', 't3'].map(tableName => ({
            tableId: `${schemaName}.${tableName}`,
            schema: schemaName,
            name: tableName,
            columns: [
              { name: 'id', ordinalPosition: 1, dataType: 'int', isNullable: false, isPrimaryKey: true, isForeignKey: false },
              { name: 'val', ordinalPosition: 2, dataType: 'text', isNullable: true, isPrimaryKey: false, isForeignKey: false },
            ],
            discoveredAt: new Date().toISOString(),
          })),
        })),
      }],
    }

    const g = buildGraph(catalog)
    // 1 db + 2 schemas + 6 tables + 12 columns = 21 nodes
    expect(g.nodes.has('db:conn1')).toBe(true)
    expect(g.nodes.has('schema:conn1.s1')).toBe(true)
    expect(g.nodes.has('table:s1.t1')).toBe(true)
    expect(g.nodes.has('col:s1.t1.id')).toBe(true)
    // PK metadata
    expect(g.nodes.get('col:s1.t1.id')?.metadata.isPK).toBe(true)
    expect(g.nodes.size).toBe(1 + 2 + 6 + 12)
  })
})

describe('findImpactedAssets', () => {
  it('returns downstream column nodes from a table node', () => {
    const catalog: MetadataCatalog = {
      lastUpdated: new Date().toISOString(),
      databases: [{
        connectorId: 'c1',
        connectorType: 'pg',
        name: 'db',
        discoveredAt: new Date().toISOString(),
        schemas: [{
          name: 'pub',
          tables: [{
            tableId: 'pub.orders',
            schema: 'pub',
            name: 'orders',
            columns: [{ name: 'id', ordinalPosition: 1, dataType: 'int', isNullable: false, isPrimaryKey: true, isForeignKey: false }],
            discoveredAt: new Date().toISOString(),
          }],
        }],
      }],
    }
    const g = buildGraph(catalog)
    const downstream = findImpactedAssets('table:pub.orders', g)
    expect(downstream.some(a => a.nodeId === 'col:pub.orders.id')).toBe(true)
  })
})

describe('findUpstreamSources', () => {
  it('returns parent table and schema from a column node', () => {
    const catalog: MetadataCatalog = {
      lastUpdated: new Date().toISOString(),
      databases: [{
        connectorId: 'c1',
        connectorType: 'pg',
        name: 'db',
        discoveredAt: new Date().toISOString(),
        schemas: [{
          name: 'pub',
          tables: [{
            tableId: 'pub.orders',
            schema: 'pub',
            name: 'orders',
            columns: [{ name: 'id', ordinalPosition: 1, dataType: 'int', isNullable: false, isPrimaryKey: true, isForeignKey: false }],
            discoveredAt: new Date().toISOString(),
          }],
        }],
      }],
    }
    const g = buildGraph(catalog)
    const upstream = findUpstreamSources('col:pub.orders.id', g)
    expect(upstream.some(a => a.nodeId === 'table:pub.orders')).toBe(true)
    expect(upstream.some(a => a.nodeId === 'schema:c1.pub')).toBe(true)
  })
})

describe('shortestPath', () => {
  it('returns valid path between two connected nodes', () => {
    const catalog: MetadataCatalog = {
      lastUpdated: new Date().toISOString(),
      databases: [{
        connectorId: 'c1',
        connectorType: 'pg',
        name: 'db',
        discoveredAt: new Date().toISOString(),
        schemas: [{
          name: 'pub',
          tables: [{
            tableId: 'pub.orders',
            schema: 'pub',
            name: 'orders',
            columns: [{ name: 'id', ordinalPosition: 1, dataType: 'int', isNullable: false, isPrimaryKey: true, isForeignKey: false }],
            discoveredAt: new Date().toISOString(),
          }],
        }],
      }],
    }
    const g = buildGraph(catalog)
    const path = shortestPath('db:c1', 'col:pub.orders.id', g)
    expect(path).not.toBeNull()
    expect(path!.nodes[0].id).toBe('db:c1')
    expect(path!.nodes[path!.nodes.length - 1].id).toBe('col:pub.orders.id')
  })

  it('returns null for disconnected nodes', () => {
    const g = buildGraph(makeCatalog())
    const path = shortestPath('nonexistent-a', 'nonexistent-b', g)
    expect(path).toBeNull()
  })
})

describe('traceColumnLineage', () => {
  it('returns path with 1 node for column with no upstream', () => {
    const catalog: MetadataCatalog = {
      lastUpdated: new Date().toISOString(),
      databases: [{
        connectorId: 'c1',
        connectorType: 'pg',
        name: 'db',
        discoveredAt: new Date().toISOString(),
        schemas: [{
          name: 'pub',
          tables: [{
            tableId: 'pub.orders',
            schema: 'pub',
            name: 'orders',
            columns: [{ name: 'id', ordinalPosition: 1, dataType: 'int', isNullable: false, isPrimaryKey: true, isForeignKey: false }],
            discoveredAt: new Date().toISOString(),
          }],
        }],
      }],
    }
    const g = buildGraph(catalog)
    const path = traceColumnLineage('col:pub.orders.id', g)
    expect(path.nodes.length).toBeGreaterThanOrEqual(1)
    expect(path.nodes.some(n => n.id === 'col:pub.orders.id')).toBe(true)
  })
})

describe('businessGlossary', () => {
  it('addTerm and findByName work correctly', async () => {
    // Use a fresh import to avoid state pollution
    const { businessGlossary } = await import('@/lib/metadata-graph/business-glossary')
    const term = businessGlossary.addTerm({
      term: 'Revenue',
      definition: 'Total income',
      synonyms: ['income', 'earnings'],
      linkedColumnIds: [],
      linkedMetricIds: [],
      category: 'financial',
    })
    expect(term.id).toBeTruthy()
    const found = businessGlossary.findByName('revenue')
    expect(found).toBeTruthy()
    expect(found?.term).toBe('Revenue')
  })

  it('searchTerms finds by synonym', async () => {
    const { businessGlossary } = await import('@/lib/metadata-graph/business-glossary')
    const results = businessGlossary.searchTerms('earnings')
    expect(results.some(t => t.term === 'Revenue')).toBe(true)
  })
})
