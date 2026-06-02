import type {
  Policy,
  PolicyEvaluationContext,
  PolicyEvaluationResult,
  PolicyViolation,
  PolicyCondition,
} from './types'

function resolveField(field: string, context: PolicyEvaluationContext): unknown {
  switch (field) {
    case 'column.contains_pii': return context.containsPII
    case 'user.role': return context.userRole
    case 'connector.type': return context.connectorId?.split('-')[0]
    case 'query.type': return context.queryType
    case 'query.rowCount': return context.rowCount
    case 'data.residency': return context.dataResidency
    default: return undefined
  }
}

function evaluateCondition(condition: PolicyCondition, context: PolicyEvaluationContext): boolean {
  const actual = resolveField(condition.field, context)
  const expected = condition.value
  switch (condition.operator) {
    case 'eq': return actual === expected
    case 'neq': return actual !== expected
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string'
        ? actual.includes(expected)
        : Array.isArray(actual) && actual.includes(expected)
    case 'not_contains':
      return typeof actual === 'string' && typeof expected === 'string'
        ? !actual.includes(expected)
        : Array.isArray(actual) && !actual.includes(expected)
    case 'gte': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected
    case 'lte': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected
    default: return false
  }
}

export function evaluatePolicies(
  policies: Policy[],
  context: PolicyEvaluationContext
): PolicyEvaluationResult {
  const enabled = policies.filter((p) => p.enabled).sort((a, b) => b.priority - a.priority)

  const violations: PolicyViolation[] = []
  const maskedColumns: string[] = []
  let requiresApproval = false
  const warnings: string[] = []

  for (const policy of enabled) {
    const allMatch = policy.conditions.every((c) => evaluateCondition(c, context))
    if (!allMatch) continue

    if (policy.effect === 'deny') {
      violations.push({
        policyId: policy.id,
        policyName: policy.name,
        type: policy.type,
        effect: 'deny',
        message: `Access denied by policy: ${policy.name}`,
      })
    } else if (policy.effect === 'mask') {
      const cols = context.columnNames ?? ['*']
      cols.forEach((c) => {
        if (!maskedColumns.includes(c)) maskedColumns.push(c)
      })
      violations.push({
        policyId: policy.id,
        policyName: policy.name,
        type: policy.type,
        effect: 'mask',
        message: `Columns masked by policy: ${policy.name}`,
      })
    } else if (policy.effect === 'require_approval') {
      requiresApproval = true
      violations.push({
        policyId: policy.id,
        policyName: policy.name,
        type: policy.type,
        effect: 'require_approval',
        message: `Approval required by policy: ${policy.name}`,
      })
    } else if (policy.effect === 'warn') {
      warnings.push(`Warning from policy "${policy.name}"`)
    }
  }

  const hasDeny = violations.some((v) => v.effect === 'deny')
  const hasApproval = requiresApproval
  const hasMask = maskedColumns.length > 0

  let effect: PolicyEvaluationResult['effect'] = 'allow'
  if (hasDeny) effect = 'deny'
  else if (hasApproval) effect = 'require_approval'
  else if (hasMask) effect = 'mask'

  return {
    allowed: !hasDeny,
    effect,
    violations,
    maskedColumns,
    requiresApproval,
    warnings,
    evaluatedAt: new Date().toISOString(),
  }
}
