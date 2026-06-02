import { useEffect, useCallback, useState } from 'react'
import { eventBus } from '@/lib/realtime/event-bus'
import type { PlatformEvent, EventCategory } from '@/lib/realtime/types'

export function useEventStream(options?: {
  category?: EventCategory
  types?: string[]
  limit?: number
}): {
  events: PlatformEvent[]
  latestEvent: PlatformEvent | null
  isConnected: boolean
  clearEvents: () => void
} {
  const limit = options?.limit ?? 50
  const [events, setEvents] = useState<PlatformEvent[]>(() =>
    eventBus.getRecentEvents(options?.category, limit)
  )

  const clearEvents = useCallback(() => setEvents([]), [])

  useEffect(() => {
    const subId = eventBus.subscribe({
      category: options?.category,
      types: options?.types,
      handler: (event) => {
        setEvents((prev) => [event, ...prev].slice(0, limit))
      },
    })
    return () => eventBus.unsubscribe(subId)
  }, [options?.category, options?.types?.join(','), limit])

  return {
    events,
    latestEvent: events[0] ?? null,
    isConnected: true,
    clearEvents,
  }
}
