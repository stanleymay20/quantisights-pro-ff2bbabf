import { supabase } from '@/integrations/supabase/client'
import type { ConnectionConfig, ConnectorType, TableInfo } from '@/connectors/base/types'
import { PostgresConnector } from '@/connectors/postgres'
import { MySQLConnector } from '@/connectors/mysql'
import { SQLServerConnector } from '@/connectors/sqlserver'
import { SnowflakeConnector } from '@/connectors/snowflake'
import { BigQueryConnector } from '@/connectors/bigquery'
import type { BaseConnector } from '@/connectors/base/BaseConnector'

// Suppress unused import warning — TableInfo is re-exported for consumers
export type { TableInfo }

export class ConnectionManager {
  private connectors = new Map<string, BaseConnector>()

  registerConnector(config: ConnectionConfig): void {
    const connector = this.createConnector(config)
    this.connectors.set(config.id, connector)
  }

  getConnector(id: string): BaseConnector {
    const connector = this.connectors.get(id)
    if (!connector) throw new Error(`No connector registered with id: ${id}`)
    return connector
  }

  removeConnector(id: string): void {
    this.connectors.delete(id)
  }

  async testConnection(id: string): Promise<boolean> {
    return this.getConnector(id).testConnection()
  }

  listAvailableSources(): ConnectorType[] {
    return ['postgres', 'mysql', 'sqlserver', 'snowflake', 'bigquery']
  }

  private createConnector(config: ConnectionConfig): BaseConnector {
    switch (config.type) {
      case 'postgres':    return new PostgresConnector(config)
      case 'mysql':       return new MySQLConnector(config)
      case 'sqlserver':   return new SQLServerConnector(config)
      case 'snowflake':   return new SnowflakeConnector(config)
      case 'bigquery':    return new BigQueryConnector(config)
      default:            throw new Error(`Unsupported connector type: ${(config as ConnectionConfig).type}`)
    }
  }

  // Persist config to Supabase connector_configs table
  async persistConfig(config: Omit<ConnectionConfig, 'id' | 'createdAt'>): Promise<ConnectionConfig> {
    const { data, error } = await supabase
      .from('connector_configs')
      .insert({
        name: config.name,
        connector_type: config.type,
        config: config,
        status: 'pending',
      })
      .select('id, created_at')
      .single()
    if (error) throw new Error(`Failed to persist connector config: ${error.message}`)
    const fullConfig: ConnectionConfig = {
      ...config,
      id: data.id,
      createdAt: data.created_at,
    }
    this.registerConnector(fullConfig)
    return fullConfig
  }

  // Load persisted connectors from Supabase
  async loadPersistedConnectors(): Promise<ConnectionConfig[]> {
    const { data, error } = await supabase
      .from('connector_configs')
      .select('id, name, connector_type, config, created_at')
      .eq('status', 'active')
    if (error || !data) return []
    return data.map(row => {
      const cfg: ConnectionConfig = {
        ...(row.config as object),
        id: row.id,
        name: row.name,
        type: row.connector_type as ConnectorType,
        createdAt: row.created_at,
      }
      this.registerConnector(cfg)
      return cfg
    })
  }
}

export const connectionManager = new ConnectionManager()
