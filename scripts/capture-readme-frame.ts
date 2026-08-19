import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Agent } from '@deepseek-ai/dsh-agent'
import {
  createMessage,
  createToolResultMessage,
  createUserMessage,
  type UserMessage,
} from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent, type SessionHeader } from '@deepseek-ai/dsh-session'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { Terminal as PiTerminal } from '@earendil-works/pi-tui'
import xtermHeadless, { type IBufferCell } from '@xterm/headless'
import {
  appendAssistant,
  appendUser,
  createTuiTestHarness,
  disposeTuiTestHarness,
} from '../packages/dsh-tui/tests/harness.ts'

const { Terminal } = xtermHeadless
const COLUMNS = 140
const ROWS = 32
const OUTPUT_DIR = resolve('.test-results/readme')
const OUTPUT_PATH = resolve(OUTPUT_DIR, 'overview.html')
const DEMO_FRAME_PATHS = [
  resolve(OUTPUT_DIR, 'demo-01-project.html'),
  resolve(OUTPUT_DIR, 'demo-02-switcher.html'),
  resolve(OUTPUT_DIR, 'demo-03-docs.html'),
  resolve(OUTPUT_DIR, 'demo-04-project.html'),
] as const

const ANSI16 = [
  '#1b1d23', '#e06c75', '#98c379', '#e5c07b',
  '#61afef', '#c678dd', '#56b6c2', '#abb2bf',
  '#5c6370', '#ff7a85', '#b5e890', '#f5d48b',
  '#78b9f2', '#d49be8', '#70d2df', '#f1f3f5',
] as const

const DEMO_TOOL: ToolDefinition = {
  name: 'run_tests',
  description: 'Run focused tests',
  parameters: {},
  output: { schema: { type: 'null' }, render: () => [] },
  execute: async () => [],
  presentCall: () => ({
    card: 'terminal',
    title: 'pnpm test --filter transcript',
    description: 'Run focused tests',
    cwd: '/workspace/dsh-tui-demo',
  }),
  presentResult: () => ({
    card: 'terminal',
    output: '48 files passed\n604 tests passed',
    exitCode: 0,
  }),
}

class CaptureTerminal implements PiTerminal {
  readonly columns = COLUMNS
  readonly rows = ROWS
  readonly kittyProtocolActive = false
  readonly drainInput = (): Promise<void> => Promise.resolve()
  output = ''
  private onInput: (data: string) => void = () => {}

  start(onInput: (data: string) => void): void {
    this.onInput = onInput
  }

