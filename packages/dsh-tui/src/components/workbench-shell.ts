/**
 * Fixed terminal workbench with an internally scrolling transcript and persistent sidebar.
 * @module @lk251066/dsh-tui/components/workbench-shell
 */

import {
  visibleWidth,
  type Component,
} from '@earendil-works/pi-tui'
import type { Palette } from './theme.ts'
import type { TerminalMouseEvent } from '../full-screen-terminal.ts'
import {
  highlightTranscriptLine,
  selectedTranscriptText,
  type SelectionPoint,
  type TranscriptSelection,
} from './transcript-selection.ts'
import type { TranscriptContainer } from './transcript-container.ts'
import { padToWidth } from './text.ts'

const DEFAULT_SIDEBAR_WIDTH = 32
const MIN_SIDEBAR_WIDTH = 24
const MIN_MAIN_WIDTH = 40

/** User-configurable sizing for the persistent workspace sidebar. */
export interface WorkbenchShellOptions {
  /** Current terminal height in rows. */
  readonly terminalRows: () => number
  /** Preferred sidebar width before the main-column minimum forces it smaller. */
  readonly preferredSidebarWidth?: number
  /** Header rendered above the active transcript. */
  readonly header: Component
  /** Session-owned rows rendered above the fixed input or dialog area. */
  readonly auxiliary: Component
  /** Active main-area browser; when non-empty it replaces chat chrome and transcript. */
  readonly main: Component
  /** Active inline dialog; when non-empty it replaces the editor area. */
  readonly dialog: Component
  /** Working state, editor, prompt context, and notices fixed to the bottom. */
  readonly input: Component
  /** Persistent workspace, session, and status sidebar. */
  readonly sidebar: Component
  /** Resolve a zero-based sidebar row to an active session id. */
  readonly sidebarSessionAt?: (row: number, width: number) => string | undefined
  /** Initially active session transcript. */
  readonly transcript: Component
}

interface ColumnWidths {
  readonly main: number
  readonly sidebar: number
}

interface MainSections {
  readonly header: string[]
  readonly auxiliary: string[]
  readonly bottomGap: string[]
  readonly input: string[]
  readonly transcriptRows: number
}

interface TranscriptViewportState {
  offset: number
  unseenRows: number
  lastLineCount: number
  lastWidth: number
}

/** Result of passing one mouse event through the fixed workbench. */
export interface WorkbenchMouseResult {
  readonly consumed: boolean
  readonly copiedText?: string
  readonly sessionId?: string
}

function frameLine(width: number, left: string, fill: string, right: string): string {
  if (width <= 0) return ''
  if (width === 1) return fill
  return `${left}${fill.repeat(width - 2)}${right}`
}

/** Owns the full terminal viewport and swaps only the active transcript. */
export class WorkbenchShellComponent implements Component {
  private transcript: Component
  private readonly preferredSidebarWidth: number
  private readonly transcriptStates = new Map<Component, TranscriptViewportState>()
  private selection: TranscriptSelection | undefined
  private selectionOrigin: SelectionPoint | undefined
  private selectionDragging = false

  constructor(
    private readonly palette: Palette,
    private readonly options: WorkbenchShellOptions,
  ) {
    this.transcript = options.transcript
    this.preferredSidebarWidth = Math.max(
      MIN_SIDEBAR_WIDTH,
      Math.floor(options.preferredSidebarWidth ?? DEFAULT_SIDEBAR_WIDTH),
    )
  }

  /** Replace the active session transcript without remounting shared chrome. */
  setTranscript(component: Component): void {
    this.transcript = component
    this.clearSelection()
  }

  /** Clear the current transcript selection. */
  clearSelection(): void {
    this.selection = undefined
    this.selectionOrigin = undefined
    this.selectionDragging = false
  }

