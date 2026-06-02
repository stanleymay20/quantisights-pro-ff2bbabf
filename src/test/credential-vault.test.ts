import { describe, it, expect, beforeEach } from 'vitest'
import { connectionPolicies } from '@/lib/security/connection-policies'
import type { ConnectionPolicy } from '@/lib/security/types'
import { credentialVault, _testEncryptDecrypt } from '@/lib/security/credential-vault'

function makePolicy(overrides?: Partial<ConnectionPolicy>): ConnectionPolicy {
  const now = new Date().toISOString()
  const defaults: ConnectionPolicy = {
    connectorId: 'test-conn',
    allowedOperations: ['read', 'schema_discovery', 'preview'],
    maxRowsPerQuery: 1000,
    allowedSchemas: [],
    allowedTables: [],
    requireApprovalForQuery: false,
    rateLimitPerMinute: 30,
    createdAt: now,
    updatedAt: now,
  }
  return { ...defaults, ...overrides }
}

describe('connectionPolicies', () => {
  it('default policy allows read', () => {
    expect(connectionPolicies.isAllowed('unknown-connector', 'read')).toBe(true)
  })

  it('restricted policy denies query', () => {
    connectionPolicies.set(makePolicy({
      connectorId: 'restricted',
      allowedOperations: ['read', 'schema_discovery'],
    }))
    expect(connectionPolicies.isAllowed('restricted', 'query')).toBe(false)
  })

  it('getMaxRows returns configured limit', () => {
    connectionPolicies.set(makePolicy({ connectorId: 'limited', maxRowsPerQuery: 500 }))
    expect(connectionPolicies.getMaxRows('limited')).toBe(500)
  })

  it('isSchemaAllowed returns true when allowedSchemas is empty (all allowed)', () => {
    connectionPolicies.set(makePolicy({ connectorId: 'open', allowedSchemas: [] }))
    expect(connectionPolicies.isSchemaAllowed('open', 'any_schema')).toBe(true)
  })

  it('isSchemaAllowed returns false when schema not in allowedSchemas', () => {
    connectionPolicies.set(makePolicy({ connectorId: 'restricted2', allowedSchemas: ['public'] }))
    expect(connectionPolicies.isSchemaAllowed('restricted2', 'private')).toBe(false)
    expect(connectionPolicies.isSchemaAllowed('restricted2', 'public')).toBe(true)
  })
})

describe('credentialVault', () => {
  it('isRotationDue returns true when nextRotation is in past', () => {
    const schedule = {
      connectorId: 'c1',
      intervalDays: 90,
      lastRotated: new Date(Date.now() - 100 * 86400000).toISOString(),
      nextRotation: new Date(Date.now() - 10 * 86400000).toISOString(),
      autoRotate: false,
    }
    expect(credentialVault.isRotationDue(schedule)).toBe(true)
  })

  it('isRotationDue returns false when nextRotation is in future', () => {
    const schedule = {
      connectorId: 'c1',
      intervalDays: 90,
      lastRotated: new Date().toISOString(),
      nextRotation: new Date(Date.now() + 90 * 86400000).toISOString(),
      autoRotate: false,
    }
    expect(credentialVault.isRotationDue(schedule)).toBe(false)
  })

  it('encrypt/decrypt roundtrip returns original credential', async () => {
    const original = { host: 'localhost', password: 'secret123', port: 5432 }
    const result = await _testEncryptDecrypt(original, 'my-passphrase')
    expect(result).toEqual(original)
  })
})
