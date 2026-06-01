import { BaseConnector } from '../base/BaseConnector'
import type { ConnectionConfig } from '../base/types'

export class PostgresConnector extends BaseConnector {
  constructor(config: ConnectionConfig) {
    super({ ...config, type: 'postgres' })
  }
}
