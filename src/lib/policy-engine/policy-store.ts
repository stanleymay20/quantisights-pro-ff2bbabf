import type { Policy, PolicyType } from './types'

class PolicyStore {
  private policies: Policy[] = []

  add(policy: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Policy {
    const now = new Date().toISOString()
    const full: Policy = { ...policy, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
    this.policies.push(full)
    return full
  }

  get(id: string): Policy | undefined {
    return this.policies.find((p) => p.id === id)
  }

  update(id: string, updates: Partial<Omit<Policy, 'id' | 'createdAt'>>): Policy | undefined {
    const idx = this.policies.findIndex((p) => p.id === id)
    if (idx === -1) return undefined
    this.policies[idx] = { ...this.policies[idx], ...updates, updatedAt: new Date().toISOString() }
    return this.policies[idx]
  }

  remove(id: string): boolean {
    const prev = this.policies.length
    this.policies = this.policies.filter((p) => p.id !== id)
    return this.policies.length < prev
  }

  listByType(type: PolicyType): Policy[] {
    return this.policies.filter((p) => p.type === type)
  }

  listEnabled(): Policy[] {
    return this.policies.filter((p) => p.enabled)
  }

  loadDefaults(): void {
    this.add({
      name: 'PII Column Masking',
      description: 'Mask columns that contain PII data',
      type: 'pii_access',
      conditions: [{ field: 'column.contains_pii', operator: 'eq', value: true }],
      effect: 'mask',
      priority: 100,
      enabled: true,
      maskValue: '*** REDACTED ***',
    })
    this.add({
      name: 'Max Row Limit (10k)',
      description: 'Deny queries that would return more than 10,000 rows',
      type: 'row_security',
      conditions: [{ field: 'query.rowCount', operator: 'gte', value: 10001 }],
      effect: 'deny',
      priority: 90,
      enabled: true,
    })
    this.add({
      name: 'SQL Query Approval',
      description: 'Require approval for direct SQL queries',
      type: 'approval',
      conditions: [{ field: 'query.type', operator: 'eq', value: 'query' }],
      effect: 'require_approval',
      priority: 80,
      enabled: false,
    })
    this.add({
      name: 'Unknown Data Residency Warning',
      description: 'Warn when data residency is unknown',
      type: 'retention',
      conditions: [{ field: 'data.residency', operator: 'eq', value: 'unknown' }],
      effect: 'warn',
      priority: 50,
      enabled: true,
    })
  }
}

export const policyStore = new PolicyStore()
