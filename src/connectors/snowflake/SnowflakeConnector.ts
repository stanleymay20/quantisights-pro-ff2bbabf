import { BaseConnector } from '../base/BaseConnector'
import type { ConnectionConfig } from '../base/types'

export class SnowflakeConnector extends BaseConnector {
  constructor(config: ConnectionConfig) {
    super({ ...config, type: 'snowflake' })
  }
}
