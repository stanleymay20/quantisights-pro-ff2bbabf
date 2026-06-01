import { supabase } from '@/integrations/supabase/client'
import { connectionManager } from './connection-manager'
import type { ConnectorDiscoveryResult, TableInfo, TableMetadata } from '@/connectors/base/types'

export interface MetadataSnapshot {
  connectorId: string
  schemas: string[]
  tables: TableInfo[]
  tableMetadata: Record<string, TableMetadata>
  discoveredAt: string
}

export async function discoverDatabase(connectorId: string): Promise<ConnectorDiscoveryResult> {
  const connector = connectionManager.getConnector(connectorId)
  await emitAuditEvent(connectorId, 'database_discovery_started', {})
  const schemas = await connector.listSchemas()
  const tables = await connector.listTables()
  await emitAuditEvent(connectorId, 'database_discovery_completed', { schemaCount: schemas.length, tableCount: tables.length })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { connectorId, connectorType: (connector as any).config.type, schemas, tables, discoveredAt: new Date().toISOString() }
}

export async function discoverSchema(connectorId: string, schema: string): Promise<TableInfo[]> {
  const connector = connectionManager.getConnector(connectorId)
  await emitAuditEvent(connectorId, 'schema_discovery', { schema })
  return connector.listTables(schema)
}

export async function discoverTable(connectorId: string, tableId: string): Promise<TableMetadata> {
  const connector = connectionManager.getConnector(connectorId)
  await emitAuditEvent(connectorId, 'table_discovery', { tableId })
  return connector.getTableMetadata(tableId)
}

export async function buildMetadataSnapshot(connectorId: string, tableIds: string[]): Promise<MetadataSnapshot> {
  const connector = connectionManager.getConnector(connectorId)
  await emitAuditEvent(connectorId, 'metadata_snapshot_started', { tableCount: tableIds.length })
  const schemas = await connector.listSchemas()
  const tables = await connector.listTables()
  const tableMetadata: Record<string, TableMetadata> = {}
  for (const tableId of tableIds) {
    tableMetadata[tableId] = await connector.getTableMetadata(tableId)
  }
  const snapshot: MetadataSnapshot = { connectorId, schemas, tables, tableMetadata, discoveredAt: new Date().toISOString() }
  await emitAuditEvent(connectorId, 'metadata_snapshot_completed', { tableCount: tableIds.length })
  return snapshot
}

async function emitAuditEvent(connectorId: string, action: string, details: Record<string, unknown>): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      action,
      resource_type: 'database_connector',
      resource_id: connectorId,
      details: { connectorId, ...details },
    })
  } catch {
    // Non-fatal: audit emission should not block discovery
  }
}
