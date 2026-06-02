export type PolicyType =
  | 'pii_access' | 'data_residency' | 'retention' | 'approval' | 'rate_limit' | 'row_security' | 'column_security'

export type PolicyEffect = 'allow' | 'deny' | 'require_approval' | 'mask' | 'warn'

export interface PolicyCondition {
  field: string
  operator: 'eq' | 'neq' | 'contains' | 'not_contains' | 'gte' | 'lte'
  value: unknown
}

export interface Policy {
  id: string
  name: string
  description: string
  type: PolicyType
  conditions: PolicyCondition[]
  effect: PolicyEffect
  priority: number
  enabled: boolean
  maskValue?: string
  approvalGroupId?: string
  createdAt: string
  updatedAt: string
}

export interface PolicyEvaluationContext {
  userId?: string
  userRole?: string
  connectorId?: string
  tableId?: string
  columnNames?: string[]
  containsPII?: boolean
  dataResidency?: string
  queryType?: 'read' | 'schema_discovery' | 'preview' | 'query'
  rowCount?: number
  organizationId?: string
}

export interface PolicyViolation {
  policyId: string
  policyName: string
  type: PolicyType
  effect: PolicyEffect
  message: string
  column?: string
}

export interface PolicyEvaluationResult {
  allowed: boolean
  effect: PolicyEffect
  violations: PolicyViolation[]
  maskedColumns: string[]
  requiresApproval: boolean
  warnings: string[]
  evaluatedAt: string
}
