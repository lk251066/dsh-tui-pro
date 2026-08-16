/**
 * Alternate-screen terminal wrapper for the fixed full-screen workbench.
 * @module @lk251066/dsh-tui/full-screen-terminal
 */

import type { Terminal } from '@earendil-works/pi-tui'

const ENTER_ALTERNATE_SCREEN = '\x1b[?1049h\x1b[H\x1b[?7l'
const LEAVE_ALTERNATE_SCREEN = '\x1b[?7h\x1b[?1049l'

/** Runs each TUI start/stop cycle inside the terminal's alternate screen. */
export class FullScreenTerminal implements Terminal {
  private alternateScreenActive = false

  constructor(private readonly terminal: Terminal) {}

  get columns(): number { return this.terminal.columns }
  get rows(): number { return this.terminal.rows }
  get kittyProtocolActive(): boolean { return this.terminal.kittyProtocolActive }

  start(onInput: (data: string) => void, onResize: () => void): void {
    this.enterAlternateScreen()
    try {
      this.terminal.start(onInput, onResize)
    } catch (error: unknown) {
      this.leaveAlternateScreen()
      throw error
    }
  }

  stop(): void {
    try {
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
}
