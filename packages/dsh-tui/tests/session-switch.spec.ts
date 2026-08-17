import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@earendil-works/pi-tui'
import type { Context } from '@deepseek-ai/cordis'
import { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import { ReasoningEffortId, type UserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent, type SessionHeader } from '@deepseek-ai/dsh-session'
import {
  appendUser,
  createTuiTestHarness,
  disposeTuiTestHarness,
  type TuiHarness,
  type TuiHarnessOptions,
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
  cwd: string | undefined
  disposed: number
}

async function tick(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 25))
}

interface SwitchHarnessOptions extends Pick<TuiHarnessOptions, 'handoffResume' | 'sessionPersistence'> {
  resumeError?: Error
  mutateResumedAgent?: (agent: Agent, attempt: number) => void
}

/** Compose the TUI plus a fake factory recording every created or resumed agent. */
async function switchHarness(cwd = '/workspace', options: SwitchHarnessOptions = {}): Promise<{
  harness: TuiHarness<RecordingTerminal, (code: number) => void>
  created: CreatedAgentRecord[]
  resumed: CreatedAgentRecord[]
}> {
  const created: CreatedAgentRecord[] = []
  const resumed: CreatedAgentRecord[] = []
  const terminal = new RecordingTerminal()
  const exit = vi.fn()
  const { resumeError, mutateResumedAgent, ...harnessOptions } = options
  const harness = await createTuiTestHarness(terminal, exit, {
    ...harnessOptions,
    cwd,
    agentOptions: { provider: 'alpha', model: 'a1' },
    catalog: {
      providers: [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }],
      models: [
        { provider: 'alpha', id: 'a1', name: 'Alpha One' },
        { provider: 'beta', id: 'b1', name: 'Beta One' },
      ],
      resolveModelInfo: async (provider) => ({
        context: { contextWindow: 100_000 },
        reasoning: provider === 'alpha'
          ? {
              efforts: [
                { id: ReasoningEffortId('low'), name: 'Low' },
                { id: ReasoningEffortId('high'), name: 'High' },
              ],
              defaultEffort: ReasoningEffortId('low'),
            }
          : {
              efforts: [
                { id: ReasoningEffortId('standard'), name: 'Standard' },
                { id: ReasoningEffortId('max'), name: 'Max' },
              ],
              defaultEffort: ReasoningEffortId('standard'),
            },
      }),
    },
  })
  harness.ctx.agents.setFactory({
    async createAgent(_ownerCtx, options) {
      const session = harness.ctx.sessions.create(options.sessionId, { seed: options.seed, meta: options.meta })
      const followups: string[] = []
      const agent = {
        id: options.sessionId,
        options: { provider: 'beta', model: 'b1' },
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
      created.push({ agent, followups, cwd: options.meta?.cwd, disposed: 0 })
      return { agent, dispose: async () => {} }
    },
    async resume(_ownerCtx, options) {
      if (resumeError !== undefined) throw resumeError
      const persistence = harness.ctx.get('sessionPersistence')
      if (persistence === undefined) throw new Error('session persistence is not mounted')
      const prepared = await persistence.load(options.resumeSessionId)
      const session = harness.ctx.sessions.prepare(options.resumeSessionId, {
        seed: prepared.events,
        meta: prepared.meta,
      })
      const disposeSession = harness.ctx.sessions.enter(session)
      harness.ctx.sessions.announce(session)
      const followups: string[] = []
      const agent = {
        id: options.resumeSessionId,
        options: { provider: 'beta', model: 'b1' },
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
      mutateResumedAgent?.(agent, resumed.length + 1)
      const disposeAgent = harness.ctx.agents.register(agent)
      const record = { agent, followups, cwd: prepared.meta.cwd, disposed: 0 }
      resumed.push(record)
      return {
        agent,
        async dispose() {
          record.disposed += 1
          disposeAgent()
          disposeSession()
        },
      }
    },
  })
  return { harness, created, resumed }
}

/** Type a full line into the editor and submit it. */
function submit(harness: TuiHarness<RecordingTerminal, (code: number) => void>, line: string): void {
  harness.terminal.send(line)
  harness.terminal.send('\r')
}

/** Open the unified session picker, search one exact id, and activate it. */
async function switchTo(
  harness: TuiHarness<RecordingTerminal, (code: number) => void>,
  sessionId: string,
): Promise<void> {
  submit(harness, '/sessions')
  await tick()
  harness.terminal.send(sessionId)
  harness.terminal.send('\r')
  await tick()
}

describe('multi-session switching (/new, /sessions)', () => {
  it('/new rejects a requested path that is not a directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-tui-project-'))
    const missing = join(root, 'missing')
    const { harness, created } = await switchHarness(root)
    try {
      submit(harness, `/new ${missing}`)
      await tick()
      expect(created).toEqual([])
      expect(harness.terminal.output).toContain('New session failed:')
    } finally {
      await disposeTuiTestHarness(harness)
      await rm(root, { recursive: true, force: true })
    }
  })

  it('/new <path> starts the session in the requested project directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-tui-project-'))
    const project = join(root, 'other project')
    await mkdir(project)
    const { harness, created } = await switchHarness(root)
    try {
      submit(harness, `/new ${project}`)
      await tick()
      expect(created).toHaveLength(1)
      expect(created[0]?.cwd).toBe(project)
    } finally {
      await disposeTuiTestHarness(harness)
      await rm(root, { recursive: true, force: true })
    }
  })

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

  it('/fork activates the branched session and routes input into it', async () => {
    const { harness, created } = await switchHarness()
    try {
      harness.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      submit(harness, '/fork')
      await tick()
      expect(created).toHaveLength(1)
      expect(harness.terminal.output).toContain('Forked into session-')
      const forkedId = created[0]?.agent.session.id
      expect(harness.ctx.workspaceRegistry.list().flatMap(workspace => workspace.sessionIds)).toContain(forkedId)

      submit(harness, 'continue on branch')
      await tick()
      expect(created[0]?.followups).toEqual(['continue on branch'])
      expect(harness.agent.sentMessages).toHaveLength(0)
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('double Escape branches before a completed user turn and restores its prompt for editing', async () => {
    const { harness, created } = await switchHarness()
    try {
      appendUser(harness.session, 'first request')
      harness.session.append('step/end', { turn: 1, step: 1 })
      harness.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
      harness.session.append('turn/start', {
        turn: 2,
        trigger: { kind: 'message', source: { kind: 'user' } },
      })
      appendUser(harness.session, 'second request to revise')
      harness.session.append('turn/end', { turn: 2, reason: { kind: 'completed' } })

      harness.terminal.send('\x1b')
      await tick()
      expect(harness.terminal.output).not.toContain('Rewind conversation')
      harness.terminal.send('\x1b')
      await tick()

      expect(harness.terminal.output).toContain('Rewind conversation')
      expect(harness.terminal.output).toContain('second request to revise')
      harness.terminal.send('\x1b[D')
      harness.terminal.send('\x1b[C')
      harness.terminal.send('\r')
      await tick()

      expect(created).toHaveLength(1)
      expect(created[0]?.agent.session.events.some(event =>
        event.type === 'user/message'
        && event.data.source.kind === 'user'
        && event.data.content.some(block => block.type === 'text' && block.text.includes('second request')),
      )).toBe(false)

      harness.terminal.send('\r')
      await tick()
      expect(created[0]?.followups).toEqual(['second request to revise'])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('does not enter checkpoint navigation from a draft, running turn, or active dialog', async () => {
    const { harness } = await switchHarness()
    try {
      appendUser(harness.session, 'completed request')
      harness.session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })

      harness.terminal.output = ''
      harness.terminal.send('draft')
      harness.terminal.send('\x1b')
      harness.terminal.send('\x1b')
      await tick()
      expect(harness.terminal.output).not.toContain('Rewind conversation')
      harness.terminal.send('\x03')

      harness.agent.status = 'running'
      agentEvents(harness.ctx, harness.agent).emit('agent/status', { status: 'running' })
      harness.terminal.output = ''
      harness.terminal.send('\x1b')
      harness.terminal.send('\x1b')
      await tick()
      expect(harness.agent.cancelled).toHaveLength(2)
      expect(harness.terminal.output).not.toContain('Rewind conversation')

      harness.agent.status = 'idle'
      agentEvents(harness.ctx, harness.agent).emit('agent/status', { status: 'idle' })
      submit(harness, '/settings')
      await tick()
      expect(harness.terminal.output).toContain('Settings')
      harness.terminal.output = ''
      harness.terminal.send('\x1b')
      await tick()
      harness.terminal.send('\x1b')
      await tick()
      expect(harness.terminal.output).not.toContain('Rewind conversation')
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('/sessions lists active sessions and search switches back', async () => {
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
      expect(pickerRender).toContain('all history (2)')

      harness.terminal.send('main-session')
      harness.terminal.send('\r')
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

  it('cycles active workspace sessions with Alt+Left and Alt+Right only from an empty editor', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-tui-alt-switch-'))
    const { harness, created } = await switchHarness(root)
    try {
      submit(harness, '/new')
      await tick()
      expect(created).toHaveLength(1)

      // Move from the newly activated project session back to the startup
      // session, then return to the project session.
      harness.terminal.send('\x1b[1;3C')
      await tick()
      submit(harness, 'message on main')
      expect(harness.agent.sentMessages.at(-1)?.content).toEqual([{ type: 'text', text: 'message on main' }])

      harness.terminal.send('\x1b[1;3D')
      await tick()
      submit(harness, 'message on branch')
      expect(created[0]?.followups).toEqual(['message on branch'])

      harness.terminal.send('draft text')
      harness.terminal.send('\x1b[1;3C')
      harness.terminal.send('\r')
      await tick()
      expect(created[0]?.followups).toEqual(['message on branch', 'draft text'])
    } finally {
      await disposeTuiTestHarness(harness)
      await rm(root, { recursive: true, force: true })
    }
  })

  it('/switch selects active sessions directly and opens the bottom selector without an argument', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-tui-command-switch-'))
    const { harness, created } = await switchHarness(root)
    try {
      submit(harness, '/new')
      await tick()
      expect(created).toHaveLength(1)

      submit(harness, '/switch 3')
      await tick()
      submit(harness, 'message on main')
      expect(harness.agent.sentMessages.at(-1)?.content).toEqual([{ type: 'text', text: 'message on main' }])

      submit(harness, '/switch previous')
      await tick()
      submit(harness, 'message on branch')
      expect(created[0]?.followups).toEqual(['message on branch'])

      submit(harness, '/switch next')
      await tick()
      submit(harness, 'second message on main')
      expect(harness.agent.sentMessages.at(-1)?.content).toEqual([
        { type: 'text', text: 'second message on main' },
      ])

      submit(harness, '/switch')
      await tick()
      expect(harness.terminal.output).toContain('Switch active session')
      expect(harness.terminal.output).toContain('Enter switch')
      harness.terminal.send('\x1b')
    } finally {
      await disposeTuiTestHarness(harness)
      await rm(root, { recursive: true, force: true })
    }
  })

  it('switches through a direct click on an active sidebar session', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-tui-sidebar-switch-'))
    const { harness, created } = await switchHarness(root)
    try {
      submit(harness, '/new')
      await tick()
      expect(created).toHaveLength(1)

      // At 88 columns the sidebar begins at column 57. New sessions are first
      // within one workspace, so the original main session is the third row.
      harness.terminal.send('\x1b[<0;60;11M')
      await tick()
      submit(harness, 'message after sidebar click')

      expect(harness.agent.sentMessages.at(-1)?.content).toEqual([
        { type: 'text', text: 'message after sidebar click' },
      ])
      expect(created[0]?.followups).toEqual([])
    } finally {
      await disposeTuiTestHarness(harness)
      await rm(root, { recursive: true, force: true })
    }
  })

  it('removes the clicked current project session from Active with Delete while preserving history and use', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-tui-sidebar-remove-'))
    const { harness, created } = await switchHarness(root)
    try {
      submit(harness, '/new')
      await tick()
      expect(created).toHaveLength(1)

      // Select the original session in the sidebar, then remove that current
      // session from the active workspace list with two immediate key presses.
      harness.terminal.send('\x1b[<0;60;11M')
      await tick()
      const workspace = harness.ctx.workspaceRegistry.list()[0]!
      const detach = vi.spyOn(workspace, 'detachSession')
      harness.terminal.send('\x1b[3~')
      harness.terminal.send('\x1b[3~')
      await tick()

      expect(detach).toHaveBeenCalledTimes(1)
      expect(detach).toHaveBeenCalledWith(SessionId('main-session'))
      expect(workspace.sessionIds).not.toContain(SessionId('main-session'))
      expect(harness.terminal.output).toContain('Removed from active sessions. History preserved.')

      submit(harness, 'still using removed session')
      await tick()
      expect(harness.agent.sentMessages.at(-1)?.content).toEqual([
        { type: 'text', text: 'still using removed session' },
      ])

      submit(harness, '/sessions')
      await tick()
      const history = harness.terminal.output.slice(harness.terminal.output.lastIndexOf('Sessions'))
      expect(history).toContain('all history (2)')
      expect(history).toContain('current · history')
    } finally {
      await disposeTuiTestHarness(harness)
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps Delete as editor input when a draft exists and never removes the assistant', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-tui-delete-guard-'))
    const { harness } = await switchHarness(root)
    try {
      const workspace = harness.ctx.workspaceRegistry.list()[0]!
      harness.terminal.send('draftx')
      harness.terminal.send('\x1b[D')
      harness.terminal.send('\x1b[3~')
      harness.terminal.send('\r')
      await tick()
      expect(harness.agent.sentMessages.at(-1)?.content).toEqual([{ type: 'text', text: 'draft' }])
      expect(workspace.sessionIds).toContain(SessionId('main-session'))

      submit(harness, '/assistant')
      await tick()
      const before = [...workspace.sessionIds]
      harness.terminal.send('\x1b[3~')
      await tick()
      expect(workspace.sessionIds).toEqual(before)
      expect(harness.terminal.output).toContain('The assistant is always active.')
    } finally {
      await disposeTuiTestHarness(harness)
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps model and reasoning effort independent across live sessions', async () => {
    const { harness, created } = await switchHarness()
    try {
      submit(harness, '/effort high')
      await tick()
      expect(harness.terminal.output).toContain('Reasoning effort: High.')

      submit(harness, '/new')
      await tick()
      expect(created).toHaveLength(1)
      submit(harness, '/effort max')
      await tick()
      expect(harness.terminal.output).toContain('Reasoning effort: Max.')

      await switchTo(harness, 'main-session')
      const firstOutput = harness.terminal.output.length
      submit(harness, '/effort')
      await tick()
      expect(harness.terminal.output.slice(firstOutput)).toContain('Reasoning effort · alpha/a1')
      expect(harness.terminal.output.slice(firstOutput)).toContain('High')
      expect(harness.terminal.output.slice(firstOutput)).toMatch(/a1\s+high/)
      harness.terminal.send('\x1b')
      await tick()

      await switchTo(harness, String(created[0]?.agent.session.id))
      const secondOutput = harness.terminal.output.length
      submit(harness, '/effort')
      await tick()
      expect(harness.terminal.output.slice(secondOutput)).toContain('Reasoning effort · beta/b1')
      expect(harness.terminal.output.slice(secondOutput)).toContain('Max')
      expect(harness.terminal.output.slice(secondOutput)).toMatch(/b1\s+max/)
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

  it('Space removes a session from the workspace while all history still lists it', async () => {
    const { harness, created } = await switchHarness()
    try {
      submit(harness, '/new')
      await tick()
      const createdId = String(created[0]!.agent.session.id)

      submit(harness, '/sessions')
      await tick()
      harness.terminal.send(createdId)
      harness.terminal.send(' ')
      await tick()
      expect(harness.ctx.workspaceRegistry.list().flatMap(workspace => workspace.sessionIds))
        .not.toContain(SessionId(createdId))

      const history = harness.terminal.output.slice(harness.terminal.output.lastIndexOf('Sessions'))
      expect(history).toContain('Untitled session')
      expect(history).toContain('current · history')
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
      await switchTo(harness, 'main-session')
      const before = harness.terminal.output.length
      // A turn lands in the second session's log while its channel is detached.
      appendUser(secondSession!, 'logged while away')
      await tick()
      expect(harness.terminal.output.slice(before)).not.toContain('logged while away')
      // Remounting the second slot replays the whole log from the session.
      await switchTo(harness, String(secondSession!.id))
      expect(harness.terminal.output).toContain('You')
      expect(harness.terminal.output).toContain('logged while away')
      // The remounted slot owns input routing again.
      submit(harness, 'after remount')
      await tick()
      expect(created[0]?.followups).toEqual(['after remount'])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('refreshes detached session titles and running state in the persistent sidebar', async () => {
    const { harness, created } = await switchHarness()
    try {
      submit(harness, '/new')
      await tick()
      const background = created[0]?.agent
      expect(background).toBeDefined()

      await switchTo(harness, 'main-session')

      harness.terminal.output = ''
      background!.session.append('session/title', {
        title: 'Background work',
        messageSeqs: [],
        source: { kind: 'fallback' },
      })
      await tick()
      expect(harness.terminal.output).toContain('Background work')

      harness.terminal.output = ''
      background!.status = 'running'
      agentEvents(harness.ctx, background!).emit('agent/status', { status: 'running' })
      await tick()
      expect(harness.terminal.output).toContain('● Background work')
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('loads a persisted title for a stopped active session during startup', async () => {
    const stoppedId = SessionId('stopped-project-session')
    const header: SessionHeader = {
      version: 0,
      id: stoppedId,
      createdAt: 1,
      cwd: '/workspace',
    }
    const events: SessionEvent[] = [{
      type: 'session/title',
      seq: 0,
      time: 2,
      data: {
        title: 'Persisted project title',
        messageSeqs: [],
        source: { kind: 'fallback' },
      },
    }]
    const terminal = new RecordingTerminal()
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      sessionPersistence: {
        list: async () => [header],
        load: async () => ({ meta: header, events }),
      },
      beforeMount(_session, ctx) {
        const workspace = ctx.workspaceRegistry.list()[0]
        if (workspace !== undefined) void workspace.attachSession(stoppedId)
      },
    })
    try {
      await vi.waitFor(() => {
        expect(terminal.output).toContain('Persisted project title')
      })
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('retries stopped-session titles while the query service finishes mounting', async () => {
    const stoppedId = SessionId('late-query-title')
    const target: SessionHeader = { version: 0, id: stoppedId, createdAt: 1, cwd: '/workspace' }
    const titleEvent: SessionEvent = {
      type: 'session/title',
      seq: 0,
      time: 2,
      data: { title: 'Late persisted title', messageSeqs: [], source: { kind: 'fallback' } },
    }
    const terminal = new RecordingTerminal()
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      mountSessionQuery: false,
      sessionPersistence: {
        list: async () => [target],
        load: async () => ({ meta: target, events: [titleEvent] }),
      },
      beforeMount(_session, ctx) {
        const workspace = ctx.workspaceRegistry.list()[0]
        if (workspace !== undefined) void workspace.attachSession(stoppedId)
      },
    })
    try {
      harness.ctx.provide('sessionQuery', {
        listSessions: async () => [],
        readTitleSnapshots: async () => [{
          sessionId: stoppedId,
          status: 'fulfilled',
          value: { session: target, title: { title: 'Late persisted title' } },
        }],
      } as never)
      await vi.waitFor(() => {
        expect(terminal.output).toContain('Late persisted title')
      })
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('cancels a pending stopped-title retry when the TUI is disposed', async () => {
    const stoppedId = SessionId('disposed-title-retry')
    const target: SessionHeader = { version: 0, id: stoppedId, createdAt: 1, cwd: '/workspace' }
    const terminal = new RecordingTerminal()
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      mountSessionQuery: false,
      sessionPersistence: {
        list: async () => [target],
        load: async () => ({ meta: target, events: [] }),
      },
      beforeMount(_session, ctx) {
        const workspace = ctx.workspaceRegistry.list()[0]
        if (workspace !== undefined) void workspace.attachSession(stoppedId)
      },
    })
    await disposeTuiTestHarness(harness)
    const outputAfterDispose = terminal.output
    await new Promise(resolve => setTimeout(resolve, 75))
    expect(terminal.output).toBe(outputAfterDispose)
  })

  it('resumes and switches to a stopped session in the startup workspace', async () => {
    const target: SessionHeader = {
      version: 0,
      id: SessionId('stopped-same-workspace'),
      createdAt: 1,
      cwd: '/workspace',
    }
    const events: SessionEvent[] = [{
      type: 'session/title',
      seq: 0,
      time: 2,
      data: { title: 'Stopped project', messageSeqs: [], source: { kind: 'fallback' } },
    }]
    const { harness, resumed } = await switchHarness('/workspace', {
      sessionPersistence: {
        list: async () => [target],
        load: async () => ({ meta: target, events }),
      },
    })
    try {
      const workspace = harness.ctx.workspaceRegistry.list()[0]
      await workspace?.attachSession(target.id)

      await switchTo(harness, target.id)
      await tick()

      expect(resumed).toHaveLength(1)
      expect(workspace?.sessionIds).toContain(target.id)
      submit(harness, 'continue stopped work')
      await tick()
      expect(resumed[0]?.followups).toEqual(['continue stopped work'])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('disposes a resumed agent when workspace attachment fails and permits retry', async () => {
    const target: SessionHeader = {
      version: 0,
      id: SessionId('retry-after-attachment-failure'),
      createdAt: 1,
      cwd: '/workspace',
    }
    const { harness, resumed } = await switchHarness('/workspace', {
      sessionPersistence: {
        list: async () => [target],
        load: async () => ({ meta: target, events: [] }),
      },
    })
    try {
      const workspace = harness.ctx.workspaceRegistry.list()[0]!
      const attachSession = workspace.attachSession.bind(workspace)
      let attempts = 0
      workspace.attachSession = async (sessionId) => {
        if (++attempts === 1) throw new Error('workspace write failed')
        await attachSession(sessionId)
      }

      await switchTo(harness, target.id)
      await tick()
      expect(resumed).toHaveLength(1)
      expect(resumed[0]?.disposed).toBe(1)
      expect(harness.ctx.agents.get(target.id)).toBeUndefined()
      expect(harness.ctx.sessions.get(target.id)).toBeUndefined()
      expect(harness.terminal.output).toContain('Session open failed: workspace write failed')

      await switchTo(harness, target.id)
      await tick()
      expect(resumed).toHaveLength(2)
      expect(resumed[1]?.disposed).toBe(0)
      expect(harness.ctx.agents.get(target.id)).toBe(resumed[1]?.agent)
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('disposes a resumed agent when UI adoption fails and permits retry', async () => {
    const target: SessionHeader = {
      version: 0,
      id: SessionId('retry-after-adoption-failure'),
      createdAt: 1,
      cwd: '/workspace',
    }
    const { harness, resumed } = await switchHarness('/workspace', {
      mutateResumedAgent(agent, attempt) {
        if (attempt === 1) (agent as { ctx: Context | undefined }).ctx = undefined
      },
      sessionPersistence: {
        list: async () => [target],
        load: async () => ({ meta: target, events: [] }),
      },
    })
    try {
      await switchTo(harness, target.id)
      await tick()
      expect(resumed).toHaveLength(1)
      expect(resumed[0]?.disposed).toBe(1)
      expect(harness.ctx.agents.get(target.id)).toBeUndefined()
      expect(harness.ctx.sessions.get(target.id)).toBeUndefined()
      expect(harness.terminal.output).toContain('Session open failed:')

      await switchTo(harness, target.id)
      await tick()
      expect(resumed).toHaveLength(2)
      expect(resumed[1]?.disposed).toBe(0)
      expect(harness.ctx.agents.get(target.id)).toBe(resumed[1]?.agent)
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('keeps the current session usable when same-workspace resume fails', async () => {
    const target: SessionHeader = {
      version: 0,
      id: SessionId('broken-stopped-session'),
      createdAt: 1,
      cwd: '/workspace',
    }
    const { harness, resumed } = await switchHarness('/workspace', {
      resumeError: new Error('persisted log is unreadable'),
      sessionPersistence: {
        list: async () => [target],
        load: async () => ({ meta: target, events: [] }),
      },
    })
    try {
      await switchTo(harness, target.id)
      await tick()

      expect(resumed).toHaveLength(0)
      expect(harness.terminal.output).toContain('Session open failed: persisted log is unreadable')
      submit(harness, 'current session still works')
      expect(harness.agent.sent).toEqual([[{ type: 'text', text: 'current session still works' }]])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('resumes a stopped session from another project in the current process', async () => {
    const target: SessionHeader = {
      version: 0,
      id: SessionId('stopped-other-workspace'),
      createdAt: 1,
      cwd: '/other-project',
    }
    const handoff = vi.fn(() => Promise.reject(new Error('test host retained process')))
    const { harness, resumed } = await switchHarness('/workspace', {
      handoffResume: handoff,
      sessionPersistence: {
        list: async () => [target],
        load: async () => ({ meta: target, events: [] }),
      },
    })
    try {
      await switchTo(harness, target.id)
      await tick()

      expect(resumed).toHaveLength(1)
      expect(resumed[0]?.agent.session.header.cwd).toBe('/other-project')
      expect(handoff).not.toHaveBeenCalled()
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('falls back to host handoff when cross-workspace in-process resume fails', async () => {
    const target: SessionHeader = {
      version: 0,
      id: SessionId('handoff-other-workspace'),
      createdAt: 1,
      cwd: '/other-project',
    }
    const handoff = vi.fn(() => Promise.reject(new Error('test host retained process')))
    const { harness, resumed } = await switchHarness('/workspace', {
      resumeError: new Error('in-process resume unavailable'),
      handoffResume: handoff,
      sessionPersistence: {
        list: async () => [target],
        load: async () => ({ meta: target, events: [] }),
      },
    })
    try {
      await switchTo(harness, target.id)
      await tick()

      expect(resumed).toHaveLength(0)
      expect(handoff).toHaveBeenCalledWith(target.id, '/other-project')
      expect(harness.terminal.output).toContain('Resume handoff failed: test host retained process')
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })

  it('clears the previous session activity when switching to an idle session', async () => {
    const { harness, created } = await switchHarness()
    try {
      submit(harness, '/new')
      await tick()
      expect(created).toHaveLength(1)

      await switchTo(harness, 'main-session')

      harness.agent.status = 'running'
      harness.terminal.output = ''
      agentEvents(harness.ctx, harness.agent).emit('agent/status', { status: 'running' })
      await tick()
      expect(harness.terminal.output).not.toContain('○ Idle')

      harness.terminal.output = ''
      await switchTo(harness, String(created[0]!.agent.session.id))

      const currentFrame = harness.terminal.output.slice(
        harness.terminal.output.lastIndexOf('dsh DEEPSEEK HARNESS'),
      )
      expect(currentFrame).toContain('Idle')
      expect(currentFrame).not.toContain('Thinking')
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })
})
