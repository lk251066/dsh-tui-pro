/**
 * Two-column split layout container for the assistant hub.
 * Left pane: session list; Right pane: assistant chat.
 */

import { Container, type Component } from '@earendil-works/pi-tui'
import type { Palette } from './theme.ts'

export class SplitLayoutComponent extends Container {
  private leftPane: Component | undefined
  private rightPane: Component | undefined
  private leftWidth = 0
  private readonly minLeftWidth = 25
  private readonly maxLeftWidthRatio = 0.35

  constructor(private readonly palette: Palette) {
    super()
  }

  setLeftPane(component: Component): void {
    if (this.leftPane) {
      this.removeChild(this.leftPane)
    }
    this.leftPane = component
    this.addChild(component)
  }

  setRightPane(component: Component): void {
    if (this.rightPane) {
      this.removeChild(this.rightPane)
    }
    this.rightPane = component
    this.addChild(component)
  }

  override render(width: number): string[] {
    if (!this.leftPane || !this.rightPane) {
      return ['(split layout not configured)']
    }

    // Calculate pane widths
    this.leftWidth = Math.max(
      this.minLeftWidth,
      Math.min(
        Math.floor(width * this.maxLeftWidthRatio),
        width - 40, // Reserve at least 40 cols for right pane
      ),
    )
    const rightWidth = width - this.leftWidth - 1 // -1 for separator

    // Render both panes
    const leftLines = this.leftPane.render(this.leftWidth)
    const rightLines = this.rightPane.render(rightWidth)

    // Merge side-by-side
    const maxLines = Math.max(leftLines.length, rightLines.length)
    const result: string[] = []

    for (let i = 0; i < maxLines; i++) {
      const left = (leftLines[i] || '').padEnd(this.leftWidth)
      const right = rightLines[i] || ''
      const separator = this.palette.dim('│')
      result.push(left + separator + right)
    }

    return result
  }

  /** Whether the given absolute column index is in the left pane. */
  isInLeftPane(column: number): boolean {
    return column <= this.leftWidth
  }
}
