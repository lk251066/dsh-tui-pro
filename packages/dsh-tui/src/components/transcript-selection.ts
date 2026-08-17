/**
 * ANSI-aware transcript selection helpers used by the fixed workbench.
 * @module @lk251066/dsh-tui/components/transcript-selection
 */

import { sliceByColumn, visibleWidth } from '@earendil-works/pi-tui'
import type { Palette } from './theme.ts'

const ESCAPE = String.fromCodePoint(27)
const BELL = String.fromCodePoint(7)
const ANSI_SEQUENCE = new RegExp(
  `${ESCAPE}(?:\\[[0-?]*[ -/]*[@-~]|\\][^${BELL}]*(?:${BELL}|${ESCAPE}\\\\)|_[^${BELL}]*(?:${BELL}|${ESCAPE}\\\\))`,
  'gu',
)

/** One transcript position measured in terminal cells. */
export interface SelectionPoint {
  readonly line: number
  readonly column: number
}

/** A selection with an anchor and the current drag head. */
export interface TranscriptSelection {
  readonly anchor: SelectionPoint
  readonly focus: SelectionPoint
}

/** Remove terminal control sequences while preserving visible text. */
export function stripTerminalControls(value: string): string {
  return value.replace(ANSI_SEQUENCE, '')
}

/** Convert a rendered row to its copyable, non-padded text. */
export function plainTranscriptLine(value: string): string {
  return stripTerminalControls(value).replaceAll('\t', '   ')
}

function comparePoints(left: SelectionPoint, right: SelectionPoint): number {
  return left.line - right.line || left.column - right.column
}

function snapColumn(value: string, column: number, edge: 'start' | 'end'): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  let offset = 0
  for (const { segment } of segmenter.segment(value)) {
    const width = visibleWidth(segment)
    if (column <= offset) return offset
    if (column < offset + width) return edge === 'start' ? offset : offset + width
    offset += width
  }
  return offset
}

/** Order the two drag endpoints from oldest/leftmost to newest/rightmost. */
export function orderedSelection(selection: TranscriptSelection): {
  readonly start: SelectionPoint
  readonly end: SelectionPoint
} {
  return comparePoints(selection.anchor, selection.focus) <= 0
    ? { start: selection.anchor, end: selection.focus }
    : { start: selection.focus, end: selection.anchor }
}

/** Whether a selection contains at least one cell. */
export function hasSelectedCells(selection: TranscriptSelection): boolean {
  const { start, end } = orderedSelection(selection)
  return comparePoints(start, end) < 0
}

/**
 * Extract the selected rows from rendered transcript lines.
 * @param lines - Unpadded rendered transcript rows.
 * @param selection - Selection endpoints in absolute transcript-row coordinates.
 * @returns Plain text without ANSI controls or layout padding.
 */
export function selectedTranscriptText(
  lines: readonly string[],
  selection: TranscriptSelection,
): string {
  if (!hasSelectedCells(selection)) return ''
  const { start, end } = orderedSelection(selection)
  const result: string[] = []
  for (let line = start.line; line <= end.line; line++) {
    const source = plainTranscriptLine(lines[line] ?? '')
    const width = visibleWidth(source)
    const from = line === start.line ? snapColumn(source, Math.min(start.column, width), 'start') : 0
    const to = line === end.line ? snapColumn(source, Math.min(end.column, width), 'end') : width
    const length = Math.max(0, to - from)
    result.push(sliceByColumn(source, from, length, true).replace(/\s+$/u, ''))
  }
  return result.join('\n')
}

function selectedAnsi(value: string, palette: Palette): string {
  let result = ''
  let cursor = 0
  for (const match of value.matchAll(ANSI_SEQUENCE)) {
    const index = match.index ?? 0
    result += palette.selected(value.slice(cursor, index))
    result += match[0]
    cursor = index + match[0].length
  }
  return result + palette.selected(value.slice(cursor))
}

/** Apply reverse video to one selected range while preserving inner colors. */
export function highlightTranscriptLine(
  line: string,
  lineIndex: number,
  selection: TranscriptSelection | undefined,
  palette: Palette,
): string {
  if (selection === undefined) return line
  const { start, end } = orderedSelection(selection)
  if (lineIndex < start.line || lineIndex > end.line) return line
  const plain = plainTranscriptLine(line)
  const width = visibleWidth(plain)
  const from = lineIndex === start.line ? snapColumn(plain, Math.min(start.column, width), 'start') : 0
  const to = lineIndex === end.line ? snapColumn(plain, Math.min(end.column, width), 'end') : width
  if (to <= from) return line
  const before = sliceByColumn(line, 0, from, true)
  const selected = sliceByColumn(line, from, to - from, true)
  const after = sliceByColumn(line, to, Math.max(0, width - to), true)
  return `${before}${selectedAnsi(selected, palette)}${after}`
}
