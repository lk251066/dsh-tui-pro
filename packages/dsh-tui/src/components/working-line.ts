/**
 * The working status line above the input box (the Claude Code "✻ Thinking…"
 * row): a braille spinner frame, what the agent is actually doing (the newest
 * pending tool card's verb label, a per-turn whimsical verb, or `Thinking…`),
 * and the elapsed wall time. The glyph, action, and metadata use separate
 * visual roles. A stalled action
 * turns warning-colored. Renders nothing
 * while idle.
 * @module @deepseek-ai/dsh-tui/components/working-line
 */

import { truncateToWidth, type Component } from '@earendil-works/pi-tui'
import { formatStatusDuration } from '../chat/timing.ts'
import type { Palette } from './theme.ts'

/** What the line says while the model streams with no verb and no tool in flight. */
const THINKING_LABEL = 'Thinking…'

/**
 * How long without any model output before the line reads as stalled and turns
 * warning-colored. Claude Code's 3-second feel: long enough that quiet reasoning
 * bursts don't flicker, short enough to flag a hung stream quickly.
 */
export const STALL_WARNING_MS = 3000

/**
 * The optional live-status extras beyond the four core inputs. All fields are
 * transient turn state: callers pass fresh values (or nothing) every tick.
 */
export interface WorkingLineStatus {
  /** This turn's whimsical spinner verb; shown only while no tool verb is pending. */
  readonly verb?: string
  /** Epoch-ms timestamp of the most recent model output; a gap over {@link STALL_WARNING_MS} stalls the line. */
  readonly lastOutputAt?: number
}

/** One dim status row while the agent runs; nothing while idle. */
export class WorkingLineComponent implements Component {
  private running = false
  private startedAt: number | undefined
  private activity: string | undefined
  private frame: string | undefined
  private verb: string | undefined
  private lastOutputAt: number | undefined

  constructor(
    private readonly palette: Palette,
    private readonly now: () => number,
  ) {}

  /**
   * Drive the whole line in one call (each spinner tick).
   * @param running - Whether the agent is mid-turn.
   * @param startedAt - Turn start in epoch ms (clamps elapsed at 0 until set).
   * @param activity - Newest pending tool verb label; `undefined` = no tool in flight.
   * @param frame - Braille spinner frame, or `undefined` before the first tick.
   * @param status - Optional turn verb and last-output timestamp. Omitted fields
   * drop that behavior.
   */
  update(
    running: boolean,
    startedAt: number | undefined,
    activity: string | undefined,
    frame: string | undefined,
    status?: WorkingLineStatus,
  ): void {
    this.running = running
    this.startedAt = startedAt
    this.activity = activity
    this.frame = frame
    this.verb = status?.verb
    this.lastOutputAt = status?.lastOutputAt
  }

  invalidate(): void {}

  render(width: number): string[] {
    if (!this.running) return []
    const now = this.now()
    const glyph = this.frame ?? '⠋'
    // A pending tool's verb says what is actually happening; the whimsical turn
    // verb fills the between-tools stretch; plain thinking is the last resort.
    const label = this.activity ?? this.verb ?? THINKING_LABEL
    const startedAt = this.startedAt ?? now
    const elapsed = formatStatusDuration(Math.max(0, now - startedAt))
    // No last-output timestamp means the caller cannot judge staleness — stay
    // dim rather than guessing; only a measured gap beyond the threshold stalls.
    const stalled = this.lastOutputAt !== undefined && now - this.lastOutputAt > STALL_WARNING_MS
    const action = stalled ? this.palette.warning(label) : this.palette.text(label)
    const line = `${this.palette.accent(glyph)} ${action} ${this.palette.dim(`· ${elapsed}`)}`
    return [truncateToWidth(line, width, '')]
  }
}
