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

/** Fields shared by the fixed assistant and active project-session rows. */
interface SessionListItemBase {
  readonly id: string
  readonly title: string
  readonly status: 'idle' | 'running' | 'stopped'
  readonly lastActivityAgo: string
  readonly isActive: boolean
}

/** One rendered fixed-assistant or active project-session row. */
export type SessionListItem = SessionListItemBase & (
  | { readonly kind: 'assistant' }
  | { readonly kind: 'project'; readonly workspace: string }
)

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
    const assistant = this.items.find(item => item.kind === 'assistant')
    if (row === 2) return assistant
    if (row < 6) return undefined
    return this.visibleProjectRows().rows[row - 6]?.item
  }

  override render(width: number): string[] {
    if (width <= 0) return []
    const assistant = this.items.find(item => item.kind === 'assistant')
    const projects = this.items.filter(item => item.kind === 'project')
    const lines = [
      padToWidth(this.palette.bold(' Assistant'), width),
      this.palette.dim('─'.repeat(width)),
      assistant === undefined
        ? this.palette.dim(padToWidth('  Unavailable', width))
        : this.renderItem(assistant, width),
      padToWidth('', width),
      padToWidth(this.palette.bold(` Active sessions · ${projects.length}`), width),
      this.palette.dim('─'.repeat(width)),
    ]
    if (projects.length === 0) {
      lines.push(this.palette.dim(padToWidth('  No active sessions', width)))
      return lines.slice(0, this.options.maxRows())
    }

    const { rows, hiddenAbove, hiddenBelow } = this.visibleProjectRows()
    if (hiddenAbove > 0 || hiddenBelow > 0) {
      const indicators = [
        hiddenAbove > 0 ? `↑ ${hiddenAbove}` : '',
        hiddenBelow > 0 ? `↓ ${hiddenBelow}` : '',
      ].filter(Boolean).join('  ')
      lines[5] = this.palette.dim(padToWidth(`─ ${indicators}`, width))
    }
    for (const row of rows) {
      const item = row.item
      if (item === undefined) {
        lines.push(padToWidth(this.palette.dim(` ${row.workspace}`), width))
        continue
      }
      lines.push(this.renderItem(item, width))
    }
    return lines.slice(0, this.options.maxRows())
  }

  private renderItem(item: SessionListItem, width: number): string {
    const marker = item.status === 'running'
      ? this.palette.accent('●')
      : item.status === 'idle' ? this.palette.dim('○') : this.palette.dim('·')
    const age = item.lastActivityAgo
    const titleWidth = Math.max(1, width - 5 - visibleWidth(age))
    const title = truncateToWidth(item.title, titleWidth, '…')
    const styledTitle = item.isActive ? this.palette.accent(title) : title
    const gap = ' '.repeat(Math.max(1, width - 3 - visibleWidth(title) - visibleWidth(age)))
    return padToWidth(` ${marker} ${styledTitle}${gap}${this.palette.dim(age)}`, width)
  }

  private visibleProjectRows(): {
    readonly rows: readonly { readonly workspace: string; readonly item?: SessionListItem }[]
    readonly hiddenAbove: number
    readonly hiddenBelow: number
  } {
    const grouped = new Map<string, SessionListItem[]>()
    for (const item of this.items) {
      if (item.kind !== 'project') continue
      const group = grouped.get(item.workspace)
      if (group === undefined) grouped.set(item.workspace, [item])
      else group.push(item)
    }
    const allRows: { workspace: string; item?: SessionListItem }[] = []
    // Group headers earn their row only with multiple project workspaces; a
    // single workspace label would repeat information without aiding scanning.
    const showGroupHeaders = grouped.size >= 2
    for (const [workspace, items] of grouped) {
      if (showGroupHeaders) allRows.push({ workspace })
      for (const item of items) allRows.push({ workspace, item })
    }
    const budget = Math.max(1, this.options.maxRows() - 6)
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
