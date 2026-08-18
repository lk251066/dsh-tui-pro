/**
 * The input box chrome: the Claude Code signature rounded frame around the
 * pi-tui editor (`╭─╮ │ … │ ╰─╯`). The editor stays the TUI focus target and
 * keeps rendering its own rows (prompt prefix, fake cursor, autocomplete
 * dropdown); this wrapper only borrows those rows at `width - 4` and re-frames
 * them. The editor's zero-width hardware-cursor marker survives untouched —
 * the TUI locates it by scanning whole rendered lines and measuring the width
 * of the text before it, so the two border columns shift the reported cursor
 * column exactly with the frame.
 *
 * The editor appends its autocomplete dropdown (slash commands, `@` files)
 * after the content rows of the same render — framed naively those rows sit
 * between the side borders and inflate the box with every suggestion. This
 * component splits the dropdown rows off and emits them below the bottom
 * border, unwrapped, so the frame hugs only the input content (Claude Code
 * renders its suggestions below the box the same way).
 * @module @deepseek-ai/dsh-tui/components/framed-editor
 */

import { CURSOR_MARKER, type Component } from '@earendil-works/pi-tui'
import type { Editor } from '@earendil-works/pi-tui'
import { padToWidth } from './text.ts'

/** Below this width the frame's borders crowd out the text: render unframed. */
const MIN_FRAMED_WIDTH = 12
/** Left (`│ `) plus right (` │`) frame columns. */
const FRAME_COLUMNS = 4
/** Columns the frame indents in-frame text by (`│ `): reapplied on moved-out rows. */
const FRAME_LEFT_INSET = FRAME_COLUMNS / 2
/**
 * Reverse-video SGR the Editor hardcodes for its fake cursor (editor.js
 * renders `\x1b[7m…\x1b[0m` on exactly the cursor row, focused or not). The
 * editor's dropdown theme (`selectTheme`) never uses reverse video.
 */
const FAKE_CURSOR = '\x1b[7m'
/** One ANSI CSI sequence (SGR/cursor), OSC string, or APC string (cursor marker). */
const ANSI_SEQUENCE = /\x1b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\)|_[^\x07]*\x07)/g

/**
 * Live autocomplete fields the Editor keeps TS-private (no `#` — plain
 * properties on every 0.80 instance) but rewrites before each dropdown render.
 */
interface EditorAutocompleteInternals {
  /** Select list rendered as the dropdown; `undefined` once it closes. */
  readonly autocompleteList?: { render(width: number): string[] } | undefined
  /** Visible width of the prompt prefixes; prefixes every dropdown row. */
  readonly promptWidth?: number
}

/** Drop ANSI escape sequences so leading-space structure can be measured. */
function stripAnsi(line: string): string {
  return line.replace(ANSI_SEQUENCE, '')
}

/**
 * A rounded-corner frame around the input editor, drawn in the editor's own
 * border tone (dim by default; the host's border policy flags only plan mode
 * in accent and the danger permission preset in warning). Pure delegation:
 * focus, input handling, and the hardware cursor all keep belonging to the
 * wrapped editor.
 */
export class FramedEditorComponent implements Component {
  constructor(private readonly editor: Editor) {}

  invalidate(): void {
    this.editor.invalidate()
  }

  render(width: number): string[] {
    if (width < MIN_FRAMED_WIDTH) return this.editor.render(width)
    const border = this.editor.borderColor
    const innerWidth = width - FRAME_COLUMNS
    const horizontal = '─'.repeat(width - 2)
    const rows = this.editor.render(innerWidth)
    const dropdown = this.extractDropdownRows(rows, innerWidth)
    return [
      border(`╭${horizontal}╮`),
      ...rows.map(row => `${border('│')} ${padToWidth(row, innerWidth)} ${border('│')}`),
      border(`╰${horizontal}╯`),
      ...dropdown,
    ]
  }

  /**
   * Pop the autocomplete dropdown's rows off the tail of `rows` so the frame
   * wraps content only; returns them ready to render below the frame.
   *
   * Recognition rule (verified against @earendil-works/pi-tui 0.80 editor.js):
   * - `Editor.render` emits content rows first, then — only while
   *   `isShowingAutocomplete()` holds — exactly `autocompleteList.render(
   *   inputWidth).length` dropdown rows, each
   *   `${leftPadding}${' '.repeat(promptWidth)}${item}…`. A trailing-count
   *   walk on row shape alone cannot work: continuation content rows carry
   *   the same all-space prefix (`prompt.continuation` is blank in our
   *   config), so with the cursor scrolled up the shape walk would swallow
   *   half the content (repro: 11-line input, cursor on line 0, `/` + Tab).
   * - So the count comes from re-rendering the live `autocompleteList` (its
   *   row count is width-invariant and the render is side-effect free) and is
   *   then validated against the known dropdown shape: every popped row opens
   *   with at least `paddingX + 1` spaces after ANSI stripping and carries
   *   neither the hardware-cursor marker nor the reverse-video fake cursor
   *   that mark the cursor content row.
   *
   * Conservative by construction: without the editor's autocomplete signal,
   * without the internals the count needs, when the count would swallow every
   * row, or when any popped row fails shape validation, the dropdown stays
   * inside the frame exactly as before.
   */
  private extractDropdownRows(rows: string[], innerWidth: number): string[] {
    const internals = this.editor as unknown as EditorAutocompleteInternals
    const list = this.editor.isShowingAutocomplete() ? internals.autocompleteList : undefined
    const promptWidth = internals.promptWidth
    if (list === undefined || promptWidth === undefined) return []
    // Mirror editor.js's width arithmetic for the list render; only the row
    // count (width-invariant) is used.
    const maxPadding = Math.max(0, Math.floor((innerWidth - 1) / 2))
    const paddingX = Math.min(this.editor.getPaddingX(), maxPadding)
    const inputWidth = Math.max(1, Math.max(1, innerWidth - paddingX * 2) - promptWidth)
    const count = list.render(inputWidth).length
    if (count === 0 || count >= rows.length) return []
    const candidates = rows.slice(rows.length - count)
    if (candidates.some(row => !this.looksLikeDropdownRow(row, paddingX))) return []
    const dropdown = rows.splice(rows.length - count)
    // Keep the suggestions aligned under the text they complete: in-frame rows
    // start after `│ `, so moved-out rows repeat that inset outside the frame.
    const inset = ' '.repeat(FRAME_LEFT_INSET)
    return dropdown.map(row => `${inset}${row}`)
  }

  /** Whether a rendered row has the dropdown's leading-space, cursor-free shape. */
  private looksLikeDropdownRow(row: string, paddingX: number): boolean {
    if (row.includes(CURSOR_MARKER) || row.includes(FAKE_CURSOR)) return false
    const leadingSpaces = /^ */.exec(stripAnsi(row))?.[0].length ?? 0
    return leadingSpaces >= paddingX + 1
  }
}
