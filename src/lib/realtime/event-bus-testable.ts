// Re-export the EventBus class for testing
import type { PlatformEvent, EventSubscription, EventCategory } from './types'

export class EventBus {
  private subscriptions = new Map<string, EventSubscription>()
  private eventLog: PlatformEvent[] = []
  private readonly maxLogSize = 500

  publish(event: PlatformEvent): void {
    this.eventLog.unshift(event)
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(0, this.maxLogSize)
    }
    this.subscriptions.forEach((sub) => {
      const categoryMatch = !sub.category || sub.category === event.category
      const typeMatch = !sub.types || sub.types.includes(event.type)
      if (categoryMatch && typeMatch) {
        try {
          sub.handler(event)
        } catch (err) {
          console.error('[EventBus] Handler error:', err)
        }
      }
    })
  }

  subscribe(sub: Omit<EventSubscription, 'id' | 'createdAt'>): string {
    const id = crypto.randomUUID()
    this.subscriptions.set(id, {
      ...sub,
      id,
      createdAt: new Date().toISOString(),
    })
    return id
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId)
  }

  getRecentEvents(category?: EventCategory, limit = 100): PlatformEvent[] {
    const filtered = category
      ? this.eventLog.filter((e) => e.category === category)
      : this.eventLog
    return filtered.slice(0, limit)
  }

  clearLog(): void {
    this.eventLog = []
  }

  static createEvent(params: Omit<PlatformEvent, 'id' | 'timestamp'>): PlatformEvent {
    return {
      ...params,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }
  }
}
