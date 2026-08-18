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
import { padToWidth } from './text.ts'

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
    const visible = this.visibleRows()
    const contentRow = row - 2
    if (visible.hiddenBelow > 0 && contentRow === visible.rows.length - 1) return undefined
    return visible.rows[contentRow]?.item
  }

  override render(width: number): string[] {
    if (width <= 0) return []
    const lines = [
      padToWidth(this.palette.bold(` Active sessions · ${this.items.length}`), width),
      this.palette.dim('─'.repeat(width)),
    ]
    if (this.items.length === 0) {
      lines.push(this.palette.dim(padToWidth('  No active sessions', width)))
      return lines
    }

    const { rows, hiddenAbove, hiddenBelow } = this.visibleRows()
    for (const row of rows) {
      const item = row.item
      if (item === undefined) {
        lines.push(padToWidth(this.palette.dim(` ${row.workspace}`), width))
        continue
      }
      const marker = item.status === 'running'
        ? this.palette.accent('●')
        : item.status === 'idle' ? this.palette.dim('○') : this.palette.dim('·')
      const age = item.lastActivityAgo
      const titleWidth = Math.max(1, width - 5 - visibleWidth(age))
      const title = truncateToWidth(item.title, titleWidth, '…')
      const styledTitle = item.isActive ? this.palette.accent(title) : title
      const gap = ' '.repeat(Math.max(1, width - 3 - visibleWidth(title) - visibleWidth(age)))
      const titleLine = padToWidth(` ${marker} ${styledTitle}${gap}${this.palette.dim(age)}`, width)

      lines.push(titleLine)
    }

    if (hiddenAbove > 0) lines[1] = this.palette.dim(padToWidth(`─ ↑ ${hiddenAbove}`, width))
    if (hiddenBelow > 0 && lines.length > 2) {
      lines[lines.length - 1] = this.palette.dim(padToWidth(`  ↓ ${hiddenBelow} more`, width))
    }
    return lines.slice(0, this.options.maxRows())
  }

  private visibleRows(): {
    readonly rows: readonly { readonly workspace: string; readonly item?: SessionListItem }[]
    readonly hiddenAbove: number
    readonly hiddenBelow: number
  } {
    const grouped = new Map<string, SessionListItem[]>()
    for (const item of this.items) {
      const group = grouped.get(item.workspace)
      if (group === undefined) grouped.set(item.workspace, [item])
      else group.push(item)
    }
    const allRows: { workspace: string; item?: SessionListItem }[] = []
    // Group headers earn their row only with multiple workspaces; a single
    // workspace already names itself in the sidebar's Workspace section.
    const showGroupHeaders = grouped.size >= 2
    for (const [workspace, items] of grouped) {
      if (showGroupHeaders) allRows.push({ workspace })
      for (const item of items) allRows.push({ workspace, item })
    }
    const budget = Math.max(1, this.options.maxRows() - 2)
    const activeIndex = Math.max(0, allRows.findIndex(row => row.item?.isActive === true))
    const start = Math.max(0, Math.min(
      activeIndex - Math.floor(budget / 2),
      allRows.length - budget,
    ))
    const end = Math.min(allRows.length, start + budget)
    return {
      rows: allRows.slice(start, end),
      hiddenAbove: start,
      hiddenBelow: allRows.length - end,
    }
  }
}
