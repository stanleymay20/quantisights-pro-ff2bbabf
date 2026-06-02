import { eventBus } from './event-bus'
import { supabase } from '@/integrations/supabase/client'
import type { AlertStreamConfig } from './types'

class AlertStream {
  private timers = new Map<string, ReturnType<typeof setInterval>>()
  private configs = new Map<string, AlertStreamConfig>()

  start(config: AlertStreamConfig): void {
    if (this.timers.has(config.connectorId)) {
      this.stop(config.connectorId)
    }
    this.configs.set(config.connectorId, config)
    const timer = setInterval(() => {
      this.pollAlerts(config.connectorId).catch(() => {})
    }, config.pollingIntervalMs)
    this.timers.set(config.connectorId, timer)
  }

  stop(connectorId: string): void {
    const timer = this.timers.get(connectorId)
    if (timer) {
      clearInterval(timer)
      this.timers.delete(connectorId)
    }
    this.configs.delete(connectorId)
  }

  stopAll(): void {
    this.timers.forEach((_, connectorId) => this.stop(connectorId))
  }

  listActive(): AlertStreamConfig[] {
    return Array.from(this.configs.values())
  }

  private async pollAlerts(connectorId: string): Promise<void> {
    try {
      const config = this.configs.get(connectorId)
      if (!config) return
      const since = new Date(Date.now() - config.pollingIntervalMs * 2).toISOString()
      const { data } = await supabase
        .from('audit_log')
        .select('*')
        .eq('resource_id', connectorId)
        .gte('created_at', since)
      if (!data) return
      for (const row of data) {
        const actionType: string = row.action_type ?? ''
        if (
          actionType.startsWith('intelligence:') ||
          actionType.startsWith('vault:') ||
          actionType.includes('alert')
        ) {
          eventBus.publish(
            eventBus.constructor === Object
              ? { id: crypto.randomUUID(), category: 'observability', type: actionType, priority: 'normal', payload: row, sourceId: connectorId, timestamp: new Date().toISOString() }
              : {
                  id: crypto.randomUUID(),
                  category: 'observability' as const,
                  type: actionType,
                  priority: 'normal' as const,
                  payload: row as Record<string, unknown>,
                  sourceId: connectorId,
                  timestamp: new Date().toISOString(),
                }
          )
        }
      }
    } catch {
      // non-fatal
    }
  }
}

export const alertStream = new AlertStream()
