/**
 * Compact active-workspace session list for the persistent sidebar.
 * @module @deepseek-ai/dsh-tui/components/session-list
 */

import {
  Container,
  truncateToWidth,
  visibleWidth,
} from '@earendil-works/pi-tui'
import type { Palette } from './theme.ts'

/** One rendered active workspace or assistant row. */
export interface SessionListItem {
  readonly id: string
  readonly title: string
  readonly workspace: string
  readonly status: 'idle' | 'running' | 'stopped'
  readonly lastActivityAgo: string
  readonly isActive: boolean
}

/** Host callbacks and dynamic sizing for {@link SessionListComponent}. */
export interface SessionListOptions {
  /** Maximum rows the component may contribute to the terminal frame. */
  maxRows(): number
}

function padToWidth(value: string, width: number): string {
  const clipped = truncateToWidth(value, Math.max(0, width), '')
  return clipped + ' '.repeat(Math.max(0, width - visibleWidth(clipped)))
}

/** Renders active workspace sessions without owning membership state. */
export class SessionListComponent extends Container {
  private items: readonly SessionListItem[] = []

  constructor(
    private readonly palette: Palette,
    private readonly options: SessionListOptions,
  ) {
    super()
  }

  /** Replace rows for the next render. */
  setItems(items: readonly SessionListItem[]): void {
    this.items = items
  }

  /** Current rows in the same order presented by the active-session navigator. */
  getItems(): readonly SessionListItem[] {
    return this.items
  }

  /** Resolve one rendered row to its active-session item. */
  itemAtRow(row: number): SessionListItem | undefined {
    const { start, end } = this.visibleWindow()
    const itemIndex = start + row - 2
    return row >= 2 && itemIndex >= start && itemIndex < end
      ? this.items[itemIndex]
      : undefined
  }

  override render(width: number): string[] {
    if (width <= 0) return []
    const lines = [
      padToWidth(this.palette.bold(` Active ${this.items.length}`), width),
      this.palette.dim('─'.repeat(width)),
    ]
    if (this.items.length === 0) {
      lines.push(this.palette.dim(padToWidth('  No active sessions', width)))
      return lines
    }

    const { start, end } = this.visibleWindow()

    for (let index = start; index < end; index++) {
      const item = this.items[index]
      if (item === undefined) continue
      const marker = item.status === 'running'
        ? this.palette.accent('●')
        : item.status === 'idle' ? this.palette.dim('○') : this.palette.dim('·')
      const active = item.isActive ? this.palette.bold('›') : ' '
      const age = item.lastActivityAgo
      const label = `${item.title} · ${item.workspace}`
      const titleWidth = Math.max(1, width - 6 - visibleWidth(age))
      const title = truncateToWidth(label, titleWidth, '…')
      const gap = ' '.repeat(Math.max(1, width - 5 - visibleWidth(title) - visibleWidth(age)))
      const titleLine = padToWidth(` ${active} ${marker} ${title}${gap}${this.palette.dim(age)}`, width)

      lines.push(titleLine)
    }

    if (start > 0) lines[1] = this.palette.dim(padToWidth(`─ ↑ ${start}`, width))
    if (end < this.items.length) {
      lines.push(this.palette.dim(padToWidth(`  ↓ ${this.items.length - end} more`, width)))
    }
    return lines.slice(0, this.options.maxRows())
  }

  private visibleWindow(): { readonly start: number; readonly end: number } {
    const visibleItems = Math.max(1, this.options.maxRows() - 2)
    const activeIndex = Math.max(0, this.items.findIndex(item => item.isActive))
    const start = Math.max(0, Math.min(
      activeIndex - Math.floor(visibleItems / 2),
      this.items.length - visibleItems,
    ))
    return { start, end: Math.min(this.items.length, start + visibleItems) }
  }
}
