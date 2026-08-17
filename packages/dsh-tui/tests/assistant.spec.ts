import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@earendil-works/pi-tui'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import { createScope } from '@deepseek-ai/dsh-scope'
import {
  createTuiTestHarness,
  disposeTuiTestHarness,
  type TuiHarness,
} from './harness.ts'

/**
 * The `/assistant` flow through the production TUI: a fake agent factory
 * stands in for agent-loop's (create AND resume), and the fake persistence
 * list decides which path the preflight takes.
 */

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

/** What the fake factory observed for one create/resume call. */
interface FactoryCall {
  kind: 'create' | 'resume'
  sessionId: string
  setup?: (agentCtx: never) => void
}

/** One created assistant agent's recording boundary. */
interface CreatedAgentRecord {
  agent: Agent
  followups: string[]
}

async function tick(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 25))
}

interface AssistantHarnessOptions {
  /** Persisted session headers the persistence preflight sees. */
  persistedIds?: string[]
  /** Rejection the fake resume throws; `'not found'` triggers the fallback. */
  resumeError?: string
}

async function assistantHarness(options: AssistantHarnessOptions = {}): Promise<{
  harness: TuiHarness<RecordingTerminal, (code: number) => void>
  calls: FactoryCall[]
  created: CreatedAgentRecord[]
}> {
  const calls: FactoryCall[] = []
  const created: CreatedAgentRecord[] = []
  const terminal = new RecordingTerminal()
  const harness = await createTuiTestHarness(terminal, vi.fn(), {
    beforeMount(_session, ctx) {
      ctx.provide('sessionPersistence', {
        list: async () => (options.persistedIds ?? []).map(id => ({
          version: 0,
          id,
          createdAt: 1,
          cwd: '/workspace',
        })),
      } as never)
      ctx.agents.setFactory({
        async createAgent(_ownerCtx, createOptions) {
          calls.push({
            kind: 'create',
            sessionId: String(createOptions.sessionId),
            setup: createOptions.setup as (agentCtx: never) => void,
          })
          // The real factory mints a SCOPED agent context and awaits setup on
          // it; the fake mirrors that shape (a root-context setup would
          // collide the persona section with the global layer).
          const scope = createScope(ctx, {})
          createOptions.setup?.(scope.ctx as never)
          const { agent } = await mintAgent(createOptions.sessionId)
          return { agent, dispose: async () => {} }
        },
        async resume(_ownerCtx, resumeOptions) {
          calls.push({
            kind: 'resume',
            sessionId: String(resumeOptions.resumeSessionId),
            setup: resumeOptions.setup as (agentCtx: never) => void,
          })
          if (options.resumeError !== undefined) throw new Error(options.resumeError)
          const scope = createScope(ctx, {})
          resumeOptions.setup?.(scope.ctx as never)
          const { agent } = await mintAgent(resumeOptions.resumeSessionId, ['assistant history'])
          return { agent, dispose: async () => {} }
        },
      })
      function mintAgent(id, _seed: string[] = []) {
        const followups: string[] = []
        const session = ctx.sessions.create(id, { meta: { cwd: '/workspace' } })
        const agent = {
          id, options: {}, session, status: 'idle', ctx,
          followup(message: UserMessage) {
            followups.push(message.content.filter(block => block.type === 'text').map(block => block.text).join(''))
          },
          steer() { return { outcome: Promise.resolve({ status: 'rejected' as const }) } },
          inject: () => '',
          send: () => {},
          updateInbox: () => 'not-found',
          reserveTurnAdmission: () => undefined,
          cancel() {},
          whenIdle: () => Promise.resolve(),
        } as unknown as Agent
        ctx.agents.register(agent)
        created.push({ agent, followups })
        return { agent, followups }
      }
    },
  })
  return { harness, calls, created }
}

function submit(harness: TuiHarness<RecordingTerminal, (code: number) => void>, line: string): void {
  harness.terminal.send(line)
  harness.terminal.send('\r')
}

describe('/assistant', () => {
  it('creates the fixed-id assistant session, runs setup, and routes input to it', async () => {
    const { harness, calls, created } = await assistantHarness()
    try {
      submit(harness, '/assistant')
      await vi.waitFor(() => {
        expect(harness.terminal.output).toContain('Assistant session created.')
      })
      expect(calls).toEqual([expect.objectContaining({ kind: 'create', sessionId: 'assistant' })])
      // Input now routes to the assistant agent.
      submit(harness, '今天天气怎么样')
      await tick()
      expect(created[0]?.followups).toEqual(['今天天气怎么样'])
      expect(harness.agent.sentMessages).toHaveLength(0)
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('resumes the persisted assistant log instead of creating', async () => {
    const { harness, calls, created } = await assistantHarness({ persistedIds: ['assistant'] })
    try {
      submit(harness, '/assistant')
      await tick()
      expect(calls).toEqual([expect.objectContaining({ kind: 'resume', sessionId: 'assistant' })])
      expect(harness.terminal.output).toContain('Assistant session resumed.')
      submit(harness, '继续')
      await tick()
      expect(created[0]?.followups).toEqual(['继续'])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('a second /assistant switches to the live slot without touching the factory', async () => {
    const { harness, calls, created } = await assistantHarness()
    try {
      submit(harness, '/assistant')
      await tick()
      submit(harness, '/sessions')
      await tick()
      harness.terminal.send('main-session')
      harness.terminal.send('\r')
      await tick()
      submit(harness, '/assistant')
      await tick()
      expect(calls).toHaveLength(1)
      // The assistant slot is live again and owns input routing.
      submit(harness, '回来')
      await tick()
      expect(created[0]?.followups).toEqual(['回来'])
      expect(harness.agent.sentMessages).toHaveLength(0)
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('a resume rejection other than not-found reports and keeps the TUI usable', async () => {
    const { harness, calls } = await assistantHarness({ persistedIds: ['assistant'], resumeError: 'log is corrupt' })
    try {
      submit(harness, '/assistant')
      await tick()
      expect(calls.map(call => call.kind)).toEqual(['resume'])
      expect(harness.terminal.output).toContain('Assistant failed')
      submit(harness, '还在吗')
      await tick()
      expect(harness.agent.sentMessages).toHaveLength(1)
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('a not-found race between preflight and resume falls back to create once', async () => {
    const { harness, calls } = await assistantHarness({ persistedIds: ['assistant'], resumeError: 'session "assistant" not found' })
    try {
      submit(harness, '/assistant')
      await vi.waitFor(() => {
        expect(harness.terminal.output).toContain('Assistant session created.')
      })
      expect(calls.map(call => call.kind)).toEqual(['resume', 'create'])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })
})
