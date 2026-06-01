export interface CatalogColumn {
  name: string
  ordinalPosition: number
  dataType: string
  isNullable: boolean
  isPrimaryKey: boolean
  isForeignKey: boolean
  comment?: string
}

export interface CatalogTable {
  tableId: string
  schema: string
  name: string
  columns: CatalogColumn[]
  rowCount?: number
  owner?: string
  comment?: string
  discoveredAt: string
}

export interface CatalogSchema {
  name: string
  tables: CatalogTable[]
  owner?: string
}

export interface CatalogDatabase {
  connectorId: string
  connectorType: string
  name: string
  schemas: CatalogSchema[]
  discoveredAt: string
}

export interface MetadataCatalog {
  databases: CatalogDatabase[]
  lastUpdated: string
}

class MetadataCatalogStore {
  private catalog: MetadataCatalog = { databases: [], lastUpdated: new Date().toISOString() }

  upsertDatabase(db: CatalogDatabase): void {
    const existing = this.catalog.databases.findIndex(d => d.connectorId === db.connectorId)
    if (existing >= 0) {
      this.catalog.databases[existing] = db
    } else {
      this.catalog.databases.push(db)
    }
    this.catalog.lastUpdated = new Date().toISOString()
  }

  getDatabase(connectorId: string): CatalogDatabase | undefined {
    return this.catalog.databases.find(d => d.connectorId === connectorId)
  }

  upsertTable(connectorId: string, schemaName: string, table: CatalogTable): void {
    let db = this.getDatabase(connectorId)
    if (!db) {
      db = { connectorId, connectorType: '', name: connectorId, schemas: [], discoveredAt: new Date().toISOString() }
      this.catalog.databases.push(db)
    }
    let schema = db.schemas.find(s => s.name === schemaName)
    if (!schema) {
      schema = { name: schemaName, tables: [] }
      db.schemas.push(schema)
    }
    const idx = schema.tables.findIndex(t => t.tableId === table.tableId)
    if (idx >= 0) {
      schema.tables[idx] = table
    } else {
      schema.tables.push(table)
    }
    this.catalog.lastUpdated = new Date().toISOString()
  }

  getTable(connectorId: string, tableId: string): CatalogTable | undefined {
    const db = this.getDatabase(connectorId)
    if (!db) return undefined
    for (const schema of db.schemas) {
      const table = schema.tables.find(t => t.tableId === tableId)
      if (table) return table
    }
    return undefined
  }

  getSnapshot(): MetadataCatalog {
    return this.catalog
  }

  clear(): void {
    this.catalog = { databases: [], lastUpdated: new Date().toISOString() }
  }
}

export const metadataCatalog = new MetadataCatalogStore()
