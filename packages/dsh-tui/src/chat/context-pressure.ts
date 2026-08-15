/**
 * Context-window pressure classification, the single home of the thresholds
 * every consumer (the context bar, the token readout, the low-context warning)
 * shares. Percentages are of the usable context window; the thresholds follow
 * Claude Code's feel — green until well into the window, warning as compaction
 * looms, critical when only a sliver remains.
 * @module @deepseek-ai/dsh-tui/chat/context-pressure
 */

/**
 * Shared pressure thresholds in percent of the context window: `warning` from
 * here to `critical`, `critical` from there up. Declared once so the bar's
 * color bands and the numeric readout's labels can never drift apart.
 */
export const contextPressureThresholds = { warning: 60, critical: 85 } as const

/** One band of context-window pressure, ordered by severity. */
export type ContextPressureLevel = 'ok' | 'warning' | 'critical'

/**
 * Classify a context-window fill percentage into a pressure band. The input is
 * clamped to [0, 100] first, so out-of-range metering (an estimate gone large,
 * a fresh session's negative remainder) resolves to an edge band rather than
 * surprising callers.
 *
 * @param percent - Fill percentage of the context window; clamped to [0, 100].
 * @returns `ok` below 60, `warning` from 60 to below 85, `critical` from 85.
 */
export function contextPressureLevel(percent: number): ContextPressureLevel {
  const clamped = Math.min(Math.max(percent, 0), 100)
  if (clamped < contextPressureThresholds.warning) return 'ok'
  if (clamped < contextPressureThresholds.critical) return 'warning'
  return 'critical'
}
