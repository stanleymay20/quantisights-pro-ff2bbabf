import React, { useState, useEffect } from 'react'
import { webSocketManager } from '@/lib/realtime/websocket-manager'

interface ConnectionStatusBarProps {
  organizationId: string
}

export function ConnectionStatusBar({ organizationId: _organizationId }: ConnectionStatusBarProps) {
  const [status, setStatus] = useState(() => webSocketManager.getStatus())

  useEffect(() => {
    const timer = setInterval(() => {
      setStatus(webSocketManager.getStatus())
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const isLive = status.connected

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className={`h-2 w-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className={isLive ? 'text-green-600' : 'text-red-600'}>
        {isLive ? 'Live' : 'Disconnected'}
      </span>
      <span className="text-muted-foreground">
        {status.channelCount} channel{status.channelCount !== 1 ? 's' : ''}
      </span>
      {status.lastEventAt && (
        <span className="text-muted-foreground">
          Last: {new Date(status.lastEventAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}
