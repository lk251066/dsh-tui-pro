/**
 * Stable two-column terminal layout with a fixed-width navigation pane.
 * @module @deepseek-ai/dsh-tui/components/split-layout
 */

import {
  Container,
  truncateToWidth,
  visibleWidth,
  type Component,
} from '@earendil-works/pi-tui'
import type { Palette } from './theme.ts'

const DEFAULT_LEFT_WIDTH = 32
const MIN_LEFT_WIDTH = 24
const MIN_RIGHT_WIDTH = 40

/** User-configurable sizing for the persistent navigation pane. */
export interface SplitLayoutOptions {
  /** Preferred left-pane width before the chat minimum forces it smaller. */
  readonly preferredLeftWidth?: number
}

function padToWidth(value: string, width: number): string {
  const clipped = truncateToWidth(value, Math.max(0, width), '')
  return clipped + ' '.repeat(Math.max(0, width - visibleWidth(clipped)))
}

/** Hosts the persistent session navigator beside the active chat. */
export class SplitLayoutComponent extends Container {
  private leftPane: Component | undefined
  private rightPane: Component | undefined
  private leftWidth = 0

  private readonly preferredLeftWidth: number

  constructor(private readonly palette: Palette, options: SplitLayoutOptions = {}) {
    super()
    this.preferredLeftWidth = Math.max(MIN_LEFT_WIDTH, Math.floor(options.preferredLeftWidth ?? DEFAULT_LEFT_WIDTH))
  }

  /** Replace the navigation pane. */
  setLeftPane(component: Component): void {
    if (this.leftPane !== undefined) this.removeChild(this.leftPane)
    this.leftPane = component
    this.addChild(component)
  }

  /** Replace the active chat pane. */
  setRightPane(component: Component): void {
    if (this.rightPane !== undefined) this.removeChild(this.rightPane)
    this.rightPane = component
    this.addChild(component)
  }

  override render(width: number): string[] {
    if (this.leftPane === undefined || this.rightPane === undefined || width < 3) return []
    this.leftWidth = Math.max(1, Math.min(
      this.preferredLeftWidth,
      Math.max(MIN_LEFT_WIDTH, width - MIN_RIGHT_WIDTH - 1),
      width - 2,
    ))
    const rightWidth = Math.max(1, width - this.leftWidth - 1)
    const leftLines = this.leftPane.render(this.leftWidth)
    const rightLines = this.rightPane.render(rightWidth)
    const rowCount = Math.max(leftLines.length, rightLines.length)
    const leftStart = rowCount - leftLines.length
    const separator = this.palette.dim('│')

    return Array.from({ length: rowCount }, (_, index) => {
      const left = padToWidth(leftLines[index - leftStart] ?? '', this.leftWidth)
      const right = truncateToWidth(rightLines[index] ?? '', rightWidth, '')
      return `${left}${separator}${right}`
    })
  }

  /** Whether an absolute terminal column belongs to the navigation pane. */
  isInLeftPane(column: number): boolean {
    return column <= this.leftWidth
  }
}
