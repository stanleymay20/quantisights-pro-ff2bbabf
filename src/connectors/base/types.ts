export type ConnectorType = 'postgres' | 'mysql' | 'sqlserver' | 'snowflake' | 'bigquery'

export interface ConnectionConfig {
  id: string
  type: ConnectorType
  name: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  ssl?: boolean
  // Snowflake
  account?: string
  warehouse?: string
  // BigQuery
  projectId?: string
  keyfile?: string
  createdAt: string
}

export interface TableInfo {
  schema: string
  name: string
  tableId: string  // "schema.name"
  rowCount?: number
  sizeBytes?: number
  comment?: string
}

export interface ColumnMetadata {
  name: string
  ordinalPosition: number
  dataType: string
  isNullable: boolean
  defaultValue?: string
  isPrimaryKey: boolean
  isForeignKey: boolean
  comment?: string
}

export interface TableMetadata {
  tableId: string
  schema: string
  name: string
  columns: ColumnMetadata[]
  rowCount?: number
  sizeBytes?: number
  comment?: string
}

export interface ColumnProfile {
  name: string
  dataType: string
  nullCount: number
  distinctCount: number
  minValue?: string
  maxValue?: string
  avgValue?: string
  topValues?: Array<{ value: string; count: number }>
}

export interface TableProfile {
  tableId: string
  rowCount: number
  columnProfiles: ColumnProfile[]
  profiledAt: string
}

export interface Connector {
  testConnection(): Promise<boolean>
  listSchemas(): Promise<string[]>
  listTables(schema?: string): Promise<TableInfo[]>
  getTableMetadata(tableId: string): Promise<TableMetadata>
  previewTable(tableId: string, limit?: number): Promise<Record<string, unknown>[]>
  profileTable(tableId: string): Promise<TableProfile>
}

export interface ConnectorDiscoveryResult {
  connectorId: string
  connectorType: ConnectorType
  schemas: string[]
  tables: TableInfo[]
  discoveredAt: string
}
