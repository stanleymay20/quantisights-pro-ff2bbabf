export type EventCategory =
  | 'observability' | 'governance' | 'decision' | 'schema' | 'security' | 'system'

export type EventPriority = 'low' | 'normal' | 'high' | 'critical'

export interface PlatformEvent {
  id: string
  category: EventCategory
  type: string
  priority: EventPriority
  payload: Record<string, unknown>
  sourceId?: string
  timestamp: string
}

export interface EventSubscription {
  id: string
  category?: EventCategory
  types?: string[]
  handler: (event: PlatformEvent) => void
  createdAt: string
}

export interface NotificationRule {
  id: string
  name: string
  matchCategory?: EventCategory
  matchTypes?: string[]
  minPriority: EventPriority
  channels: NotificationChannel[]
  enabled: boolean
}

export type NotificationChannel = 'in_app' | 'console' | 'audit_log'

export interface AlertStreamConfig {
  connectorId: string
  tableIds: string[]
  pollingIntervalMs: number
  enabled: boolean
}

export interface RealtimeConnectionStatus {
  connected: boolean
  channelCount: number
  lastEventAt: string | null
  reconnectAttempts: number
}
