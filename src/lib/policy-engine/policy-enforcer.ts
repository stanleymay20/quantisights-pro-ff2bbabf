import { policyStore } from './policy-store'
import { evaluatePolicies } from './policy-evaluator'
import { writeAuditLog } from '@/lib/lifecycle/audit'
import { eventBus } from '@/lib/realtime/event-bus'
import type { PolicyEvaluationContext, PolicyEvaluationResult } from './types'

export async function enforce(
  context: PolicyEvaluationContext
): Promise<PolicyEvaluationResult> {
  const policies = policyStore.listEnabled()
  const result = evaluatePolicies(policies, context)

  if (result.violations.length > 0) {
    const hasDeny = result.violations.some((v) => v.effect === 'deny')
    eventBus.publish({
      id: crypto.randomUUID(),
      category: 'governance',
      type: 'policy.violation',
      priority: hasDeny ? 'high' : 'normal',
      payload: { violations: result.violations, context },
      sourceId: context.connectorId,
      timestamp: new Date().toISOString(),
    })
  }

  if (!result.allowed) {
    await writeAuditLog({
      organization_id: context.organizationId ?? 'system',
      actor_id: context.userId ?? null,
      action_type: 'policy:access_denied',
      resource_type: 'policy_enforcement',
      resource_id: context.connectorId ?? '',
      payload: { violations: result.violations, context },
    })
  }

  return result
}
