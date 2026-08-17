/**
 * Alternate-screen terminal wrapper for the fixed full-screen workbench.
 * @module @lk251066/dsh-tui/full-screen-terminal
 */

import type { Terminal } from '@earendil-works/pi-tui'

const ENTER_ALTERNATE_SCREEN = '\x1b[?1049h\x1b[H\x1b[?7l'
const LEAVE_ALTERNATE_SCREEN = '\x1b[?7h\x1b[?1049l'
const ENABLE_MOUSE_REPORTING = '\x1b[?1000h\x1b[?1006h'
const DISABLE_MOUSE_REPORTING = '\x1b[?1006l\x1b[?1000l'

/** Mouse input decoded before it can reach the prompt editor. */
export type TerminalMouseInput = 'wheel-up' | 'wheel-down' | 'mouse'

/**
 * Decode SGR or legacy X10 mouse input emitted while mouse reporting is active.
 * @param data - One complete input sequence from pi-tui's stdin buffer.
 * @returns The wheel direction, another mouse event, or `undefined` for keyboard input.
 */
export function terminalMouseInput(data: string): TerminalMouseInput | undefined {
  const sgr = /^\x1b\[<(\d+);\d+;\d+[Mm]$/u.exec(data)
  if (sgr !== null) {
    const button = Number.parseInt(sgr[1] ?? '', 10)
    if ((button & 64) === 0) return 'mouse'
    return (button & 1) === 0 ? 'wheel-up' : 'wheel-down'
  }
  if (data.length === 6 && data.startsWith('\x1b[M')) {
    const button = data.charCodeAt(3) - 32
    if ((button & 64) === 0) return 'mouse'
    return (button & 1) === 0 ? 'wheel-up' : 'wheel-down'
  }
  return undefined
}

/** Runs each TUI start/stop cycle inside the terminal's alternate screen. */
export class FullScreenTerminal implements Terminal {
  private alternateScreenActive = false
  private mouseReportingActive = false

  constructor(private readonly terminal: Terminal) {}

  get columns(): number { return this.terminal.columns }
  get rows(): number { return this.terminal.rows }
  get kittyProtocolActive(): boolean { return this.terminal.kittyProtocolActive }

  start(onInput: (data: string) => void, onResize: () => void): void {
    this.enterAlternateScreen()
    try {
      this.terminal.start(onInput, onResize)
      this.enableMouseReporting()
    } catch (error: unknown) {
      this.disableMouseReporting()
      this.leaveAlternateScreen()
      throw error
    }
  }

  stop(): void {
    try {
      this.disableMouseReporting()
      this.terminal.stop()
    } finally {
      this.leaveAlternateScreen()
    }
  }

  drainInput(maxMs?: number, idleMs?: number): Promise<void> {
    return this.terminal.drainInput(maxMs, idleMs)
  }

  write(data: string): void { this.terminal.write(data) }
  moveBy(lines: number): void { this.terminal.moveBy(lines) }
  hideCursor(): void { this.terminal.hideCursor() }
  showCursor(): void { this.terminal.showCursor() }
  clearLine(): void { this.terminal.clearLine() }
  clearFromCursor(): void { this.terminal.clearFromCursor() }
  clearScreen(): void { this.terminal.clearScreen() }
  setTitle(title: string): void { this.terminal.setTitle(title) }
  setProgress(active: boolean): void { this.terminal.setProgress(active) }

  private enterAlternateScreen(): void {
    if (this.alternateScreenActive) return
    this.terminal.write(ENTER_ALTERNATE_SCREEN)
    this.alternateScreenActive = true
  }

  private leaveAlternateScreen(): void {
    if (!this.alternateScreenActive) return
    this.alternateScreenActive = false
    this.terminal.write(LEAVE_ALTERNATE_SCREEN)
  }

  private enableMouseReporting(): void {
    if (this.mouseReportingActive) return
    this.terminal.write(ENABLE_MOUSE_REPORTING)
    this.mouseReportingActive = true
  }

  private disableMouseReporting(): void {
    if (!this.mouseReportingActive) return
    this.mouseReportingActive = false
    this.terminal.write(DISABLE_MOUSE_REPORTING)
  }
}
