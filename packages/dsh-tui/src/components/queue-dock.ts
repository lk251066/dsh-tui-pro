/**
 * Compact previews of messages parked in the agent inbox.
 * @module @deepseek-ai/dsh-tui/components/queue-dock
 */

import { truncateToWidth, type Component } from '@earendil-works/pi-tui'
import type { Palette } from './theme.ts'
import { displayText } from './text.ts'

/** One queue entry's render model. */
export interface QueueEntry {
  readonly id: string
  readonly preview: string
  /** Which inbox lane the message waits in. */
  readonly lane: 'step' | 'turn'
}

/** Compact dock listing queued messages; empty while the inbox is empty. */
export class QueueDockComponent implements Component {
  private entries: readonly QueueEntry[] = []

  constructor(private readonly palette: Palette) {}

  /** Replace the rendered entries. */
  update(entries: readonly QueueEntry[]): void {
    this.entries = entries
  }

  invalidate(): void {}

  render(width: number): string[] {
    if (this.entries.length === 0) return []
    const rows = [this.palette.bold(this.palette.accent('Queued'))]
    for (const entry of this.entries.slice(0, 3)) {
      const lane = entry.lane === 'turn' ? ' (next turn)' : ''
      rows.push(this.palette.dim(truncateToWidth(
        `  ⏎ ${displayText(entry.preview)}${lane}`,
        width,
        '…',
      )))
    }
    if (this.entries.length > 3) {
      rows.push(this.palette.dim(`  … +${this.entries.length - 3} more`))
    }
    return rows
  }
}
