/**
 * Current-session rewind picker shown after a double Escape press.
 * @module @lk251066/dsh-tui/components/rewind-dialog
 */

import {
  Key,
  SelectList,
  matchesKey,
  type Component,
  type SelectItem,
} from '@earendil-works/pi-tui'
import { displayInlineText } from './text.ts'
import { dialogSelectTheme, type Palette } from './theme.ts'
import { renderBottomInteraction } from './dialogs.ts'

/** One completed user turn that can seed a conversation branch. */
export interface RewindPoint {
  /** Turn number from the durable session log. */
  readonly turn: number
  /** Exclusive event index immediately before this turn starts. */
  readonly cut: number
  /** Original user text restored into the editor after branching. */
  readonly prompt: string
}

/** Keyboard picker for branching the conversation before an earlier user turn. */
export class RewindDialog implements Component {
  private readonly list: SelectList
  private readonly points = new Map<string, RewindPoint>()

  constructor(
    points: readonly RewindPoint[],
    maxVisible: number,
    private readonly palette: Palette,
    private readonly choose: (point: RewindPoint) => void,
    private readonly cancel: () => void,
  ) {
    const items: SelectItem[] = points.map((point, index) => {
      const value = String(index)
      this.points.set(value, point)
      return {
        value,
        label: displayInlineText(point.prompt === '' ? '(non-text message)' : point.prompt),
        description: `turn ${point.turn}`,
      }
    })
    this.list = new SelectList(items, Math.max(1, Math.min(maxVisible, items.length)), dialogSelectTheme(palette))
    this.list.onSelect = (item) => {
      const point = this.points.get(item.value)
      if (point !== undefined) this.choose(point)
    }
    this.list.onCancel = cancel
  }

  invalidate(): void {
    this.list.invalidate()
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.ctrl('c')) || matchesKey(data, 'q')) {
      this.cancel()
    } else if (matchesKey(data, Key.escape) || matchesKey(data, Key.left)) {
      // Points are newest-first, so moving down selects an older checkpoint.
      this.list.handleInput('\u001b[B')
    } else if (matchesKey(data, Key.right)) {
      this.list.handleInput('\u001b[A')
    } else {
      this.list.handleInput(data)
    }
    this.invalidate()
  }

  render(width: number): string[] {
    const innerWidth = Math.max(1, width - 4)
    return renderBottomInteraction('Rewind conversation', [
      this.palette.dim('Choose a user message. A new branch keeps the original session unchanged.'),
      '',
      ...this.list.render(innerWidth),
      '',
      this.palette.dim('Esc/← older • → newer • Enter branch and edit • Ctrl+C close'),
    ], width, this.palette)
  }
}