  stop(): void {}
  write(data: string): void { this.output += data }
  moveBy(lines: number): void {
    if (lines > 0) this.output += `\x1b[${lines}B`
    if (lines < 0) this.output += `\x1b[${-lines}A`
  }
  hideCursor(): void { this.output += '\x1b[?25l' }
  showCursor(): void { this.output += '\x1b[?25h' }
  clearLine(): void { this.output += '\x1b[K' }
  clearFromCursor(): void { this.output += '\x1b[J' }
  clearScreen(): void { this.output += '\x1b[2J\x1b[H' }
  setTitle(title: string): void { this.output += `\x1b]0;${title}\x07` }
  setProgress(): void {}
  send(data: string): void { this.onInput(data) }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function paletteColor(index: number): string {
  const fixed = ANSI16[index]
  if (fixed !== undefined) return fixed
  if (index >= 232) {
    const level = 8 + (index - 232) * 10
    const pair = level.toString(16).padStart(2, '0')
    return `#${pair}${pair}${pair}`
  }
  const offset = index - 16
  const red = Math.floor(offset / 36)
  const green = Math.floor((offset % 36) / 6)
  const blue = offset % 6
  const level = (value: number): number => value === 0 ? 0 : 55 + value * 40
  return `#${[red, green, blue].map(value => level(value).toString(16).padStart(2, '0')).join('')}`
}

function colorOf(cell: IBufferCell, side: 'fg' | 'bg'): string | undefined {
  const isDefault = side === 'fg' ? cell.isFgDefault() : cell.isBgDefault()
  if (isDefault) return undefined
  const isRgb = side === 'fg' ? cell.isFgRGB() : cell.isBgRGB()
  const value = side === 'fg' ? cell.getFgColor() : cell.getBgColor()
  return isRgb ? `#${value.toString(16).padStart(6, '0')}` : paletteColor(value)
}

function cellStyle(cell: IBufferCell): string {
  let foreground = colorOf(cell, 'fg') ?? '#d8dee9'
  let background = colorOf(cell, 'bg') ?? 'transparent'
  if (cell.isInverse() !== 0) [foreground, background] = [background === 'transparent' ? '#111318' : background, foreground]
  const styles = [
    `color:${foreground}`,
    `background:${background}`,
    cell.isBold() !== 0 ? 'font-weight:700' : '',
    cell.isDim() !== 0 ? 'opacity:.62' : '',
    cell.isItalic() !== 0 ? 'font-style:italic' : '',
    cell.isUnderline() !== 0 ? 'text-decoration:underline' : '',
    cell.isStrikethrough() !== 0 ? 'text-decoration:line-through' : '',
    cell.isOverline() !== 0 ? 'text-decoration:overline' : '',
    cell.isInvisible() !== 0 ? 'visibility:hidden' : '',
  ]
  return styles.filter(Boolean).join(';')
}

function renderHtml(terminal: InstanceType<typeof Terminal>): string {
  const buffer = terminal.buffer.active
  const cells: string[] = []
  for (let row = 0; row < ROWS; row++) {
    const line = buffer.getLine(row)
    if (line === undefined) continue
    for (let column = 0; column < COLUMNS; column++) {
      const cell = line.getCell(column)
      if (cell === undefined || cell.getWidth() === 0) continue
      const width = Math.max(1, cell.getWidth())
      const value = cell.getChars()
      if (value === '' && colorOf(cell, 'bg') === undefined) continue
      cells.push(`<span class="cell" style="grid-column:${column + 1}/span ${width};grid-row:${row + 1};${cellStyle(cell)}">${escapeHtml(value === '' ? ' ' : value)}</span>`)
    }
  }
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>dsh-tui-pro overview</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1448px; height: 720px; overflow: hidden; background: #0b0d12; }
  body { display: grid; place-items: center; }
  .window { padding: 24px; border: 1px solid #2a303b; border-radius: 8px; background: #111318; box-shadow: 0 18px 48px #0008; }
  .terminal { display: grid; grid-template-columns: repeat(${COLUMNS}, 10px); grid-template-rows: repeat(${ROWS}, 21px); width: ${COLUMNS * 10}px; height: ${ROWS * 21}px; overflow: hidden; font: 16px/21px "Noto Sans Mono CJK SC", "Cascadia Mono", "DejaVu Sans Mono", monospace; letter-spacing: 0; font-variant-ligatures: none; }
  .cell { display: block; min-width: 0; height: 21px; white-space: pre; overflow: visible; }
</style>
<body><main class="window" aria-label="Anonymous dsh-tui-pro demonstration"><div class="terminal">${cells.join('')}</div></main></body>
</html>
`
}

async function settle(terminal: CaptureTerminal): Promise<void> {
  let previousLength = -1
  let stableChecks = 0
  for (let attempt = 0; attempt < 40; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 50))
    const length = terminal.output.length
    stableChecks = length === previousLength ? stableChecks + 1 : 0
    if (stableChecks >= 4 && terminal.output.includes('\x1b[?2026l')) return
    previousLength = length
  }
  throw new Error('the demonstration frame did not settle')
}

const secondaryId = SessionId('docs-refresh')
const secondaryHeader: SessionHeader = {
  version: 0,
  id: secondaryId,
  createdAt: 1_700_000_000_000,
  cwd: '/workspace/dsh-tui-demo',
}
const secondaryEvents: SessionEvent[] = [
  {
    type: 'user/message',
    seq: 0,
    time: 1_700_000_000_001,
    surfaceOp: 'append',
    data: createUserMessage({
      content: [{ type: 'text', text: 'Rewrite the quick start around the real installation path.' }],
      source: { kind: 'user' },
    }),
  },
  {
    type: 'assistant/message',
    seq: 1,
    time: 1_700_000_000_002,
    surfaceOp: 'append',
    data: {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'text', text: 'The first screen now leads with the multi-session workbench, then gives one install command and one launch command.' }],
        source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      }),
    },
  },
  {
    type: 'session/title',
    seq: 2,
    time: 1_700_000_000_003,
    data: { title: 'Documentation refresh', messageSeqs: [0], source: { kind: 'fallback' } },
  },
]

const capture = new CaptureTerminal()
const harness = await createTuiTestHarness(capture, () => {}, {
  cwd: '/workspace/dsh-tui-demo',
  contextWindow: 128_000,
  contextTokens: 28_400,
  now: () => 1_700_000_030_000,
  tools: { run_tests: DEMO_TOOL },
  config: {
    maxToolOutputLines: 6,
    maxMessageLines: 30,
    theme: { color: true, truecolor: true, name: 'deepseek' },
  },
  sessionPersistence: {
    list: async () => [secondaryHeader],
    load: async (id) => {
      if (id !== secondaryId) throw new Error(`unknown demo session: ${String(id)}`)
      return { meta: secondaryHeader, events: secondaryEvents }
    },
  },
  beforeMount(session, ctx) {
    ctx.agents.setFactory({
      async createAgent() {
        throw new Error('the README demonstration does not create sessions')
      },
      async resume(_ownerCtx, options) {
        const persistence = ctx.get('sessionPersistence')
        if (persistence === undefined) throw new Error('session persistence is not mounted')
        const prepared = await persistence.load(options.resumeSessionId)
        const resumedSession = ctx.sessions.prepare(options.resumeSessionId, {
          seed: prepared.events,
          meta: prepared.meta,
        })
        const disposeSession = ctx.sessions.enter(resumedSession)
        ctx.sessions.announce(resumedSession)
        const resumedAgent = {
          id: options.resumeSessionId,
          options: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
          session: resumedSession,
          status: 'idle',
          ctx,
          followup(_message: UserMessage) {},
          steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
          inject: () => '',
          send() {},
          updateInbox: () => 'not-found' as const,
          reserveTurnAdmission: () => undefined,
          cancel() {},
          whenIdle: () => Promise.resolve(),
        } as unknown as Agent
        const disposeAgent = ctx.agents.register(resumedAgent)
        return {
          agent: resumedAgent,
          async dispose() {
            disposeAgent()
            disposeSession()
          },
        }
      },
    })
    ctx.provide('permissionPresets', {
      names: ['read-only', 'workspace-write', 'danger-full-access'],
      current: () => 'workspace-write',
      resolve: (name: string) => ({ sandbox: name }),
      set: () => {},
      optionOf: (name: string) => ({ value: name, name }),
    } as never)
    void ctx.workspaceRegistry.list()[0]?.attachSession(secondaryId)
    appendUser(session, 'Profile transcript scrolling and session switching, then propose the smallest safe optimization.')
    appendAssistant(session, [
      { type: 'reasoning', text: 'Inspect render invalidation and repeated transcript projection.' },
      { type: 'text', text: 'I found two hot paths: repeated transcript projection during scroll, and sidebar work during session switches.' },
      { type: 'tool-call', id: 'readme-tool' as never, name: 'run_tests', arguments: '{}' },
    ], { inputTokens: 18_420, outputTokens: 612, cacheReadTokens: 11_300 })
    session.append('tool/call', {
      turn: 1,
      step: 1,
      callId: 'readme-tool' as never,
      name: 'run_tests',
      arguments: '{}',
    })
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: 'readme-tool' as never,
        content: [{ type: 'text', text: '48 files passed\n604 tests passed' }],
        isError: false,
      }),
    }, { surfaceOp: 'append' })
    session.append('todo/write', {
      todos: [
        { content: 'Measure render latency', status: 'completed' },
        { content: 'Cache stable transcript rows', status: 'in_progress' },
        { content: 'Verify memory usage', status: 'pending' },
      ],
    })
    session.append('plan/mode', { active: true })
    session.append('step/end', { turn: 1, step: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    session.append('session/title', {
      title: 'TUI performance review',
      messageSeqs: [1],
      source: { kind: 'fallback' },
    })
  },
})

try {
  await settle(capture)
  const emulator = new Terminal({
    allowProposedApi: true,
    cols: COLUMNS,
    rows: ROWS,
    scrollback: 2_000,
  })
  await mkdir(OUTPUT_DIR, { recursive: true })

  let consumedOutput = 0
  const captureFrame = async (path: string, requiredText: readonly string[]): Promise<string> => {
    const nextOutput = capture.output.slice(consumedOutput)
    consumedOutput = capture.output.length
    await new Promise<void>(resolveWrite => emulator.write(nextOutput, resolveWrite))
    const visibleFrame = Array.from({ length: ROWS }, (_, row) =>
      emulator.buffer.active.getLine(emulator.buffer.active.viewportY + row)?.translateToString(true) ?? '').join('\n')
    await writeFile(path.replace(/\.html$/, '.txt'), `${visibleFrame}\n`, 'utf8')
    const missing = requiredText.filter(text => !visibleFrame.includes(text))
    if (missing.length > 0) throw new Error(`${path} is missing: ${missing.join(', ')}`)
    const html = renderHtml(emulator)
    await writeFile(path, html, 'utf8')
    return html
  }

  const overview = await captureFrame(DEMO_FRAME_PATHS[0], [
    'Assistant',
    'Active sessions · 2',
    'TUI performance review',
    'Profile transcript scrolling',
    'Run focused tests',
    'Plan 1/3',
    'Perm workspace-write',
  ])
  await writeFile(OUTPUT_PATH, overview, 'utf8')

  capture.send('/switch')
  capture.send('\r')
  await settle(capture)
  await captureFrame(DEMO_FRAME_PATHS[1], ['Switch active session', 'Enter switch', 'Documentation refresh'])

  capture.send('\x1b[A')
  capture.send('\r')
  await settle(capture)
  await captureFrame(DEMO_FRAME_PATHS[2], [
    'Documentation refresh',
    'Rewrite the quick start',
    'The first screen now leads',
  ])

  capture.send('\x1b[1;3C')
  await settle(capture)
  await captureFrame(DEMO_FRAME_PATHS[3], ['TUI performance review', 'Run focused tests', 'Plan 1/3'])

  await writeFile(resolve(OUTPUT_DIR, 'overview.ansi'), capture.output, 'utf8')
  emulator.dispose()
  process.stdout.write(`${[OUTPUT_PATH, ...DEMO_FRAME_PATHS].join('\n')}\n`)
} finally {
  await disposeTuiTestHarness(harness)
}
