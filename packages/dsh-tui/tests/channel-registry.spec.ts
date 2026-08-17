import { describe, expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  createChannelRegistry,
  DEFAULT_MAX_LIVE_SLOTS,
  type ChannelRegistryHost,
  type SessionSlot,
} from '../src/chat/channel-registry.ts'

/** Minimal agent surface the registry reads: identity, status, and session id. */
function fakeAgent(id: string, status: 'idle' | 'running' = 'idle'): Agent {
  return {
    id: SessionId(id),
    status,
    session: { id: SessionId(id), events: [] },
  } as unknown as Agent
}

/** One slot the fake host builds; records every host operation by slot id. */
interface TestSlot extends SessionSlot {
  readonly label: string
}

interface HostLog {
  built: string[]
  mounted: string[]
  unmounted: string[]
  disposed: string[]
  switches: Array<[string | undefined, string]>
  evictions: number[]
}

/**
 * A recording host: every registry-driven operation appends the slot's session
 * id, so assertions read the exact call order without spying on the registry.
 */
function recordingHost(log: HostLog, maxLiveSlots = DEFAULT_MAX_LIVE_SLOTS): ChannelRegistryHost<TestSlot> {
  return {
    buildSlot(agent: Agent): TestSlot {
      const label = String(agent.session.id)
      log.built.push(label)
      return { sessionId: agent.session.id, agent, label }
    },
    mount(slot: TestSlot): void {
      log.mounted.push(slot.label)
    },
    unmount(slot: TestSlot): void {
      log.unmounted.push(slot.label)
    },
    dispose(slot: TestSlot): void {
      log.disposed.push(slot.label)
    },
    onActiveChange(previous: TestSlot | undefined, next: TestSlot): void {
      log.switches.push([previous?.label, next.label])
    },
    maxLiveSlots,
    onEvictionSkipped: (liveCount: number) => {
      log.evictions.push(liveCount)
    },
  }
}

describe('channel registry', () => {
  it('builds, mounts, and announces the initial slot without switching', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log), fakeAgent('main'))
    expect(log.built).toEqual(['main'])
    expect(log.mounted).toEqual(['main'])
    expect(log.switches).toEqual([[undefined, 'main']])
    expect(registry.activeId()).toBe(SessionId('main'))
    expect(log.unmounted).toEqual([])
  })

  it('switchTo swaps the mounted slot and reports the previous one', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log), fakeAgent('main'))
    registry.adopt(fakeAgent('second'))
    expect(registry.switchTo(SessionId('main'))).toBe(true)
    // The adopt switched main→second; the explicit switch went back.
    expect(log.unmounted).toEqual(['main', 'second'])
    expect(log.mounted).toEqual(['main', 'second', 'main'])
    expect(log.switches).toEqual([[undefined, 'main'], ['main', 'second'], ['second', 'main']])
    expect(registry.active().label).toBe('main')
  })

  it('switchTo an unknown id reports false and mounts nothing new', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log), fakeAgent('main'))
    expect(registry.switchTo(SessionId('missing'))).toBe(false)
    expect(log.mounted).toEqual(['main'])
    expect(log.unmounted).toEqual([])
  })

  it('switchTo the already-active slot is a successful no-op', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log), fakeAgent('main'))
    expect(registry.switchTo(SessionId('main'))).toBe(true)
    // No extra mount, no unmount, no redundant switch announcement.
    expect(log.mounted).toEqual(['main'])
    expect(log.unmounted).toEqual([])
    expect(log.switches).toEqual([[undefined, 'main']])
  })

  it('get and slots expose the live set in least-recently-used-first order', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log), fakeAgent('main'))
    registry.adopt(fakeAgent('a'))
    registry.adopt(fakeAgent('b'))
    expect(registry.slots().map(slot => slot.label)).toEqual(['main', 'a', 'b'])
    // Touching `main` moves it to the most-recently-used end.
    registry.switchTo(SessionId('main'))
    expect(registry.slots().map(slot => slot.label)).toEqual(['a', 'b', 'main'])
    expect(registry.get(SessionId('a'))?.label).toBe('a')
    expect(registry.get(SessionId('missing'))).toBeUndefined()
  })

  it('isActive tracks the mounted slot across switches', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log), fakeAgent('main'))
    const adopted = registry.adopt(fakeAgent('second'))
    expect(registry.isActive(adopted)).toBe(true)
    registry.switchTo(SessionId('main'))
    expect(registry.isActive(adopted)).toBe(false)
  })

  it('remove drops a non-active slot through host teardown (rewind replacement)', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log), fakeAgent('main'))
    registry.adopt(fakeAgent('branch'))
    // The adopt switched main→branch, so the rewound-away source is removable.
    expect(registry.remove(SessionId('main'))).toBe(true)
    expect(log.disposed).toEqual(['main'])
    expect(registry.get(SessionId('main'))).toBeUndefined()
    expect(registry.slots().map(slot => slot.label)).toEqual(['branch'])
    // A removed session cannot be switched back to; a repeat remove is a no-op.
    expect(registry.switchTo(SessionId('main'))).toBe(false)
    expect(registry.remove(SessionId('main'))).toBe(false)
    expect(log.disposed).toEqual(['main'])
  })

  it('remove refuses the active slot and unknown ids', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log), fakeAgent('main'))
    expect(registry.remove(SessionId('main'))).toBe(false)
    expect(registry.remove(SessionId('missing'))).toBe(false)
    expect(log.disposed).toEqual([])
    expect(registry.active().label).toBe('main')
  })

  it('evicts the least-recently-used idle slot when a ceiling is exceeded', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log, 3), fakeAgent('main'))
    registry.adopt(fakeAgent('a'))
    registry.adopt(fakeAgent('b'))
    // Live: main, a, b — at the ceiling of 3, nothing evicts yet.
    expect(log.disposed).toEqual([])
    registry.adopt(fakeAgent('c'))
    // The oldest idle non-active slot (main) evicts; the active slot (c) never does.
    expect(log.disposed).toEqual(['main'])
    expect(registry.slots().map(slot => slot.label)).toEqual(['a', 'b', 'c'])
    // The evicted session cannot be switched back to.
    expect(registry.switchTo(SessionId('main'))).toBe(false)
    expect(registry.active().label).toBe('c')
    expect(log.evictions).toEqual([])
  })

  it('switching refreshes recency before a later eviction picks the victim', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log, 3), fakeAgent('main'))
    registry.adopt(fakeAgent('a'))
    registry.adopt(fakeAgent('b'))
    // Touch main: LRU order is now a, b, main — so a is the eviction victim.
    registry.switchTo(SessionId('main'))
    registry.adopt(fakeAgent('c'))
    expect(log.disposed).toEqual(['a'])
    expect(registry.slots().map(slot => slot.label)).toEqual(['b', 'main', 'c'])
  })

  it('never evicts running slots; reports the skipped ceiling', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log, 3), fakeAgent('main', 'running'))
    registry.adopt(fakeAgent('a', 'running'))
    registry.adopt(fakeAgent('b', 'running'))
    registry.adopt(fakeAgent('c'))
    // Live: main (active), a, b (running), c — no idle non-active victim exists.
    expect(log.disposed).toEqual([])
    expect(log.evictions).toEqual([4])
    expect(registry.slots().map(slot => slot.label)).toEqual(['main', 'a', 'b', 'c'])
  })

  it('disposeAll disposes every live slot and unmounts the active one last', () => {
    const log: HostLog = { built: [], mounted: [], unmounted: [], disposed: [], switches: [], evictions: [] }
    const registry = createChannelRegistry(recordingHost(log), fakeAgent('main'))
    registry.adopt(fakeAgent('a'))
    log.disposed.length = 0
    log.unmounted.length = 0
    registry.disposeAll()
    expect(log.disposed).toEqual(['main', 'a'])
    // The adopt's switch unmounted main; disposeAll unmounts the active slot (a).
    expect(log.unmounted).toEqual(['a'])
    expect(registry.slots()).toEqual([])
    expect(registry.switchTo(SessionId('main'))).toBe(false)
    // Idempotent: a second sweep is a no-op.
    registry.disposeAll()
    expect(log.disposed).toEqual(['main', 'a'])
  })
})

