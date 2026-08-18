import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  appendUser,
  createTuiTestHarness,
  disposeTuiTestHarness,
  type TuiHarnessOptions,
} from './harness.ts'
import { HeadlessTerminal } from './headless-terminal.ts'

const { version: TUI_VERSION } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
) as { version: string }

const CONDENSED_NAME = 'dsh v'

/** Wall-clock wait for the welcome box's reveal sweep to finish (~720 ms at 6 columns per 45 ms tick). */
const revealSettled = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 900))

async function setup(
  options: TuiHarnessOptions = {},
  size: { columns?: number; rows?: number } = {},
) {
  const terminal = new HeadlessTerminal(size.columns ?? 140, size.rows ?? 32)
  const result = await createTuiTestHarness(terminal, () => {}, options)
  await terminal.waitForFrame(0)
  return result
}

async function rows(terminal: HeadlessTerminal): Promise<string[]> {
  const snapshot = await terminal.snapshot({ includeScrollback: true })
  return snapshot.split('\n').filter(line => /^\d+[~|]?\| /.test(line))
}

describe('workbench identity header', () => {
  it('renders the welcome box for a fresh session', async () => {
    const result = await setup()
    await revealSettled()
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    // The codex-style box: rounded frame around the block logo, the welcome
    // line, the live model and directory, suggested commands, and the tips row.
    expect(frame).toContain('╭')
    expect(frame).toContain('╯')
    expect(frame).toContain('█')
    expect(frame).toContain('Coding agent ready.')
    expect(frame).toContain('model: deepseek-v4-flash')
    expect(frame).toContain('directory: /workspace')
    expect(frame).toContain('/new')
    expect(frame).toContain('/help')
    expect(frame).toContain('/ commands · @ files · /sessions history')
    expect(frame).not.toContain(CONDENSED_NAME)
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('uses the same compact identity for a resumed session', async () => {
    const result = await setup({
      beforeMount(session) {
        appendUser(session, 'restored prompt')
      },
    })
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    const headerRow = (await rows(result.terminal)).find(row => row.includes(CONDENSED_NAME))
    expect(headerRow).toContain(`v${TUI_VERSION}`)
    expect(headerRow).not.toContain('deepseek-v4-flash')
    expect(headerRow).not.toContain('/workspace')
    expect(frame).not.toContain('█')
    expect(frame).not.toContain('Coding agent ready.')
    expect(frame).toContain('restored prompt')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('keeps the compact identity when the first user message lands', async () => {
    const result = await setup({ omitWelcome: true })
    await revealSettled()
    const before = await result.terminal.snapshot({ includeScrollback: true })
    expect(before).toContain('█')
    const frame = result.terminal.frames
    appendUser(result.session, 'first live message')
    await result.terminal.waitForFrame(frame)
    const after = await result.terminal.snapshot({ includeScrollback: true })
    expect(after).toContain(CONDENSED_NAME)
    expect(after).not.toContain('█')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('appends the session title to the compact identity', async () => {
    const result = await setup({
      omitWelcome: true,
      beforeMount(session) {
        appendUser(session, 'titled session prompt')
        session.append('session/title', {
          title: 'Renderer review',
          messageSeqs: [1],
          source: { kind: 'fallback' },
        })
      },
    })
    const headerRow = (await rows(result.terminal)).find(row => row.includes(CONDENSED_NAME))
    expect(headerRow).toContain('— Renderer review')
    expect(headerRow).not.toContain('Coding agent ready.')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('omits the model segment when no target is selected', async () => {
    const result = await setup({
      agentOptions: {},
      beforeMount(session) { appendUser(session, 'resume without a target') },
    })
    const headerRow = (await rows(result.terminal)).find(row => row.includes(CONDENSED_NAME))
    expect(headerRow).toContain(`v${TUI_VERSION}`)
    expect(headerRow).not.toContain('/workspace')
    expect(headerRow).not.toContain(' · ')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('keeps compact identity data on narrow terminals', async () => {
    const fresh = await setup({}, { columns: 40, rows: 24 })
    await revealSettled()
    const freshFrame = await fresh.terminal.snapshot({ includeScrollback: true })
    // Below logo width the box holds the one-line text brand instead.
    expect(freshFrame).toContain('DEEPSEEK')
    expect(freshFrame).toContain('Coding agent ready.')
    expect(freshFrame).toContain('╭')
    expect(freshFrame).not.toContain('█')
    await disposeTuiTestHarness(fresh)
    await fresh.terminal.dispose()

    const resumed = await setup({
      beforeMount(session) {
        appendUser(session, 'narrow restored prompt')
      },
    }, { columns: 40, rows: 24 })
    const resumedFrame = await resumed.terminal.snapshot({ includeScrollback: true })
    expect(resumedFrame).toContain('dsh')
    expect(resumedFrame).not.toContain('Coding agent ready.')
    expect(resumedFrame).not.toContain('█')
    await disposeTuiTestHarness(resumed)
    await resumed.terminal.dispose()
  })

  it('styles the compact name through the accent palette', async () => {
    const result = await setup({
      config: { theme: { color: true } },
      beforeMount(session) { appendUser(session, 'styled resume') },
    })
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    const headerIndex = frame.split('\n').findIndex(line => line.includes(CONDENSED_NAME))
    expect(headerIndex).toBeGreaterThan(-1)
    const lines = frame.split('\n')
    expect(lines.slice(headerIndex, headerIndex + 4).join('\n')).toContain('fg=bright-magenta bold')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })
})
