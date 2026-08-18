import { describe, expect, it } from 'vitest'
import {
  appendUser,
  createTuiTestHarness,
  disposeTuiTestHarness,
  type TuiHarnessOptions,
} from './harness.ts'
import { HeadlessTerminal } from './headless-terminal.ts'

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

describe('workbench welcome area', () => {
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
    expect(frame).not.toContain('dsh v')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('uses no persistent top area for a resumed session', async () => {
    const result = await setup({
      beforeMount(session) {
        appendUser(session, 'restored prompt')
      },
    })
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    expect(frame).not.toContain('dsh v')
    expect(frame).not.toContain('█')
    expect(frame).not.toContain('Coding agent ready.')
    expect(frame).toContain('restored prompt')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('removes the welcome area when the first user message lands', async () => {
    const result = await setup({ omitWelcome: true })
    await revealSettled()
    const before = await result.terminal.snapshot({ includeScrollback: true })
    expect(before).toContain('█')
    const frame = result.terminal.frames
    appendUser(result.session, 'first live message')
    await result.terminal.waitForFrame(frame)
    const after = await result.terminal.snapshot({ includeScrollback: true })
    expect(after).not.toContain('dsh v')
    expect(after).not.toContain('█')
    expect(after).toContain('first live message')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('keeps a session title out of the transcript chrome', async () => {
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
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    expect(frame).toContain('Renderer review')
    expect(frame).not.toContain('dsh v')
    expect(frame).not.toContain('Coding agent ready.')
    expect(frame).toContain('titled session prompt')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('does not restore top chrome when no target is selected', async () => {
    const result = await setup({
      agentOptions: {},
      beforeMount(session) { appendUser(session, 'resume without a target') },
    })
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    expect(frame).not.toContain('dsh v')
    expect(frame).not.toContain('Coding agent ready.')
    expect(frame).toContain('resume without a target')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })

  it('keeps the transient welcome responsive on narrow terminals', async () => {
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
    expect(resumedFrame).not.toContain('dsh v')
    expect(resumedFrame).not.toContain('Coding agent ready.')
    expect(resumedFrame).not.toContain('█')
    expect(resumedFrame).toContain('narrow restored prompt')
    await disposeTuiTestHarness(resumed)
    await resumed.terminal.dispose()
  })

  it('does not leave an accented identity row in a colored resumed session', async () => {
    const result = await setup({
      config: { theme: { color: true } },
      beforeMount(session) { appendUser(session, 'styled resume') },
    })
    const frame = await result.terminal.snapshot({ includeScrollback: true })
    expect(frame).not.toContain('dsh v')
    expect(frame).toContain('styled resume')
    await disposeTuiTestHarness(result)
    await result.terminal.dispose()
  })
})
