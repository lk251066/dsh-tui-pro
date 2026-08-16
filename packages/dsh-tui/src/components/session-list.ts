/**
 * Compact, focusable live-session navigator for the persistent sidebar.
 * @module @deepseek-ai/dsh-tui/components/session-list
 */

import {
  Container,
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
} from '@earendil-works/pi-tui'
import type { Palette } from './theme.ts'

/** One rendered live-session row. */
export interface SessionListItem {
  readonly id: string
  readonly title: string
  readonly workspace: string
  readonly status: 'idle' | 'running'
  readonly lastActivityAgo: string
  readonly isActive: boolean
}

/** Host callbacks and dynamic sizing for {@link SessionListComponent}. */
export interface SessionListOptions {
  /** Maximum rows the component may contribute to the terminal frame. */
  maxRows(): number
  /** Activate the selected session. */
  onActivate?(sessionId: string): void
  /** Return focus to the chat editor. */
  onExit?(): void
  /** Repaint after selection or focus changes. */
  onChange?(): void
}

function padToWidth(value: string, width: number): string {
  const clipped = truncateToWidth(value, Math.max(0, width), '')
  return clipped + ' '.repeat(Math.max(0, width - visibleWidth(clipped)))
}

/** Renders and navigates live sessions without owning registry state. */
export class SessionListComponent extends Container {
  focused = false
  private items: readonly SessionListItem[] = []
  private selectedIndex = 0

  constructor(
    private readonly palette: Palette,
    private readonly options: SessionListOptions,
  ) {
    super()
  }

  /** Replace rows while preserving a still-valid selection. */
  setItems(items: readonly SessionListItem[], preferredSessionId?: string): void {
    const selectedId = preferredSessionId ?? this.getSelectedSessionId()
    this.items = items
    const selectedIndex = selectedId === undefined
      ? -1
      : items.findIndex(item => item.id === selectedId)
    this.selectedIndex = selectedIndex >= 0
      ? selectedIndex
      : Math.min(this.selectedIndex, Math.max(0, items.length - 1))
  }

  /** Return the selected live session id, if any. */
  getSelectedSessionId(): string | undefined {
    return this.items[this.selectedIndex]?.id
  }

  /** Move selection to the next row, wrapping at the end. */
  selectNext(): void {
    if (this.items.length === 0) return
    this.selectedIndex = (this.selectedIndex + 1) % this.items.length
  }

  /** Move selection to the previous row, wrapping at the start. */
  selectPrevious(): void {
    if (this.items.length === 0) return
    this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.selectPrevious()
      this.options.onChange?.()
      return
    }
    if (matchesKey(data, Key.down)) {
      this.selectNext()
      this.options.onChange?.()
      return
    }
    if (matchesKey(data, Key.enter)) {
      const selectedId = this.getSelectedSessionId()
      if (selectedId !== undefined) this.options.onActivate?.(selectedId)
      return
    }
    if (matchesKey(data, Key.left) || matchesKey(data, Key.f6) || matchesKey(data, Key.escape)) {
      this.options.onExit?.()
    }
  }

  override render(width: number): string[] {
    if (width <= 0) return []
    const lines = [
      padToWidth(this.palette.bold(` Sessions ${this.items.length}`), width),
      this.palette.dim('─'.repeat(width)),
    ]
    if (this.items.length === 0) {
      lines.push(this.palette.dim(padToWidth('  No live sessions', width)))
      return lines
    }

    const visibleItems = Math.max(1, this.options.maxRows() - lines.length)
    const start = Math.max(0, Math.min(
      this.selectedIndex - Math.floor(visibleItems / 2),
      this.items.length - visibleItems,
    ))
    const end = Math.min(this.items.length, start + visibleItems)

    for (let index = start; index < end; index++) {
      const item = this.items[index]
      if (item === undefined) continue
      const selected = index === this.selectedIndex
      const marker = item.status === 'running'
        ? this.palette.accent('●')
        : this.palette.dim('○')
      const active = item.isActive ? this.palette.bold('›') : ' '
      const age = item.lastActivityAgo
      const label = `${item.title} · ${item.workspace}`
      const titleWidth = Math.max(1, width - 6 - visibleWidth(age))
      const title = truncateToWidth(label, titleWidth, '…')
      const gap = ' '.repeat(Math.max(1, width - 5 - visibleWidth(title) - visibleWidth(age)))
      const titleLine = padToWidth(` ${active} ${marker} ${title}${gap}${this.palette.dim(age)}`, width)

      if (selected && this.focused) {
        lines.push(this.palette.selected(titleLine))
      } else {
        lines.push(titleLine)
      }
    }

    if (start > 0) lines[1] = this.palette.dim(padToWidth(`─ ↑ ${start}`, width))
    if (end < this.items.length) {
      lines.push(this.palette.dim(padToWidth(`  ↓ ${this.items.length - end} more`, width)))
    }
    return lines.slice(0, this.options.maxRows())
  }
}
