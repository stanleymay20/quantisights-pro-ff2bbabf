import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventBus } from '../lib/realtime/event-bus-testable'
import type { PlatformEvent } from '../lib/realtime/types'

function makeEvent(overrides: Partial<PlatformEvent> = {}): PlatformEvent {
  return {
    id: 'test-id',
    category: 'system',
    type: 'test.event',
    priority: 'normal',
    payload: { key: 'value' },
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  it('publish() delivers event to matching subscriber', () => {
    const handler = vi.fn()
    bus.subscribe({ handler })
    const event = makeEvent()
    bus.publish(event)
    expect(handler).toHaveBeenCalledWith(event)
  })

  it('publish() does NOT deliver to non-matching category subscriber', () => {
    const handler = vi.fn()
    bus.subscribe({ category: 'governance', handler })
    bus.publish(makeEvent({ category: 'system' }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('subscribe() returns unique ids', () => {
    const id1 = bus.subscribe({ handler: vi.fn() })
    const id2 = bus.subscribe({ handler: vi.fn() })
    expect(id1).not.toEqual(id2)
  })

  it('unsubscribe() stops delivery', () => {
    const handler = vi.fn()
    const id = bus.subscribe({ handler })
    bus.unsubscribe(id)
    bus.publish(makeEvent())
    expect(handler).not.toHaveBeenCalled()
  })

  it('getRecentEvents() returns events in reverse chronological order', () => {
    const e1 = makeEvent({ id: '1', timestamp: '2024-01-01T00:00:00Z' })
    const e2 = makeEvent({ id: '2', timestamp: '2024-01-02T00:00:00Z' })
    bus.publish(e1)
    bus.publish(e2)
    const events = bus.getRecentEvents()
    expect(events[0].id).toBe('2') // most recent first
    expect(events[1].id).toBe('1')
  })

  it('getRecentEvents(category) filters correctly', () => {
    bus.publish(makeEvent({ id: '1', category: 'governance' }))
    bus.publish(makeEvent({ id: '2', category: 'system' }))
    const events = bus.getRecentEvents('governance')
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('1')
  })

  it('maxLogSize is respected (after 500 events, log is trimmed)', () => {
    for (let i = 0; i < 510; i++) {
      bus.publish(makeEvent({ id: String(i) }))
    }
    const events = bus.getRecentEvents(undefined, 1000)
    expect(events.length).toBe(500)
  })

  it('EventBus.createEvent() adds id and timestamp', () => {
    const event = EventBus.createEvent({
      category: 'system',
      type: 'test',
      priority: 'low',
      payload: {},
    })
    expect(event.id).toBeDefined()
    expect(event.timestamp).toBeDefined()
    expect(typeof event.id).toBe('string')
  })

  it('multiple subscribers for same event all receive it', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.subscribe({ handler: h1 })
    bus.subscribe({ handler: h2 })
    bus.publish(makeEvent())
    expect(h1).toHaveBeenCalled()
    expect(h2).toHaveBeenCalled()
  })

  it('subscriber with types filter only receives matching types', () => {
    const handler = vi.fn()
    bus.subscribe({ types: ['alert.fired'], handler })
    bus.publish(makeEvent({ type: 'alert.fired' }))
    bus.publish(makeEvent({ type: 'other.event' }))
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
