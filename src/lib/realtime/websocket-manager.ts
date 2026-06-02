import { supabase } from '@/integrations/supabase/client'
import { eventBus } from './event-bus'
import type { RealtimeConnectionStatus } from './types'

class WebSocketManager {
  private channels = new Map<string, ReturnType<typeof supabase.channel>>()
  private status: RealtimeConnectionStatus = {
    connected: false,
    channelCount: 0,
    lastEventAt: null,
    reconnectAttempts: 0,
  }

  subscribeToTable(params: {
    channelName: string
    table: string
    schema?: string
    filter?: string
    onInsert?: (record: Record<string, unknown>) => void
    onUpdate?: (record: Record<string, unknown>) => void
    onDelete?: (record: Record<string, unknown>) => void
  }): void {
    const channel = supabase
      .channel(params.channelName)
      .on(
        'postgres_changes' as Parameters<ReturnType<typeof supabase.channel>['on']>[0],
        {
          event: '*',
          schema: params.schema ?? 'public',
          table: params.table,
          filter: params.filter,
        } as Parameters<ReturnType<typeof supabase.channel>['on']>[1],
        (payload: Record<string, unknown>) => {
          const record = ((payload.new ?? payload.old ?? {}) as Record<string, unknown>)
          const eventType = payload.eventType as string
          if (eventType === 'INSERT' && params.onInsert) params.onInsert(record)
          if (eventType === 'UPDATE' && params.onUpdate) params.onUpdate(record)
          if (eventType === 'DELETE' && params.onDelete) params.onDelete(record)
          this.status.lastEventAt = new Date().toISOString()
          this.updateStatus()
        }
      )
      .subscribe()
    this.channels.set(params.channelName, channel)
    this.updateStatus()
  }

  subscribeToDecisionOutcomes(organizationId: string): void {
    this.subscribeToTable({
      channelName: `decision_outcomes:${organizationId}`,
      table: 'decision_outcomes',
      filter: `organization_id=eq.${organizationId}`,
      onInsert: (record) => {
        eventBus.publish({
          id: crypto.randomUUID(),
          category: 'decision',
          type: 'decision.outcome.created',
          priority: 'normal',
          payload: record,
          timestamp: new Date().toISOString(),
        })
      },
      onUpdate: (record) => {
        eventBus.publish({
          id: crypto.randomUUID(),
          category: 'decision',
          type: 'decision.outcome.updated',
          priority: 'normal',
          payload: record,
          timestamp: new Date().toISOString(),
        })
      },
    })
  }

  subscribeToExecutionPlans(organizationId: string): void {
    this.subscribeToTable({
      channelName: `execution_plans:${organizationId}`,
      table: 'execution_plans',
      filter: `organization_id=eq.${organizationId}`,
      onInsert: (record) => {
        eventBus.publish({
          id: crypto.randomUUID(),
          category: 'decision',
          type: 'execution.plan.created',
          priority: 'normal',
          payload: record,
          timestamp: new Date().toISOString(),
        })
      },
      onUpdate: (record) => {
        eventBus.publish({
          id: crypto.randomUUID(),
          category: 'decision',
          type: 'execution.plan.updated',
          priority: 'normal',
          payload: record,
          timestamp: new Date().toISOString(),
        })
      },
    })
  }

  unsubscribe(channelName: string): void {
    const ch = this.channels.get(channelName)
    if (ch) {
      supabase.removeChannel(ch)
      this.channels.delete(channelName)
      this.updateStatus()
    }
  }

  unsubscribeAll(): void {
    this.channels.forEach((ch) => supabase.removeChannel(ch))
    this.channels.clear()
    this.updateStatus()
  }

  getStatus(): RealtimeConnectionStatus {
    return { ...this.status }
  }

  private updateStatus(): void {
    this.status.channelCount = this.channels.size
    this.status.connected = this.channels.size > 0
  }
}

export const webSocketManager = new WebSocketManager()
