import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@earendil-works/pi-tui'
import { SessionId } from '@deepseek-ai/dsh-session'
import { createWorkspaceSessions } from '../src/chat/workspace-sessions.ts'
import { createTuiTestHarness, disposeTuiTestHarness } from './harness.ts'

const terminal = (): Terminal => ({
  columns: 80,
  rows: 24,
  kittyProtocolActive: false,
  start: vi.fn(),
  stop: vi.fn(),
  write: vi.fn(),
  moveBy: vi.fn(),
  hideCursor: vi.fn(),
  showCursor: vi.fn(),
  clearLine: vi.fn(),
  clearFromCursor: vi.fn(),
  clearScreen: vi.fn(),
  setTitle: vi.fn(),
  setProgress: vi.fn(),
  drainInput: vi.fn(() => Promise.resolve()),
})

describe('workspace sessions', () => {
  it('adds and removes membership without deleting the session or its persisted header', async () => {
    const historicalId = SessionId('historical-session')
    const historicalHeader = {
      version: 0 as const,
      id: historicalId,
      createdAt: 2,
      cwd: '/other-workspace',
    }
    const harness = await createTuiTestHarness(terminal(), vi.fn(), {
      sessionPersistence: { list: async () => [historicalHeader] },
    })
    try {
      const sessions = createWorkspaceSessions(harness.ctx)
      expect(sessions.list().map(item => item.sessionId)).toEqual([SessionId('main-session')])

      await sessions.add(historicalId)
      expect(sessions.has(historicalId)).toBe(true)

      expect(await sessions.remove(historicalId)).toBe(true)
      expect(sessions.has(historicalId)).toBe(false)
      expect(await harness.ctx.get('sessionPersistence')!.list()).toEqual([historicalHeader])
      expect(harness.ctx.sessions.get(SessionId('main-session'))).toBe(harness.session)
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('keeps the fixed assistant outside project workspace membership', async () => {
    const harness = await createTuiTestHarness(terminal(), vi.fn())
    try {
      const sessions = createWorkspaceSessions(harness.ctx)
      const workspace = harness.ctx.workspaceRegistry.list()[0]!
      await workspace.attachSession(SessionId('assistant'))

      expect(sessions.list().map(item => item.sessionId)).not.toContain(SessionId('assistant'))
      await sessions.add(SessionId('assistant'))
      expect(await sessions.remove(SessionId('assistant'))).toBe(false)
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })
})
