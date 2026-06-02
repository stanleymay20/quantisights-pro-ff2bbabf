import React, { useEffect, useState } from 'react'
import { EventFeed } from '@/components/realtime/EventFeed'
import { ConnectionStatusBar } from '@/components/realtime/ConnectionStatusBar'
import { useEventStream } from '@/hooks/useEventStream'
import { webSocketManager } from '@/lib/realtime/websocket-manager'
import type { EventCategory } from '@/lib/realtime/types'

const TABS: { label: string; value: EventCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Observability', value: 'observability' },
  { label: 'Governance', value: 'governance' },
  { label: 'Decision', value: 'decision' },
  { label: 'Security', value: 'security' },
]

const PLACEHOLDER_ORG_ID = 'demo-org'

export default function RealtimeDashboard() {
  const [activeTab, setActiveTab] = useState<EventCategory | 'all'>('all')
  const { events } = useEventStream()

  useEffect(() => {
    webSocketManager.subscribeToDecisionOutcomes(PLACEHOLDER_ORG_ID)
    webSocketManager.subscribeToExecutionPlans(PLACEHOLDER_ORG_ID)
    return () => webSocketManager.unsubscribeAll()
  }, [])

  const now = Date.now()
  const lastHour = events.filter((e) => now - new Date(e.timestamp).getTime() < 3_600_000)
  const criticalCount = lastHour.filter((e) => e.priority === 'critical').length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Real-Time Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Live event stream across all platform systems
          </p>
        </div>
        <ConnectionStatusBar organizationId={PLACEHOLDER_ORG_ID} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{lastHour.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Events (last hour)</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Critical Events</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{events.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total in Feed</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">
            {new Set(events.map((e) => e.category)).size}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Active Categories</p>
        </div>
      </div>

      <div>
        <div className="flex gap-2 border-b mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <EventFeed
          category={activeTab === 'all' ? undefined : activeTab}
          limit={50}
        />
      </div>
    </div>
  )
}