describe('channel registry host contract', () => {
  it('the initial construction order is build, mount, announce', () => {
    const order: string[] = []
    const host: ChannelRegistryHost<TestSlot> = {
      buildSlot(agent: Agent): TestSlot {
        order.push(`build:${String(agent.session.id)}`)
        return { sessionId: agent.session.id, agent, label: String(agent.session.id) }
      },
      mount: (slot: TestSlot) => { order.push(`mount:${slot.label}`) },
      unmount: (slot: TestSlot) => { order.push(`unmount:${slot.label}`) },
      dispose: (slot: TestSlot) => { order.push(`dispose:${slot.label}`) },
      onActiveChange: (previous: TestSlot | undefined, next: TestSlot) => {
        order.push(`active:${previous?.label ?? '∅'}→${next.label}`)
      },
      maxLiveSlots: DEFAULT_MAX_LIVE_SLOTS,
      onEvictionSkipped: () => {},
    }
    createChannelRegistry(host, fakeAgent('main'))
    expect(order).toEqual(['build:main', 'mount:main', 'active:∅→main'])
  })

  it('a switch unmounts the previous slot before mounting the next', () => {
    const order: string[] = []
    const host: ChannelRegistryHost<TestSlot> = {
      buildSlot: (agent: Agent): TestSlot => ({ sessionId: agent.session.id, agent, label: String(agent.session.id) }),
      mount: (slot: TestSlot) => { order.push(`mount:${slot.label}`) },
      unmount: (slot: TestSlot) => { order.push(`unmount:${slot.label}`) },
      dispose: () => {},
      onActiveChange: (previous: TestSlot | undefined, next: TestSlot) => {
        order.push(`active:${previous?.label ?? '∅'}→${next.label}`)
      },
      maxLiveSlots: DEFAULT_MAX_LIVE_SLOTS,
      onEvictionSkipped: () => {},
    }
    const registry = createChannelRegistry(host, fakeAgent('main'))
    order.length = 0
    registry.adopt(fakeAgent('next'))
    expect(order).toEqual(['unmount:main', 'mount:next', 'active:main→next'])
    order.length = 0
    registry.switchTo(SessionId('main'))
    expect(order).toEqual(['unmount:next', 'mount:main', 'active:next→main'])
  })

  it('the eviction callback fires exactly once per blocked adopt', () => {
    const skipped = vi.fn()
    const host: ChannelRegistryHost<TestSlot> = {
      buildSlot: (agent: Agent): TestSlot => ({ sessionId: agent.session.id, agent, label: String(agent.session.id) }),
      mount: () => {},
      unmount: () => {},
      dispose: () => {},
      onActiveChange: () => {},
      maxLiveSlots: 2,
      onEvictionSkipped: skipped,
    }
    const registry = createChannelRegistry(host, fakeAgent('main', 'running'))
    registry.adopt(fakeAgent('busy', 'running'))
    expect(skipped).not.toHaveBeenCalled()
    registry.adopt(fakeAgent('next'))
    expect(skipped).toHaveBeenCalledTimes(1)
    expect(skipped).toHaveBeenCalledWith(3)
  })
})
