/**
 * Session list component for the assistant's left pane.
 * Displays all active sessions with status, title, cwd, and last activity.
 */

import { Container } from '@earendil-works/pi-tui'
import type { Palette } from '../components/theme.ts'

interface SessionListItem {
  id: string
  title: string
  cwd: string
  status: 'idle' | 'running'
  lastActivityAgo: string
  isActive: boolean
}

export class SessionListComponent extends Container {
  private items: SessionListItem[] = []
  private selectedIndex = 0
  private readonly maxVisibleItems: number

  constructor(
    private readonly palette: Palette,
    maxHeight: number,
  ) {
    super()
    this.maxVisibleItems = Math.max(3, maxHeight - 4) // Reserve space for header and borders
  }

  setItems(items: SessionListItem[]): void {
    this.items = items
    // Clamp selected index
    if (this.selectedIndex >= items.length) {
      this.selectedIndex = Math.max(0, items.length - 1)
    }
  }

  getSelectedSessionId(): string | undefined {
    return this.items[this.selectedIndex]?.id
  }

  selectNext(): void {
    if (this.items.length === 0) return
    this.selectedIndex = (this.selectedIndex + 1) % this.items.length
  }

  selectPrevious(): void {
    if (this.items.length === 0) return
    this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length
  }

  override render(width: number): string[] {
    const lines: string[] = []
    const innerWidth = Math.max(1, width - 2)

    // Header
    const headerText = `Sessions (${this.items.length})`
    lines.push(this.palette.text(headerText.padEnd(innerWidth)))
    lines.push('─'.repeat(width))

    if (this.items.length === 0) {
      lines.push(this.palette.dim('  (no sessions)'))
      return lines
    }

    // Calculate visible window
    const start = Math.max(0, Math.min(
      this.selectedIndex - Math.floor(this.maxVisibleItems / 2),
      this.items.length - this.maxVisibleItems,
    ))
    const end = Math.min(this.items.length, start + this.maxVisibleItems)

    // Render items
    for (let i = start; i < end; i++) {
      const item = this.items[i]
      if (!item) continue
      const isSelected = i === this.selectedIndex
      const prefix = isSelected ? '▸ ' : '  '
      const statusIcon = item.status === 'running' ? '●' : '·'
      const activeMarker = item.isActive ? ' (current)' : ''

      // Title line (truncate if needed)
      const titleMaxLen = innerWidth - 4
      const titleText = item.title.length > titleMaxLen
        ? item.title.slice(0, titleMaxLen - 1) + '…'
        : item.title

      const titleLine = `${prefix}${statusIcon} ${titleText}${activeMarker}`
      const titleColor = isSelected ? this.palette.accent : this.palette.text
      lines.push(titleColor(titleLine.padEnd(innerWidth)))

      // CWD line (indented, dim)
      const cwdMaxLen = innerWidth - 6
      const cwdText = item.cwd.length > cwdMaxLen
        ? '…' + item.cwd.slice(-(cwdMaxLen - 1))
        : item.cwd
      const cwdLine = `    ${cwdText}`
      lines.push(this.palette.dim(cwdLine.padEnd(innerWidth)))

      // Status + age line (indented, dim)
      const statusText = `    ${item.status}, ${item.lastActivityAgo}`
      lines.push(this.palette.dim(statusText.padEnd(innerWidth)))

      // Blank separator
      if (i < end - 1) {
        lines.push('')
      }
    }

    // Scroll indicators
    if (start > 0) {
      lines[2] = this.palette.dim(`  ↑ ${start} more above`.padEnd(innerWidth))
    }
    if (end < this.items.length) {
      const lastIdx = lines.length - 1
      lines[lastIdx] = this.palette.dim(`  ↓ ${this.items.length - end} more below`.padEnd(innerWidth))
    }

    // Footer hint
    lines.push('')
    lines.push(this.palette.dim('[← ↑↓: navigate] [Enter: switch]'))

    return lines
  }
}
