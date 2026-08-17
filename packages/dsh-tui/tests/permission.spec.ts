import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@earendil-works/pi-tui'
import { createTuiTestHarness, disposeTuiTestHarness } from './harness.ts'

class FakeTerminal implements Terminal {
  columns = 88
  rows = 32
  kittyProtocolActive = false
  output = ''
  title = ''
  progress = false
  started = 0
  stopped = 0
  cursorVisible = true
  drainInput = () => Promise.resolve()
  private onInput: (data: string) => void = () => {}
  private onResize: () => void = () => {}
  start(onInput: (data: string) => void, onResize: () => void): void {
    this.started += 1
    this.onInput = onInput
    this.onResize = onResize
  }
  stop(): void { this.stopped += 1 }
  write(data: string): void { this.output += data }
  send(data: string): void { this.onInput(data) }
  moveBy(): void {}
  hideCursor(): void { this.output += '[hide]' }
  showCursor(): void { this.output += '[show]' }
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void { this.output += '\x1b[2J' }
  setTitle(t: string): void { this.title = t }
  setProgress(active: boolean): void { this.progress = active }
}

describe('Shift+Tab permission ring', () => {
  it('cycles to the danger preset only after the risk confirmation', async () => {
    const applied: string[] = []
    let current = 'workspace-write'
    const terminal = new FakeTerminal()
    const result = await createTuiTestHarness(terminal, vi.fn(), {
      configureContext: async (ctx) => {
        ctx.provide('permissionPresets', {
          names: ['read-only', 'workspace-write', 'danger-full-access'],
          current: () => current,
          resolve: (name: string) => ({
            sandbox: name === 'danger-full-access' ? 'danger-full-access' : name,
            description: `preset ${name}`,
          }),
          set: (_session: unknown, name: string) => {
            applied.push(name)
            current = name
          },
          optionOf: (name: string) => ({ value: name, name }),
        } as never)
      },
    })
    await new Promise(resolve => setTimeout(resolve, 25))
    // The effective preset stays visible in the Status section.
    expect(terminal.output).toMatch(/Perm\s+workspace-write/)

    // Shift+Tab from workspace-write targets the danger preset: confirm first.
    // The acknowledgement is the Claude-Code-style warning: an error-toned
    // WARNING title over a body recommending a sandbox or container.
    terminal.send('\x1b[Z')
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(terminal.output).toContain('Full access')
    expect(terminal.output).toContain('WARNING: danger-full-access disables all')
    expect(terminal.output).toContain('permission checks')
    expect(terminal.output).toContain('inside a sandbox')
    expect(terminal.output).toContain('or container')
    expect(applied).toEqual([])

    // Escape the confirmation: nothing applied.
    terminal.send('\x1b')
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(applied).toEqual([])

    // The confirmation opens on the safe No item: Enter alone keeps the preset.
    terminal.send('\x1b[Z')
    await new Promise(resolve => setTimeout(resolve, 25))
    terminal.send('\r')
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(applied).toEqual([])

    // Cycle again and deliberately move to the Yes item: the preset switch lands.
    terminal.send('\x1b[Z')
    await new Promise(resolve => setTimeout(resolve, 25))
    terminal.send('\x1b[B')
    terminal.send('\r')
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(applied).toEqual(['danger-full-access'])
    expect(terminal.output).toMatch(/Perm\s+danger-full-access/)

    // One more cycle wraps to the most restrictive preset without confirming.
    terminal.send('\x1b[Z')
    await new Promise(resolve => setTimeout(resolve, 25))
    expect(applied).toEqual(['danger-full-access', 'read-only'])
    await disposeTuiTestHarness(result)
  })
})
