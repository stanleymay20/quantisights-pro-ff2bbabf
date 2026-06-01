import { BaseConnector } from '../base/BaseConnector'
import type { ConnectionConfig } from '../base/types'

export class BigQueryConnector extends BaseConnector {
  constructor(config: ConnectionConfig) {
    super({ ...config, type: 'bigquery' })
  }
}
