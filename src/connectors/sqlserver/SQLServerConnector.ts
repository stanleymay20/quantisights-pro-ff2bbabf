import { BaseConnector } from '../base/BaseConnector'
import type { ConnectionConfig } from '../base/types'

export class SQLServerConnector extends BaseConnector {
  constructor(config: ConnectionConfig) {
    super({ ...config, type: 'sqlserver' })
  }
}
