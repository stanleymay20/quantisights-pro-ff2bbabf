import { supabase } from '@/integrations/supabase/client'
import type { VaultAuditEvent } from './types'

export async function emitVaultAuditEvent(event: Omit<VaultAuditEvent, 'id' | 'timestamp'>): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      action_type: `vault:${event.action}`,
      resource_type: 'credential_vault',
      resource_id: event.connectorId,
      metadata: {
        actor: event.actor,
        connectorId: event.connectorId,
        ...event.metadata,
      },
    })
  } catch {
    // non-fatal
  }
}
