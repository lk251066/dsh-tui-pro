import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import {
  appendUser,
  createTuiTestHarness,
  disposeTuiTestHarness,
  type TuiHarnessOptions,
} from './harness.ts'
import { HeadlessTerminal } from './headless-terminal.ts'

/**
 * This package's own manifest — the same file `src/index.ts` reads through
 * `createRequire` for the condensed header's `v{version}` segment, pinned here
 * so the rendered version always tracks the manifest.
 */
const { version: TUI_VERSION } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
) as { version: string }

/** The condensed identity row's leading segments, before the dim metadata. */
const CONDENSED_NAME = 'dsh DEEPSEEK HARNESS'

async function setup(
  options: TuiHarnessOptions = {},
  size: { columns?: number; rows?: number } = {},
) {
  const terminal = new HeadlessTerminal(size.columns ?? 88, size.rows ?? 32)
  const result = await createTuiTestHarness(terminal, () => {}, options)
  await terminal.waitForFrame(0)
  return result
}

/** Rows of the terminal snapshot as plain text (`"row content"` per line). */
async function rows(terminal: HeadlessTerminal): Promise<string[]> {
  const snapshot = await terminal.snapshot({ includeScrollback: true })
  return snapshot.split('\n').filter(line => /^\d+[~|]?\| /.test(line))
}

describe('condensed welcome header', () => {
  it('renders the full block-letter banner for a history-less session', async () => {
    const result = await setup()
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    // Five block-letter rows plus the welcome and tips lines; the product
    // name never appears as literal text.
    expect(frame).toContain('█')
    expect(frame).toContain('Coding agent ready.')
    expect(frame).toContain('/ commands · @ files · /resume sessions · Ctrl+O cards · Shift+Tab mode')
    expect(frame).not.toContain(CONDENSED_NAME)
    expect(frame).not.toContain(`v${TUI_VERSION}`)
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('condenses to one identity row once the session carries history', async () => {
    const result = await setup({
      beforeMount(session) {
        appendUser(session, 'restored prompt')
      },
    })
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    // One row: bold accent `dsh`, bold product name, then dim version, model,
    // and cwd segments — and no block letters, welcome line, or tips row.
    const headerRow = (await rows(result.terminal)).find(row => row.includes(CONDENSED_NAME))
    expect(headerRow).toBeDefined()
    expect(headerRow).toContain(`v${TUI_VERSION}`)
    expect(headerRow).toContain('· deepseek-v4-flash')
    expect(headerRow).toContain('/workspace')
    expect(frame).not.toContain('█')
    expect(frame).not.toContain('Coding agent ready.')
    expect(frame).not.toContain('/ commands · @ files · /resume sessions')
    expect(frame).toContain('restored prompt')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('collapses the live banner when the first user message lands', async () => {
    const result = await setup({ omitWelcome: true })
    // No configured welcome, so the banner sweeps in; let the reveal land the
    // full block-letter logo before the first message collapses it.
    await vi.waitFor(async () => {
      expect(await result.terminal.snapshot({ includeScrollback: true })).toContain('█')
    })
    const frame = result.terminal.frames
    appendUser(result.session, 'first live message')
    await result.terminal.waitForFrame(frame)
    const after = await result.terminal.snapshot({ includeScrollback: true })
    expect(after).not.toContain('█')
    expect(after).toContain(CONDENSED_NAME)
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('appends the session title to the condensed row', async () => {
    const result = await setup({
      // No configured welcome, so this also pins that a resumed-with-history
      // session skips the banner sweep entirely (the condensed row is static).
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
    expect(headerRow).toBeDefined()
    expect(headerRow).toContain('— Renderer review')
    // The configured welcome never leaks into the condensed row.
    expect(headerRow).not.toContain('Coding agent ready.')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('omits the model segment when no target is selected', async () => {
    const result = await setup({
      agentOptions: {},
      beforeMount(session) {
        appendUser(session, 'model-less prompt')
      },
    })
    const headerRow = (await rows(result.terminal)).find(row => row.includes(CONDENSED_NAME))
    expect(headerRow).toBeDefined()
    expect(headerRow).toContain(`v${TUI_VERSION}`)
    expect(headerRow).toContain('/workspace')
    expect(headerRow).not.toContain(' · ')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('keeps the plain one-line text banner on narrow terminals with or without history', async () => {
    const fresh = await setup({}, { columns: 40, rows: 24 })
    const freshFrame = await fresh.terminal.snapshot({ includeScrollback: true })
    expect(freshFrame).toContain('DEEPSEEK')
    expect(freshFrame).toContain('Coding agent ready.')
    expect(freshFrame).not.toContain('█')
    await disposeTuiTestHarness(fresh)
    await fresh.terminal.dispose()

    const resumed = await setup({
      beforeMount(session) {
        appendUser(session, 'narrow restored prompt')
      },
    }, { columns: 40, rows: 24 })
    const resumedFrame = await resumed.terminal.snapshot({ includeScrollback: true })
    expect(resumedFrame).toContain('DEEPSEEK')
    expect(resumedFrame).toContain('Coding agent ready.')
    expect(resumedFrame).not.toContain('█')
    expect(resumedFrame).not.toContain(`v${TUI_VERSION}`)
    await disposeTuiTestHarness(resumed)
    await resumed.terminal.dispose()
  })

  it('styles the condensed name segment through the accent palette', async () => {
    const result = await setup({
      config: { theme: { color: true } },
      beforeMount(session) {
        appendUser(session, 'styled header prompt')
      },
    })
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    // The `dsh` prefix carries the accent foreground and bold; the whole
    // product name stays bold while the metadata segments render dim.
    const headerIndex = frame.split('\n').findIndex(line => line.includes(CONDENSED_NAME))
    expect(headerIndex).toBeGreaterThan(-1)
    const lines = frame.split('\n')
    expect(lines.slice(headerIndex, headerIndex + 4).join('\n')).toContain('fg=bright-magenta bold')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })
})
