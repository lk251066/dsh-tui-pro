/**
 * The transient notice slot: a single bottom row for lightweight operation
 * receipts (state-switch feedback such as theme/model toggles, config reloads,
 * export paths) that clears itself after a timeout. Unlike transcript notices,
 * its content is presentation-only and never enters the durable conversation
 * flow; errors, warnings, and anything the user may need to scroll back to
 * still go through the persistent transcript notice path.
 * @module @deepseek-ai/dsh-tui/components/notice-slot
 */

import { truncateToWidth, type Component } from '@earendil-works/pi-tui'
import type { Palette } from './theme.ts'
import { displayText } from './text.ts'

/** Severity levels; colors share the transcript notice mapping. */
export type NoticeKind = 'info' | 'warning' | 'error'

/** How long a transient notice stays on screen before clearing itself. */
export const DEFAULT_NOTICE_DURATION_MS = 5_000

/**
 * One-row transient notice below the prompt context. At most one notice shows
 * at a time: a new `show` replaces the current row and restarts its timer.
 */
export class NoticeSlotComponent implements Component {
  private text: string | undefined
  private kind: NoticeKind = 'info'
  private timer: ReturnType<typeof setTimeout> | undefined

  /**
   * @param palette - active role palette.
   * @param requestRender - invalidate hook called whenever the row appears,
   * changes, or disappears (the caller's own guard handles post-dispose calls).
   */
  constructor(
    private readonly palette: Palette,
    private readonly requestRender: () => void,
  ) {}

  /**
   * Show (or replace) the current notice and schedule its auto-clear.
   * @param text - message; control characters escape at this render boundary.
   * @param kind - severity, mapped to the same roles as transcript notices.
   * @param durationMs - lifetime in milliseconds before the row clears itself.
   */
  show(text: string, kind: NoticeKind = 'info', durationMs: number = DEFAULT_NOTICE_DURATION_MS): void {
    this.text = text
    this.kind = kind
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.clear()
    }, durationMs)
    this.requestRender()
  }

  /** Hide the current notice immediately (idempotent; cancels its timer). */
  clear(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    if (this.text === undefined) return
    this.text = undefined
    this.requestRender()
  }

  /** Drop the pending auto-clear without rendering (teardown path). */
  dispose(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    this.text = undefined
  }

  invalidate(): void {}

  render(width: number): string[] {
    const text = this.text
    if (text === undefined) return []
    const paint = this.kind === 'error'
      ? this.palette.error
      : this.kind === 'warning' ? this.palette.warning : this.palette.dim
    return [paint(truncateToWidth(displayText(text), width, '…'))]
  }
}
