import { eventBus } from './event-bus'
import { writeAuditLog } from '@/lib/lifecycle/audit'
import type { NotificationRule, PlatformEvent, EventPriority } from './types'

const PRIORITY_RANK: Record<EventPriority, number> = { low: 0, normal: 1, high: 2, critical: 3 }

class NotificationRouter {
  private rules: NotificationRule[] = []
  private subscriptionId: string | null = null

  start(): void {
    if (this.subscriptionId) return
    this.subscriptionId = eventBus.subscribe({
      handler: (event) => {
        this.route(event).catch(() => {})
      },
    })
  }

  stop(): void {
    if (this.subscriptionId) {
      eventBus.unsubscribe(this.subscriptionId)
      this.subscriptionId = null
    }
  }

  addRule(rule: Omit<NotificationRule, 'id'>): string {
    const id = crypto.randomUUID()
    this.rules.push({ ...rule, id })
    return id
  }

  removeRule(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id)
  }

  listRules(): NotificationRule[] {
    return [...this.rules]
  }

  private async route(event: PlatformEvent): Promise<void> {
    for (const rule of this.rules) {
      if (!rule.enabled) continue
      const categoryMatch = !rule.matchCategory || rule.matchCategory === event.category
      const typeMatch = !rule.matchTypes || rule.matchTypes.includes(event.type)
      const priorityMatch = PRIORITY_RANK[event.priority] >= PRIORITY_RANK[rule.minPriority]
      if (categoryMatch && typeMatch && priorityMatch) {
        for (const channel of rule.channels) {
          await this.dispatch(event, channel)
        }
      }
    }
  }

  private async dispatch(
    event: PlatformEvent,
    channel: NotificationRule['channels'][number]
  ): Promise<void> {
    if (channel === 'console') {
      console.log('[Quantivis Event]', event.type, event.priority, event.payload)
    } else if (channel === 'audit_log') {
      await writeAuditLog({
        organization_id: (event.payload.organizationId as string) ?? 'system',
        actor_id: null,
        action_type: `event:${event.type}`,
        resource_type: event.category,
        resource_id: event.sourceId ?? '',
        payload: event.payload,
      })
    }
    // 'in_app': no-op — UI polling handles this
  }
}

export const notificationRouter = new NotificationRouter()
