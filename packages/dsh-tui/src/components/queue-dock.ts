/**
 * The steering queue dock: compact previews of the messages parked in the
 * agent's inbox (steered while running), plus the `/queue` management sheet
 * (edit fills the editor and replaces on submit; delete drops a message).
 * @module @deepseek-ai/dsh-tui/components/queue-dock
 */

import {
  Key,
  SelectList,
  matchesKey,
  truncateToWidth,
  type Component,
  type SelectItem,
} from '@earendil-works/pi-tui'
import { renderBottomInteraction } from './dialogs.ts'
import { dialogSelectTheme, type Palette } from './theme.ts'
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
    const head = this.palette.bold(this.palette.accent('Queued'))
    const rows = [head]
    for (const entry of this.entries.slice(0, 3)) {
      const lane = entry.lane === 'turn' ? ' (next turn)' : ''
      const row = truncateToWidth(`  ⏎ ${displayText(entry.preview)}${lane}`, width, '…')
      rows.push(this.palette.dim(row))
    }
    if (this.entries.length > 3) {
      rows.push(this.palette.dim(`  … +${this.entries.length - 3} more (/queue)`))
    }
    return rows
  }
}

/**
 * The `/queue` management sheet: one row per queued message; Enter opens its
 * actions (edit loads it into the editor, delete drops it), Esc closes.
 */
export class QueueDialog implements Component {
  private readonly list: SelectList
  private readonly entries: readonly QueueEntry[]

  constructor(
    entries: readonly QueueEntry[],
    private readonly palette: Palette,
    private readonly onEdit: (entry: QueueEntry) => void,
    private readonly onDelete: (entry: QueueEntry) => void,
    private readonly close: () => void,
  ) {
    this.entries = entries
    const items: SelectItem[] = entries.map(entry => ({
      value: entry.id,
      label: truncateToWidth(displayText(entry.preview), 64, '…'),
      description: entry.lane === 'turn' ? 'next turn' : 'next step',
    }))
    this.list = new SelectList(
      items.length > 0 ? items : [{ value: '', label: '(queue is empty)' }],
      Math.max(1, Math.min(8, items.length || 1)),
      dialogSelectTheme(palette),
    )
    this.list.onSelect = (item) => {
      const entry = entries.find(candidate => candidate.id === item.value)
      if (entry !== undefined) this.onEdit(entry)
      this.close()
    }
    this.list.onCancel = this.close
  }

  invalidate(): void {
    this.list.invalidate()
  }

  handleInput(data: string): void {
    const selected = this.list.getSelectedItem()
    if (matchesKey(data, Key.ctrl('c'))) {
      this.close()
    } else if (matchesKey(data, Key.delete) && selected !== null && selected.value !== '') {
      // Delete the highlighted entry without leaving the sheet.
      const entry = this.entries.find(candidate => candidate.id === selected.value)
      if (entry !== undefined) this.onDelete(entry)
    } else {
      this.list.handleInput(data)
    }
    this.invalidate()
  }

  render(width: number): string[] {
    const innerWidth = Math.max(1, width - 4)
    return renderBottomInteraction('Queued messages', [
      ...this.list.render(innerWidth),
      '',
      this.palette.dim('Enter edit • Del delete • Esc close'),
    ], width, this.palette)
  }
}
