export interface VaultEntry {
  id: string
  connectorId: string
  connectorType: string
  label: string
  encryptedPayload: string
  keyVersion: number
  createdAt: string
  lastRotatedAt: string
  expiresAt?: string
  metadata: Record<string, unknown>
}

export interface ConnectionPolicy {
  connectorId: string
  allowedOperations: ('read' | 'schema_discovery' | 'preview' | 'query')[]
  maxRowsPerQuery: number
  allowedSchemas: string[]
  allowedTables: string[]
  requireApprovalForQuery: boolean
  rateLimitPerMinute: number
  createdAt: string
  updatedAt: string
}

export interface RotationSchedule {
  connectorId: string
  intervalDays: number
  lastRotated: string
  nextRotation: string
  autoRotate: boolean
}

export interface VaultAuditEvent {
  id: string
  connectorId: string
  action: 'created' | 'read' | 'rotated' | 'deleted' | 'policy_updated'
  actor: string
  metadata: Record<string, unknown>
  timestamp: string
}
