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
  /** Route an absolute rendered row to the child that contributed it. */
  clickAtRow(row: number, width: number): boolean {
    if (row < 0) return false
    let offset = 0
    for (const child of this.children) {
      const height = child.render(width).length
      if (row < offset + height) {
        return clickable(child) && child.clickTranscriptRow(row - offset, width)
      }
      offset += height
    }
    return false
  }
}
