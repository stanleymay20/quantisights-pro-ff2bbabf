import { describe, it, expect, beforeEach } from 'vitest'
import { PolicyStore } from '../lib/policy-engine/policy-store-testable'
import { evaluatePolicies } from '../lib/policy-engine/policy-evaluator'
import type { Policy } from '../lib/policy-engine/types'

function makeDenyPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: 'p1',
    name: 'Test Deny',
    description: '',
    type: 'row_security',
    conditions: [{ field: 'query.rowCount', operator: 'gte', value: 100 }],
    effect: 'deny',
    priority: 50,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('PolicyStore', () => {
  let store: PolicyStore

  beforeEach(() => {
    store = new PolicyStore()
  })

  it('policyStore.add() adds policy with auto id', () => {
    const p = store.add({
      name: 'Test',
      description: '',
      type: 'pii_access',
      conditions: [],
      effect: 'warn',
      priority: 10,
      enabled: true,
    })
    expect(p.id).toBeDefined()
    expect(store.get(p.id)).toBeDefined()
  })

  it('policyStore.listEnabled() excludes disabled policies', () => {
    store.add({ name: 'A', description: '', type: 'pii_access', conditions: [], effect: 'warn', priority: 10, enabled: true })
    store.add({ name: 'B', description: '', type: 'pii_access', conditions: [], effect: 'warn', priority: 10, enabled: false })
    expect(store.listEnabled()).toHaveLength(1)
  })

  it('policyStore.loadDefaults() adds >= 4 policies', () => {
    store.loadDefaults()
    const all = store.listEnabled().length + store.listByType('approval').filter((p) => !p.enabled).length
    expect(all).toBeGreaterThanOrEqual(4)
  })
})

describe('evaluatePolicies', () => {
  it('with PII policy + containsPII=true → maskedColumns non-empty', () => {
    const policy = makeDenyPolicy({
      id: 'pii',
      type: 'pii_access',
      effect: 'mask',
      conditions: [{ field: 'column.contains_pii', operator: 'eq', value: true }],
    })
    const result = evaluatePolicies([policy], { containsPII: true, columnNames: ['ssn'] })
    expect(result.maskedColumns.length).toBeGreaterThan(0)
  })

  it('with deny policy matching → allowed=false', () => {
    const policy = makeDenyPolicy()
    const result = evaluatePolicies([policy], { rowCount: 200 })
    expect(result.allowed).toBe(false)
  })

  it('with deny policy NOT matching → allowed=true', () => {
    const policy = makeDenyPolicy()
    const result = evaluatePolicies([policy], { rowCount: 50 })
    expect(result.allowed).toBe(true)
  })

  it('with warn policy → warnings non-empty, still allowed', () => {
    const policy = makeDenyPolicy({ effect: 'warn', conditions: [{ field: 'data.residency', operator: 'eq', value: 'unknown' }] })
    const result = evaluatePolicies([policy], { dataResidency: 'unknown' })
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.allowed).toBe(true)
  })

  it('with require_approval → requiresApproval=true', () => {
    const policy = makeDenyPolicy({ effect: 'require_approval', conditions: [{ field: 'query.type', operator: 'eq', value: 'query' }] })
    const result = evaluatePolicies([policy], { queryType: 'query' })
    expect(result.requiresApproval).toBe(true)
  })

  it('with rowCount=5000 and row limit policy → allowed=true (under limit)', () => {
    const policy = makeDenyPolicy({ conditions: [{ field: 'query.rowCount', operator: 'gte', value: 10001 }] })
    const result = evaluatePolicies([policy], { rowCount: 5000 })
    expect(result.allowed).toBe(true)
  })

  it('with rowCount=15000 and row limit policy → allowed=false (over limit)', () => {
    const policy = makeDenyPolicy({ conditions: [{ field: 'query.rowCount', operator: 'gte', value: 10001 }] })
    const result = evaluatePolicies([policy], { rowCount: 15000 })
    expect(result.allowed).toBe(false)
  })

  it('empty policy list → always allowed', () => {
    const result = evaluatePolicies([], { rowCount: 99999, containsPII: true })
    expect(result.allowed).toBe(true)
    expect(result.effect).toBe('allow')
  })
})