  /**
   * Route a structured mouse event to transcript selection and scrolling.
   * @param event - Decoded terminal mouse input.
   * @param width - Full terminal width.
   * @returns Whether the workbench consumed the event and completed a copy.
   */
  handleMouse(event: TerminalMouseEvent, width: number): WorkbenchMouseResult {
    if (event.kind === 'wheel') {
      this.scrollByRows(width, event.wheelRows)
      return { consumed: true }
    }
    const hit = this.transcriptPoint(width, event.column, event.row)
    if (event.kind === 'press') {
      if (event.button !== 'left') return { consumed: false }
      const sessionId = this.sidebarSession(event.column, event.row, width)
      if (sessionId !== undefined) {
        this.clearSelection()
        return { consumed: true, sessionId }
      }
      if (hit === undefined) return { consumed: false }
      this.selection = { anchor: hit, focus: hit }
      this.selectionOrigin = hit
      this.selectionDragging = false
      return { consumed: true }
    }
    if (this.selection === undefined) return { consumed: false }
    if (event.kind === 'move') {
      const point = hit ?? this.clampTranscriptPoint(width, event.column, event.row)
      if (point === undefined) return { consumed: true }
      const origin = this.selectionOrigin ?? this.selection.anchor
      if (point.line !== origin.line || point.column !== origin.column) {
        this.selectionDragging = true
      }
      if (this.selectionDragging) this.selection = this.inclusiveMouseSelection(origin, point, width)
      if (event.row <= this.transcriptRowStart(width)) this.scrollByRows(width, 1)
      else if (event.row >= this.transcriptRowEnd(width)) this.scrollByRows(width, -1)
      return { consumed: true }
    }
    if (event.kind === 'release') {
      if (!this.selectionDragging) {
        const clickedLine = this.selection.anchor.line
        this.clearSelection()
        const transcript = this.transcript as Partial<TranscriptContainer>
        transcript.clickAtRow?.(clickedLine, this.mainWidth(width))
        return { consumed: true }
      }
      const lines = this.transcript.render(this.mainWidth(width))
      const copiedText = this.selection === undefined ? '' : selectedTranscriptText(lines, this.selection)
      this.selectionDragging = false
      return { consumed: true, ...(copiedText === '' ? {} : { copiedText }) }
    }
    return { consumed: true }
  }

  /** Width available to the main work area for the supplied terminal width. */
  mainWidth(width: number): number {
    return this.columnWidths(Math.max(0, width - 2)).main
  }

  /** Rows consumed by the fixed input area at the current main width. */
  inputRows(width: number): number {
    return this.options.input.render(this.mainWidth(width)).length
  }

  /** Move the active transcript one viewport toward older rows. */
  scrollPageUp(width: number): void {
    const metrics = this.transcriptMetrics(width)
    this.scrollRows(metrics, Math.max(1, metrics.rows))
  }

  /** Move the active transcript one viewport toward its live tail. */
  scrollPageDown(width: number): void {
    const metrics = this.transcriptMetrics(width)
    this.scrollRows(metrics, -Math.max(1, metrics.rows))
  }

  /** Move the active transcript by a row count; positive values reveal older rows. */
  scrollByRows(width: number, rows: number): void {
    this.scrollRows(this.transcriptMetrics(width), Math.trunc(rows))
  }

  /** Resume following the active transcript's newest row. */
  scrollToBottom(): void {
    const state = this.transcriptState()
    state.offset = 0
    state.unseenRows = 0
  }

  /** Whether the active transcript follows newly appended rows. */
  isFollowingTranscript(): boolean {
    return this.transcriptState().offset === 0
  }

  invalidate(): void {
    this.options.header.invalidate()
    this.transcript.invalidate()
    this.options.auxiliary.invalidate()
    this.options.main.invalidate()
    this.options.dialog.invalidate()
    this.options.input.invalidate()
    this.options.sidebar.invalidate()
  }

