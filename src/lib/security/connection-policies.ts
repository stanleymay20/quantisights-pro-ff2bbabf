import type { ConnectionPolicy } from './types'

class ConnectionPolicyStore {
  private policies = new Map<string, ConnectionPolicy>()

  set(policy: ConnectionPolicy): void {
    this.policies.set(policy.connectorId, policy)
  }

  get(connectorId: string): ConnectionPolicy | undefined {
    return this.policies.get(connectorId)
  }

  getOrDefault(connectorId: string): ConnectionPolicy {
    return this.policies.get(connectorId) ?? ConnectionPolicyStore.defaultPolicy(connectorId)
  }

  isAllowed(connectorId: string, operation: ConnectionPolicy['allowedOperations'][number]): boolean {
    return this.getOrDefault(connectorId).allowedOperations.includes(operation)
  }

  getMaxRows(connectorId: string): number {
    return this.getOrDefault(connectorId).maxRowsPerQuery
  }

  isSchemaAllowed(connectorId: string, schema: string): boolean {
    const policy = this.getOrDefault(connectorId)
    if (policy.allowedSchemas.length === 0) return true
    return policy.allowedSchemas.includes(schema)
  }

  isTableAllowed(connectorId: string, tableId: string): boolean {
    const policy = this.getOrDefault(connectorId)
    if (policy.allowedTables.length === 0) return true
    return policy.allowedTables.includes(tableId)
  }

  static defaultPolicy(connectorId: string): ConnectionPolicy {
    const now = new Date().toISOString()
    return {
      connectorId,
      allowedOperations: ['read', 'schema_discovery', 'preview'],
      maxRowsPerQuery: 1000,
      allowedSchemas: [],
      allowedTables: [],
      requireApprovalForQuery: false,
      rateLimitPerMinute: 30,
      createdAt: now,
      updatedAt: now,
    }
  }
}

export const connectionPolicies = new ConnectionPolicyStore()
