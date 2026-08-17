import { describe, expect, it } from 'vitest'
import type { Terminal } from '@earendil-works/pi-tui'
import { FullScreenTerminal, terminalMouseInput } from '../src/full-screen-terminal.ts'

class RecordingTerminal implements Terminal {
  columns = 80
  rows = 24
  kittyProtocolActive = false
  output = ''
  startError: Error | undefined

  start(): void {
    if (this.startError !== undefined) throw this.startError
  }

  stop(): void {}
  drainInput(): Promise<void> { return Promise.resolve() }
  write(data: string): void { this.output += data }
  moveBy(): void {}
  hideCursor(): void {}
  showCursor(): void {}
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void {}
  setTitle(): void {}
  setProgress(): void {}
}

describe('FullScreenTerminal mouse lifecycle', () => {
  it('enables SGR mouse reporting after startup and disables it before leaving the alternate screen', () => {
    const terminal = new RecordingTerminal()
    const fullScreen = new FullScreenTerminal(terminal)

    fullScreen.start(() => {}, () => {})
    expect(terminal.output).toContain('\x1b[?1049h')
    expect(terminal.output).toContain('\x1b[?1002h\x1b[?1006h')
    fullScreen.stop()
    expect(terminal.output).toContain('\x1b[?1006l\x1b[?1002l')
    expect(terminal.output.indexOf('\x1b[?1006l')).toBeLessThan(terminal.output.indexOf('\x1b[?1049l'))
  })

  it('restores the alternate screen when terminal startup fails', () => {
    const terminal = new RecordingTerminal()
    terminal.startError = new Error('raw mode failed')
    const fullScreen = new FullScreenTerminal(terminal)

    expect(() => { fullScreen.start(() => {}, () => {}) }).toThrow('raw mode failed')
    expect(terminal.output).toContain('\x1b[?1049l')
    expect(terminal.output).not.toContain('\x1b[?1002h')
  })

  it('decodes SGR press, drag, release, modifiers, and wheel events', () => {
    expect(terminalMouseInput('\x1b[<0;10;4M')).toEqual({
      kind: 'press', button: 'left', column: 10, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    })
    expect(terminalMouseInput('\x1b[<36;11;5M')).toEqual({
      kind: 'move', button: 'left', column: 11, row: 5,
      shift: true, alt: false, ctrl: false, wheelRows: 0,
    })
    expect(terminalMouseInput('\x1b[<0;11;5m')).toEqual({
      kind: 'release', button: 'none', column: 11, row: 5,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    })
    expect(terminalMouseInput('\x1b[<88;12;6M')).toEqual({
      kind: 'wheel', button: 'left', column: 12, row: 6,
      shift: false, alt: true, ctrl: true, wheelRows: 3,
    })
    expect(terminalMouseInput('\x1b[<65;10;4M')?.wheelRows).toBe(-3)
  })

  it('decodes legacy X10 coordinates and wheel direction', () => {
    expect(terminalMouseInput(`\x1b[M${String.fromCharCode(96, 42, 37)}`)).toEqual({
      kind: 'wheel', button: 'left', column: 10, row: 5,
      shift: false, alt: false, ctrl: false, wheelRows: 3,
    })
    expect(terminalMouseInput(`\x1b[M${String.fromCharCode(97, 42, 37)}`)?.wheelRows).toBe(-3)
    expect(terminalMouseInput('x')).toBeUndefined()
  })
})