  render(width: number): string[] {
    const height = Math.max(0, Math.floor(this.options.terminalRows()))
    if (width <= 0 || height === 0) return []

    const top = this.palette.dim(frameLine(width, '┌', '─', '┐'))
    if (height === 1) return [top]
    const bottom = this.palette.dim(frameLine(width, '└', '─', '┘'))
    if (height === 2) return [top, bottom]

    const innerWidth = Math.max(0, width - 2)
    const innerHeight = height - 2
    const leftBorder = this.palette.dim('│')
    const rightBorder = this.palette.dim('│')
    if (innerWidth === 0) {
      return [top, ...Array.from({ length: innerHeight }, () => `${leftBorder}${rightBorder}`), bottom]
    }

    const widths = this.columnWidths(innerWidth)
    if (widths.sidebar === 0) {
      const mainLines = this.renderMain(widths.main, innerHeight)
      const content = Array.from(
        { length: innerHeight },
        (_, index) => `${leftBorder}${padToWidth(mainLines[index] ?? '', widths.main)}${rightBorder}`,
      )
      return [top, ...content, bottom]
    }

    const mainLines = this.renderMain(widths.main, innerHeight)
    const rawSidebarLines = this.options.sidebar.render(widths.sidebar)
    const sidebarLines = rawSidebarLines.slice(0, innerHeight)
    const separator = this.palette.dim('│')

    const content = Array.from({ length: innerHeight }, (_, index) => {
      const main = padToWidth(mainLines[index] ?? '', widths.main)
      const sidebar = padToWidth(sidebarLines[index] ?? '', widths.sidebar)
      return `${leftBorder}${main}${separator}${sidebar}${rightBorder}`
    })
    return [top, ...content, bottom]
  }

  private columnWidths(width: number): ColumnWidths {
    if (width < MIN_MAIN_WIDTH + MIN_SIDEBAR_WIDTH + 1) return { main: width, sidebar: 0 }
    const sidebar = Math.min(
      this.preferredSidebarWidth,
      width - MIN_MAIN_WIDTH - 1,
    )
    return { main: Math.max(1, width - sidebar - 1), sidebar }
  }

  private renderMain(width: number, height: number): string[] {
    const browser = this.options.main.render(width)
    if (browser.length > 0) {
      const visible = browser.slice(0, height)
      while (visible.length < height) visible.push('')
      return visible
    }
    const sections = this.mainSections(width, height)
    const transcript = this.renderTranscript(width, sections.transcriptRows)

    return [
      ...sections.header,
      ...transcript,
      ...sections.bottomGap,
      ...sections.auxiliary,
      ...sections.input,
    ]
  }

  private mainSections(width: number, height: number): MainSections {
    const dialog = this.options.dialog.render(width)
    const rawInput = dialog.length > 0 ? dialog : this.options.input.render(width)
    const input = rawInput.slice(Math.max(0, rawInput.length - height))
    const afterInput = Math.max(0, height - input.length)
    const rawAuxiliary = this.options.auxiliary.render(width)
    const auxiliary = rawAuxiliary.slice(Math.max(0, rawAuxiliary.length - afterInput))
    const roomBeforeBottom = Math.max(0, height - input.length - auxiliary.length)
    const bottomGap = roomBeforeBottom > 0 ? [''] : []
    const afterBottom = Math.max(0, roomBeforeBottom - bottomGap.length)
    const rawHeader = [...this.options.header.render(width), '']
    const header = rawHeader.slice(0, afterBottom)
    return {
      header,
      auxiliary,
      bottomGap,
      input,
      transcriptRows: Math.max(0, height - header.length - bottomGap.length - auxiliary.length - input.length),
    }
  }

  private transcriptState(): TranscriptViewportState {
    let state = this.transcriptStates.get(this.transcript)
    if (state === undefined) {
      state = { offset: 0, unseenRows: 0, lastLineCount: 0, lastWidth: 0 }
      this.transcriptStates.set(this.transcript, state)
    }
    return state
  }

  private transcriptMetrics(width: number): {
    readonly state: TranscriptViewportState
    readonly rows: number
    readonly maxOffset: number
  } {
    const height = Math.max(0, Math.floor(this.options.terminalRows()) - 2)
    const rows = this.mainSections(this.mainWidth(width), height).transcriptRows
    const transcriptWidth = this.mainWidth(width)
    const lineCount = this.transcript.render(transcriptWidth).length
    const state = this.transcriptState()
    state.lastLineCount = lineCount
    state.lastWidth = transcriptWidth
    return {
      state,
      rows,
      maxOffset: Math.max(0, lineCount - rows),
    }
  }

  private scrollRows(
    metrics: { readonly state: TranscriptViewportState; readonly maxOffset: number },
    rows: number,
  ): void {
    metrics.state.offset = Math.min(metrics.maxOffset, Math.max(0, metrics.state.offset + rows))
    if (metrics.state.offset === 0) metrics.state.unseenRows = 0
  }

