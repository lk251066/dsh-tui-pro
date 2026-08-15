import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@earendil-works/pi-tui'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import {
  appendUser,
  createTuiTestHarness,
  disposeTuiTestHarness,
  type TuiHarness,
} from './harness.ts'

/**
 * The `/new` + `/sessions` multi-session flow, driven through the production
 * TUI: a fake agent factory stands in for agent-loop's, so `ctx.agents.create`
 * really constructs, registers, and switches to a second in-process session.
 */

/** Minimal recording terminal boundary (the tui.spec FakeAgent-adjacent twin). */
class RecordingTerminal implements Terminal {
  columns = 88
  rows = 32
  kittyProtocolActive = false
  output = ''
  title = ''
  progress: boolean[] = []
  started = 0
  stopped = 0
  drainInput = vi.fn(() => Promise.resolve())
  private onInput: (data: string) => void = () => {}
  private onResize: () => void = () => {}

  start(onInput: (data: string) => void, onResize: () => void): void {
    this.started += 1
    this.onInput = onInput
    this.onResize = onResize
  }

  stop(): void {
    this.stopped += 1
  }

  write(data: string): void {
    this.output += data
  }

  moveBy(lines: number): void {
    this.output += `[move:${lines}]`
  }

  hideCursor(): void {
    this.output += '[hide]'
  }

  showCursor(): void {
    this.output += '[show]'
  }

  clearLine(): void {
    this.output += '[clear-line]'
  }

  clearFromCursor(): void {
    this.output += '[clear-rest]'
  }

  clearScreen(): void {
    this.output += '[clear-screen]'
  }

  setTitle(title: string): void {
    this.title = title
  }

  setProgress(active: boolean): void {
    this.progress.push(active)
  }

  send(data: string): void {
    this.onInput(data)
  }
}

/** One created session's recording agent: every delivery lands in `followups`. */
interface CreatedAgentRecord {
  agent: Agent
  followups: string[]
}

async function tick(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 25))
}

/** Compose the TUI plus a fake creation factory recording every `/new` agent. */
async function switchHarness(): Promise<{
  harness: TuiHarness<RecordingTerminal, (code: number) => void>
  created: CreatedAgentRecord[]
}> {
  const created: CreatedAgentRecord[] = []
  const terminal = new RecordingTerminal()
  const exit = vi.fn()
  const harness = await createTuiTestHarness(terminal, exit, {})
  harness.ctx.agents.setFactory({
    async createAgent(_ownerCtx, options) {
      const session = harness.ctx.sessions.create(options.sessionId, { meta: options.meta })
      const followups: string[] = []
      const agent = {
        id: options.sessionId,
        options: {},
        session,
        status: 'idle',
        ctx: harness.ctx,
        followup(message: UserMessage) {
          followups.push(message.content.filter(block => block.type === 'text').map(block => block.text).join(''))
        },
        steer() {
          return { outcome: Promise.resolve({ status: 'rejected' as const }) }
        },
        inject: () => '',
        send: () => {},
        updateInbox: () => 'not-found',
        reserveTurnAdmission: () => undefined,
        cancel() {},
        whenIdle: () => Promise.resolve(),
      } as unknown as Agent
      harness.ctx.agents.register(agent)
      created.push({ agent, followups })
      return { agent, dispose: async () => {} }
    },
    async resume() {
      throw new Error('resume is not part of this suite')
    },
  })
  return { harness, created }
}

/** Type a full line into the editor and submit it. */
function submit(harness: TuiHarness<RecordingTerminal, (code: number) => void>, line: string): void {
  harness.terminal.send(line)
  harness.terminal.send('\r')
}

describe('multi-session switching (/new, /sessions)', () => {
  it('/new creates a second session, switches to it, and routes input there', async () => {
    const { harness, created } = await switchHarness()
    try {
      expect(created).toEqual([])
      submit(harness, '/new')
      await tick()
      expect(created).toHaveLength(1)
      // The fresh session id reached the user as a receipt.
      expect(harness.terminal.output).toContain('New session session-')
      // A prompt submitted now routes to the SECOND agent only.
      submit(harness, 'hello second')
      await tick()
      expect(created[0]?.followups).toEqual(['hello second'])
      expect(harness.agent.sentMessages.map(message =>
        message.content.filter(block => block.type === 'text').map(block => block.text).join(''))).toEqual([])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('/sessions lists every live session and a digit switches back', async () => {
    const { harness, created } = await switchHarness()
    try {
      submit(harness, 'first message')
      await tick()
      expect(harness.agent.sentMessages).toHaveLength(1)
      submit(harness, '/new')
      await tick()
      submit(harness, 'hello second')
      await tick()
      expect(created[0]?.followups).toEqual(['hello second'])

      // Open the switcher: both sessions are rows; the active one is marked.
      submit(harness, '/sessions')
      await tick()
      const pickerRender = harness.terminal.output
      expect(pickerRender).toContain('Sessions')
      expect(pickerRender).toContain('main-session')
      expect(pickerRender).toContain('●')

      // Row 1 is the initial session; the digit chooses it.
      harness.terminal.send('1')
      await tick()
      // Input now routes back to the FIRST agent.
      submit(harness, 'back to first')
      await tick()
      expect(harness.agent.sentMessages.map(message =>
        message.content.filter(block => block.type === 'text').map(block => block.text).join(''))).toEqual([
        'first message',
        'back to first',
      ])
      // The second session's agent heard nothing more.
      expect(created[0]?.followups).toEqual(['hello second'])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('/new without a registered factory reports the failure as a notice', async () => {
    const terminal = new RecordingTerminal()
    const harness = await createTuiTestHarness(terminal, vi.fn(), {})
    try {
      submit(harness, '/new')
      await tick()
      expect(terminal.output).toContain('New session failed: no agent factory registered')
      // The TUI stays mounted and usable on the initial session.
      submit(harness, 'still here')
      await tick()
      expect(harness.agent.sentMessages).toHaveLength(1)
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('a switch re-derives the transcript from the session log (detached events replay)', async () => {
    const { harness, created } = await switchHarness()
    try {
      submit(harness, '/new')
      await tick()
      const secondSession = created[0]?.agent.session
      expect(secondSession).toBeDefined()
      // Switch back to the initial session; the second channel detaches.
      submit(harness, '/sessions')
      await tick()
      harness.terminal.send('1')
      await tick()
      const before = harness.terminal.output.length
      // A turn lands in the second session's log while its channel is detached.
      appendUser(secondSession!, 'logged while away')
      await tick()
      expect(harness.terminal.output.slice(before)).not.toContain('logged while away')
      // Remounting the second slot replays the whole log from the session.
      submit(harness, '/sessions')
      await tick()
      harness.terminal.send('2')
      await tick()
      expect(harness.terminal.output).toContain('> logged while away')
      // The remounted slot owns input routing again.
      submit(harness, 'after remount')
      await tick()
      expect(created[0]?.followups).toEqual(['after remount'])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })
})
