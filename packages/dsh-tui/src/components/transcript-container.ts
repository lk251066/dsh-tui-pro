/**
 * Transcript container that routes a click to the child occupying one row.
 * @module @lk251066/dsh-tui/components/transcript-container
 */

import { Container, type Component } from '@earendil-works/pi-tui'

/** Optional interaction implemented by collapsible transcript blocks. */
export interface TranscriptClickable {
  /** Toggle a block when `row` names its disclosure header. */
  clickTranscriptRow(row: number, width: number): boolean
}

function clickable(component: Component): component is Component & TranscriptClickable {
  return 'clickTranscriptRow' in component
    && typeof (component as Partial<TranscriptClickable>).clickTranscriptRow === 'function'
}

/** Ordered transcript children with row-to-component click routing. */
export class TranscriptContainer extends Container {
  private cachedWidth: number | undefined
  private cachedLines: string[] = []
  private cachedChildren: Array<{ readonly component: Component; readonly lines: string[] }> = []
  private dirtyFrom = 0
  private linesDirty = true

  override addChild(component: Component): void {
    const index = this.children.length
    super.addChild(component)
    this.dirtyFrom = Math.min(this.dirtyFrom, index)
    this.linesDirty = true
  }

  override removeChild(component: Component): void {
    const index = this.children.indexOf(component)
    if (index < 0) return
    super.removeChild(component)
    this.dirtyFrom = Math.min(this.dirtyFrom, index)
    this.linesDirty = true
  }

  override clear(): void {
    super.clear()
    this.cachedChildren = []
    this.cachedLines = []
    this.dirtyFrom = 0
    this.linesDirty = true
  }

  /** Re-render this component and every transcript component after it. */
  markDirty(component?: Component): void {
    const index = component === undefined ? 0 : this.children.indexOf(component)
    this.dirtyFrom = Math.min(this.dirtyFrom, index < 0 ? 0 : index)
    this.linesDirty = true
  }

  override invalidate(): void {
    super.invalidate()
    this.markDirty()
  }

  override render(width: number): string[] {
    if (this.cachedWidth !== width) {
      this.cachedWidth = width
      this.cachedChildren = []
      this.cachedLines = []
      this.dirtyFrom = 0
      this.linesDirty = true
    }
    const unchanged = Math.min(this.dirtyFrom, this.children.length)
    this.cachedChildren.length = unchanged
    for (let index = unchanged; index < this.children.length; index += 1) {
      const component = this.children[index] as Component
      this.cachedChildren.push({ component, lines: component.render(width) })
    }
    if (this.linesDirty) {
      this.cachedLines = this.cachedChildren.flatMap(entry => entry.lines)
      this.linesDirty = false
    }
    this.dirtyFrom = this.children.length
    return this.cachedLines
  }

  /** Route an absolute rendered row to the child that contributed it. */
  clickAtRow(row: number, width: number): boolean {
    if (row < 0) return false
    this.render(width)
    let offset = 0
    for (const { component: child, lines } of this.cachedChildren) {
      const height = lines.length
      if (row < offset + height) {
        const handled = clickable(child) && child.clickTranscriptRow(row - offset, width)
        if (handled) this.markDirty(child)
        return handled
      }
      offset += height
    }
    return false
  }
}
