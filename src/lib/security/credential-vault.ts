import { supabase } from '@/integrations/supabase/client'
import type { VaultEntry, RotationSchedule } from './types'

const KEY_VERSION = 1
const PBKDF2_ITERATIONS = 100_000

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

async function encryptCredential(credential: Record<string, unknown>, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(credential))
  )
  // Pack: salt(16) + iv(12) + ciphertext
  const packed = new Uint8Array(16 + 12 + ciphertext.byteLength)
  packed.set(salt, 0)
  packed.set(iv, 16)
  packed.set(new Uint8Array(ciphertext), 28)
  return btoa(String.fromCharCode(...packed))
}

async function decryptCredential(encrypted: string, passphrase: string): Promise<Record<string, unknown>> {
  const packed = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  const salt = packed.slice(0, 16)
  const iv = packed.slice(16, 28)
  const ciphertext = packed.slice(28)
  const key = await deriveKey(passphrase, salt)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return JSON.parse(new TextDecoder().decode(plaintext))
}

export async function _testEncryptDecrypt(
  credential: Record<string, unknown>,
  passphrase: string
): Promise<Record<string, unknown>> {
  const encrypted = await encryptCredential(credential, passphrase)
  return decryptCredential(encrypted, passphrase)
}

class CredentialVault {
  async store(params: {
    connectorId: string
    connectorType: string
    label: string
    credential: Record<string, unknown>
    passphrase: string
    expiresInDays?: number
  }): Promise<VaultEntry> {
    const { connectorId, connectorType, label, credential, passphrase, expiresInDays } = params
    const encryptedPayload = await encryptCredential(credential, passphrase)
    const now = new Date().toISOString()
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : undefined

    const entry: VaultEntry = {
      id: crypto.randomUUID(),
      connectorId,
      connectorType,
      label,
      encryptedPayload,
      keyVersion: KEY_VERSION,
      createdAt: now,
      lastRotatedAt: now,
      expiresAt,
      metadata: {},
    }

    await supabase.from('connector_configs').upsert({
      connector_id: connectorId,
      credential_vault_key: JSON.stringify({
        id: entry.id,
        connectorType,
        label,
        encryptedPayload,
        keyVersion: KEY_VERSION,
        createdAt: now,
        lastRotatedAt: now,
        expiresAt,
      }),
    })

    return entry
  }

  async retrieve(connectorId: string, passphrase: string): Promise<Record<string, unknown>> {
    const { data } = await supabase
      .from('connector_configs')
      .select('credential_vault_key')
      .eq('connector_id', connectorId)
      .single()

    if (!data?.credential_vault_key) throw new Error('No vault entry found for connector: ' + connectorId)
    const stored = JSON.parse(data.credential_vault_key as string)
    return decryptCredential(stored.encryptedPayload, passphrase)
  }

  async rotate(params: {
    connectorId: string
    newCredential: Record<string, unknown>
    oldPassphrase: string
    newPassphrase?: string
  }): Promise<VaultEntry> {
    const { connectorId, newCredential, oldPassphrase, newPassphrase } = params
    const passphrase = newPassphrase ?? oldPassphrase

    const { data } = await supabase
      .from('connector_configs')
      .select('credential_vault_key')
      .eq('connector_id', connectorId)
      .single()

    const existing = data?.credential_vault_key ? JSON.parse(data.credential_vault_key as string) : {}

    const encryptedPayload = await encryptCredential(newCredential, passphrase)
    const now = new Date().toISOString()

    const updated = {
      ...existing,
      encryptedPayload,
      keyVersion: KEY_VERSION,
      lastRotatedAt: now,
    }

    await supabase.from('connector_configs').upsert({
      connector_id: connectorId,
      credential_vault_key: JSON.stringify(updated),
    })

    return {
      id: existing.id || crypto.randomUUID(),
      connectorId,
      connectorType: existing.connectorType || '',
      label: existing.label || '',
      encryptedPayload,
      keyVersion: KEY_VERSION,
      createdAt: existing.createdAt || now,
      lastRotatedAt: now,
      expiresAt: existing.expiresAt,
      metadata: {},
    }
  }

  async remove(connectorId: string): Promise<void> {
    await supabase
      .from('connector_configs')
      .update({ credential_vault_key: null })
      .eq('connector_id', connectorId)
  }

  async listEntries(): Promise<Omit<VaultEntry, 'encryptedPayload'>[]> {
    const { data } = await supabase
      .from('connector_configs')
      .select('connector_id, credential_vault_key')

    if (!data) return []

    return data
      .filter(row => row.credential_vault_key)
      .map(row => {
        try {
          const stored = JSON.parse(row.credential_vault_key as string)
          return {
            id: stored.id || row.connector_id,
            connectorId: row.connector_id,
            connectorType: stored.connectorType || '',
            label: stored.label || '',
            keyVersion: stored.keyVersion || KEY_VERSION,
            createdAt: stored.createdAt || new Date().toISOString(),
            lastRotatedAt: stored.lastRotatedAt || new Date().toISOString(),
            expiresAt: stored.expiresAt,
            metadata: {},
          }
        } catch {
          return null
        }
      })
      .filter(Boolean) as Omit<VaultEntry, 'encryptedPayload'>[]
  }

  getRotationSchedule(connectorId: string, intervalDays: number): RotationSchedule {
    const lastRotated = new Date().toISOString()
    const nextRotation = new Date(Date.now() + intervalDays * 86400000).toISOString()
    return { connectorId, intervalDays, lastRotated, nextRotation, autoRotate: false }
  }

  isRotationDue(schedule: RotationSchedule): boolean {
    return new Date(schedule.nextRotation) <= new Date()
  }
}

export const credentialVault = new CredentialVault()
