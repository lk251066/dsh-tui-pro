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
import { fadeGraySpec } from '../chat/timing.ts'

/** Severity levels; colors share the transcript notice mapping. */
export type NoticeKind = 'info' | 'warning' | 'error'

/** How long a transient notice stays on screen before clearing itself. */
export const DEFAULT_NOTICE_DURATION_MS = 5_000

/** Milliseconds before the deadline over which a truecolor notice fades out. */
export const NOTICE_FADE_MS = 800
/** Fade repaint cadence; ~20 fps matches the status-glyph animation. */
const NOTICE_FADE_TICK_MS = 50

/**
 * One-row transient notice below the prompt context. At most one notice shows
 * at a time: a new `show` replaces the current row and restarts its timer. On
 * truecolor terminals the row fades its gray toward the background over the
 * last {@link NOTICE_FADE_MS} instead of blinking off; without truecolor it
 * keeps the direct clear (the repo's standard degradation).
 */
export class NoticeSlotComponent implements Component {
  private text: string | undefined
  private kind: NoticeKind = 'info'
  private timer: ReturnType<typeof setTimeout> | undefined
  private fadeStart: ReturnType<typeof setTimeout> | undefined
  private fadeTick: ReturnType<typeof setInterval> | undefined
  private fadeEndsAt: number | undefined

  /**
   * @param palette - active role palette.
   * @param requestRender - invalidate hook called whenever the row appears,
   * changes, fades, or disappears (the caller's own guard handles
   * post-dispose calls).
   * @param truecolor - whether 24-bit SGR may be emitted; gates the fade-out.
   */
  constructor(
    private readonly palette: Palette,
    private readonly requestRender: () => void,
    private readonly truecolor = false,
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
    this.stopTimers()
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.clear()
    }, durationMs)
    if (this.truecolor && durationMs > NOTICE_FADE_MS) {
      this.fadeEndsAt = Date.now() + durationMs
      this.fadeStart = setTimeout(() => {
        this.fadeStart = undefined
        this.fadeTick = setInterval(() => this.requestRender(), NOTICE_FADE_TICK_MS)
      }, durationMs - NOTICE_FADE_MS)
    }
    this.requestRender()
  }

  /** Hide the current notice immediately (idempotent; cancels its timers). */
  clear(): void {
    this.stopTimers()
    if (this.text === undefined) return
    this.text = undefined
    this.requestRender()
  }

  /** Drop the pending auto-clear without rendering (teardown path). */
  dispose(): void {
    this.stopTimers()
    this.text = undefined
  }

  /** Cancel every pending timer and the fade state. */
  private stopTimers(): void {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    if (this.fadeStart !== undefined) clearTimeout(this.fadeStart)
    this.fadeStart = undefined
    if (this.fadeTick !== undefined) clearInterval(this.fadeTick)
    this.fadeTick = undefined
    this.fadeEndsAt = undefined
  }

  invalidate(): void {}

  render(width: number): string[] {
    const text = this.text
    if (text === undefined) return []
    const clipped = truncateToWidth(displayText(text), width, '…')
    const fadeEndsAt = this.fadeEndsAt
    if (fadeEndsAt !== undefined) {
      const remaining = fadeEndsAt - Date.now()
      if (remaining <= NOTICE_FADE_MS) {
        // The fade drops the kind color: every severity dims to the same gray
        // interpolation as it leaves, trough-clamped until the clear lands.
        return [`\x1b[${fadeGraySpec(Math.max(0, remaining) / NOTICE_FADE_MS)}m${clipped}\x1b[39m`]
      }
    }
    const paint = this.kind === 'error'
      ? this.palette.error
      : this.kind === 'warning' ? this.palette.warning : this.palette.dim
    return [paint(clipped)]
  }
}