  private renderTranscript(width: number, rows: number): string[] {
    if (rows <= 0) return []
    const lines = this.transcript.render(width)
    const state = this.transcriptState()
    if (state.lastWidth !== 0 && state.lastWidth !== width && this.selection !== undefined) {
      this.clearSelection()
    }
    if (state.lastWidth === width && state.offset > 0 && lines.length > state.lastLineCount) {
      const appended = lines.length - state.lastLineCount
      state.offset += appended
      state.unseenRows += appended
    }
    const maxOffset = Math.max(0, lines.length - rows)
    state.offset = Math.min(state.offset, maxOffset)
    if (state.offset === 0) state.unseenRows = 0
    const start = Math.max(0, lines.length - rows - state.offset)
    const visible = lines.slice(start, start + rows)
      .map((line, index) => highlightTranscriptLine(line, start + index, this.selection, this.palette))
    while (visible.length < rows) visible.push('')
    if (state.unseenRows > 0 && visible.length > 0) {
      visible[visible.length - 1] = this.palette.dim(`↓ ${state.unseenRows} new`)
    }
    state.lastLineCount = lines.length
    state.lastWidth = width
    return visible
  }

  private transcriptRowStart(width: number): number {
    const height = Math.max(0, Math.floor(this.options.terminalRows()) - 2)
    return 2 + this.mainSections(this.mainWidth(width), height).header.length
  }

  private transcriptRowEnd(width: number): number {
    const height = Math.max(0, Math.floor(this.options.terminalRows()) - 2)
    const sections = this.mainSections(this.mainWidth(width), height)
    return this.transcriptRowStart(width) + sections.transcriptRows - 1
  }

  private transcriptPoint(width: number, column: number, row: number): SelectionPoint | undefined {
    const height = Math.max(0, Math.floor(this.options.terminalRows()) - 2)
    const mainWidth = this.mainWidth(width)
    const sections = this.mainSections(mainWidth, height)
    if (sections.transcriptRows <= 0) return undefined
    if (column < 2 || column > 1 + mainWidth) return undefined
    const startRow = 2 + sections.header.length
    const endRow = startRow + sections.transcriptRows - 1
    if (row < startRow || row > endRow) return undefined
    const lines = this.transcript.render(mainWidth)
    if (lines.length === 0) return undefined
    const state = this.transcriptState()
    const start = Math.max(0, lines.length - sections.transcriptRows - state.offset)
    const line = Math.min(lines.length - 1, Math.max(0, start + row - startRow))
    return {
      line,
      column: Math.max(0, Math.min(visibleWidth(lines[line] ?? ''), column - 2)),
    }
  }

  private clampTranscriptPoint(width: number, column: number, row: number): SelectionPoint | undefined {
    const height = Math.max(0, Math.floor(this.options.terminalRows()) - 2)
    const sections = this.mainSections(this.mainWidth(width), height)
    if (sections.transcriptRows <= 0) return undefined
    const clampedRow = Math.min(
      this.transcriptRowEnd(width),
      Math.max(this.transcriptRowStart(width), row),
    )
    return this.transcriptPoint(width, Math.min(1 + this.mainWidth(width), Math.max(2, column)), clampedRow)
  }

  private inclusiveMouseSelection(
    origin: SelectionPoint,
    focus: SelectionPoint,
    width: number,
  ): TranscriptSelection {
    const order = origin.line - focus.line || origin.column - focus.column
    return order <= 0
      ? { anchor: origin, focus: this.afterTranscriptCell(focus, width) }
      : { anchor: this.afterTranscriptCell(origin, width), focus }
  }

  private afterTranscriptCell(point: SelectionPoint, width: number): SelectionPoint {
    const lines = this.transcript.render(this.mainWidth(width))
    return {
      line: point.line,
      column: Math.min(visibleWidth(lines[point.line] ?? ''), point.column + 1),
    }
  }

  private sidebarSession(column: number, row: number, width: number): string | undefined {
    const innerWidth = Math.max(0, width - 2)
    const widths = this.columnWidths(innerWidth)
    if (widths.sidebar === 0 || this.options.sidebarSessionAt === undefined) return undefined
    const sidebarStart = widths.main + 3
    if (column < sidebarStart || column >= width || row < 2 || row >= this.options.terminalRows()) return undefined
    return this.options.sidebarSessionAt(row - 2, widths.sidebar)
  }
}
