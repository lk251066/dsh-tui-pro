/**
 * Process-wide terminal title and taskbar progress for the multi-session TUI.
 * @module @lk251066/dsh-tui/chat/terminal-title
 */

import { displayText } from '../components/text.ts'
import { TOOL_SPINNER_FRAMES } from './timing.ts'

/** Slow enough for an OS title bar while still reading as active motion. */
export const TERMINAL_TITLE_INTERVAL_MS = 320

/** Terminal operations owned by the title controller. */
export interface TerminalTitleTarget {
  /** Set the terminal tab, window, and taskbar-preview title. */
  setTitle(title: string): void
  /** Set the terminal's supported taskbar progress state. */
  setProgress(active: boolean): void
}

/** Dynamic values used to derive the process-wide terminal state. */
export interface TerminalTitleControllerOptions {
  readonly terminal: TerminalTitleTarget
  /** Configured product label shown after the active session title. */
  readonly productTitle: string
  /** Current mounted session title; absent titles fall back to the product. */
  activeTitle(): string | undefined
  /** Number of live slots currently running a turn or compaction. */
  runningCount(): number
}

/** Terminal title lifecycle handle. */
export interface TerminalTitleController {
  /** Re-read the current session title and process-wide running count. */
  sync(): void
  /** Stop animation and leave the terminal in its idle title/progress state. */
  dispose(): void
}

/**
 * Format one terminal title frame.
 * @param activeTitle - Mounted session title, when one has been assigned.
 * @param productTitle - Configured product label.
 * @param runningCount - Number of live busy sessions.
 * @param frame - Current activity spinner frame.
 * @returns A control-character-safe terminal title.
 */
export function formatTerminalTitle(
  activeTitle: string | undefined,
  productTitle: string,
  runningCount: number,
  frame: string,
): string {
  const product = productTitle.trim()
  const active = activeTitle?.trim()
  const base = active === undefined || active.length === 0 || active === product
    ? product
    : `${active} — ${product}`
  return displayText(runningCount > 0 ? `${frame} ${runningCount} running · ${base}` : base)
}

/**
 * Create the sole writer for terminal title animation and taskbar progress.
 * @param options - Terminal target and live multi-session state readers.
 * @returns A controller that synchronizes on status/title edges and owns one
 * low-frequency timer while any session is busy.
 */
export function createTerminalTitleController(
  options: TerminalTitleControllerOptions,
): TerminalTitleController {
  let timer: ReturnType<typeof setTimeout> | undefined
  let frameIndex = 0
  let lastTitle: string | undefined
  let lastProgress: boolean | undefined
  let disposed = false

  const writeProgress = (active: boolean): void => {
    if (active === lastProgress) return
    lastProgress = active
    options.terminal.setProgress(active)
  }

  const writeTitle = (runningCount: number): void => {
    const frame = TOOL_SPINNER_FRAMES[frameIndex % TOOL_SPINNER_FRAMES.length]
      ?? TOOL_SPINNER_FRAMES[0]
    const title = formatTerminalTitle(
      options.activeTitle(),
      options.productTitle,
      runningCount,
      frame,
    )
    if (title === lastTitle) return
    lastTitle = title
    options.terminal.setTitle(title)
  }

  const stopTimer = (): void => {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  const scheduleTick = (): void => {
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      frameIndex = (frameIndex + 1) % TOOL_SPINNER_FRAMES.length
      sync()
    }, TERMINAL_TITLE_INTERVAL_MS)
  }

  const sync = (): void => {
    if (disposed) return
    const runningCount = options.runningCount()
    writeProgress(runningCount > 0)
    if (runningCount <= 0) {
      stopTimer()
      frameIndex = 0
      writeTitle(0)
      return
    }
    writeTitle(runningCount)
    scheduleTick()
  }

  return {
    sync,
    dispose(): void {
      if (disposed) return
      disposed = true
      stopTimer()
      options.terminal.setProgress(false)
      options.terminal.setTitle(formatTerminalTitle(
        options.activeTitle(),
        options.productTitle,
        0,
        TOOL_SPINNER_FRAMES[0],
      ))
    },
  }
}
