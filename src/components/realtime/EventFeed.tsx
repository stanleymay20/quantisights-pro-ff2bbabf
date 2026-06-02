import React from 'react'
import { useEventStream } from '@/hooks/useEventStream'
import type { EventCategory, PlatformEvent, EventPriority } from '@/lib/realtime/types'

const priorityBorder: Record<EventPriority, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-amber-500',
  normal: 'border-l-blue-500',
  low: 'border-l-gray-400',
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function PayloadSummary({ payload }: { payload: Record<string, unknown> }) {
  const keys = Object.keys(payload).slice(0, 2)
  return (
    <span className="text-xs text-muted-foreground truncate">
      {keys.map((k) => `${k}: ${JSON.stringify(payload[k])?.slice(0, 30)}`).join(' · ')}
    </span>
  )
}

function EventRow({ event }: { event: PlatformEvent }) {
  return (
    <div className={`border-l-4 ${priorityBorder[event.priority]} pl-3 py-2 bg-card rounded-sm mb-1`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{event.type}</span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(event.timestamp)}</span>
      </div>
      <PayloadSummary payload={event.payload} />
    </div>
  )
}

interface EventFeedProps {
  category?: EventCategory
  limit?: number
}

export function EventFeed({ category, limit = 50 }: EventFeedProps) {
  const { events, clearEvents } = useEventStream({ category, limit })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{events.length} events</span>
        <button
          onClick={clearEvents}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <div className="overflow-y-auto max-h-[400px] space-y-1">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No events yet</p>
        ) : (
          events.map((e) => <EventRow key={e.id} event={e} />)
        )}
      </div>
    </div>
  )
}
