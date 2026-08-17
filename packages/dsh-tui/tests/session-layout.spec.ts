import { describe, expect, it } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import { createPalette } from '../src/components/theme.ts'
import type { ChannelRegistry } from '../src/chat/channel-registry.ts'
import { createSessionLayout } from '../src/chat/session-layout.ts'
import type { WorkspaceSessions } from '../src/chat/workspace-sessions.ts'
import type { TuiSessionSlot } from '../src/index.ts'

/** Minimal live slot: identity, status, and a mutable session event log. */
function liveSlot(id: string, events: SessionEvent[]): TuiSessionSlot {
  return {
    sessionId: SessionId(id),
    agent: {
      session: { id: SessionId(id), events, header: { createdAt: 0, cwd: '/workspace' } },
      status: 'idle',
    } as unknown as Agent,
  } as unknown as TuiSessionSlot
}

/** Layout deps over one live project slot; the assistant row stays stopped. */
function layoutOver(slot: TuiSessionSlot): ReturnType<typeof createSessionLayout> {
  const registry = {
    active: () => slot,
    activeId: () => slot.sessionId,
    get: (sessionId: SessionId) => sessionId === slot.sessionId ? slot : undefined,
    slots: () => [slot],
    isActive: (candidate: TuiSessionSlot) => candidate === slot,
  } as unknown as ChannelRegistry<TuiSessionSlot>
  const workspaceSessions = {
    list: () => [{ sessionId: slot.sessionId, workspace: { title: 'workspace' } }],
  } as unknown as WorkspaceSessions
  return createSessionLayout({
    palette: createPalette(false),
    registry,
    workspaceSessions,
    terminalRows: () => 40,
    now: () => 1000,
  })
}

describe('session layout titles', () => {
  it('falls back to the persisted title for a live slot without an in-memory title', () => {
    const events: SessionEvent[] = []
    const slot = liveSlot('live-untitled', events)
    const layout = layoutOver(slot)
    layout.refresh()
    const titles = (): string[] => layout.sessionList.getItems().map(item => item.title)
    // No title anywhere: the bare session id renders.
    expect(titles()).toContain('live-untitled')

    // The cold-read cache outranks the bare id for a live slot too.
    layout.setPersistedTitles(new Map([[SessionId('live-untitled'), 'Persisted live title']]))
    expect(titles()).toContain('Persisted live title')

    // An in-memory title event still wins over the cache.
    events.push({
      type: 'session/title',
      seq: 0,
      time: 1,
      data: { title: 'Live title', messageSeqs: [], source: { kind: 'fallback' } },
    })
    layout.refresh()
    expect(titles()).toContain('Live title')
    expect(titles()).not.toContain('Persisted live title')
  })
})
