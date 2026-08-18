/**
 * pi-tui transcript components: the startup banner, user/assistant messages,
 * the streaming assistant buffer, tool cards, and the todo panel. Each is a
 * pure function of its inputs and the active palette.
 * @module @deepseek-ai/dsh-tui/components/transcript
 */

import {
  Container,
  Image,
  Markdown,
  Spacer,
  Text,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
  type Component,
  type MarkdownTheme,
} from '@earendil-works/pi-tui'
import { diffLines as compareLines, diffWordsWithSpace as compareWords } from 'diff'
import type { ContentBlock, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { JsonValue, SessionEvent, TodoItem } from '@deepseek-ai/dsh-session'
import type {
  TerminalCallView,
  ToolCallView,
  ToolDefinition,
  ToolResultView,
} from '@deepseek-ai/dsh-tools'
import type { FileDiff } from '@deepseek-ai/dsh-tools'
import { preview, renderUnknownXml } from './xml-tool-output.ts'
import { displayInlineText, displayText, padToWidth } from './text.ts'
import { gradientText, type Palette } from './theme.ts'
import {
  fullLogoRows,
  logoFullWidth,
  paintLogoRow,
} from './logo.ts'
import { contentText, type ParsedArguments } from './content.ts'
import {
  RESULT_CONTINUATION,
  RESULT_MARKER,
  shortcutHint,
  THINKING_GLYPH,
  TOOL_SETTLED,
} from './figures.ts'
import { progressiveTitle, settledTitle } from '../chat/tool-verbs.ts'
import {
  formatClockTime,
  formatStatusDuration,
  type StepPosition,
} from '../chat/timing.ts'
import { stripTerminalControls } from './transcript-selection.ts'

/** Complete durable reference for one image content block. */
type ImageAttachmentRef = Extract<ContentBlock, { type: 'image' }>['attachment']

/** Concatenate the text of every block of one type, separated by blank lines. */
function textBlocks(content: readonly ContentBlock[], type: 'text' | 'reasoning'): string {
  return content
    .filter((block): block is Extract<ContentBlock, { type: typeof type }> => block.type === type)
    .map(block => block.text)
    .join('\n\n')
}

/** Render a value as terminal-safe text: strings escaped, other values as pretty JSON. */
function pretty(value: unknown): string {
  if (typeof value === 'string') return displayText(value)
  // JSON.stringify is typed to return string but yields undefined for e.g. symbols.
  const serialized = JSON.stringify(value, null, 2) as string | undefined
  return displayText(serialized ?? String(value))
}

interface RenderedDiff {
  lines: string[]
  added: number
  removed: number
  approximate: boolean
}

/** Context rows kept at each edge of a long unchanged run before its middle folds. */
export const DIFF_CONTEXT_LINES = 3

/** Total diff rows one file may render before the middle folds away. */
export const DIFF_MAX_RENDER_LINES = 60

/** pi-tui's code-fence hook shape, which {@link renderDiff} reuses for diff rows. */
export type DiffHighlight = (code: string, lang?: string) => string[]

/**
 * One diff body row before styling: which side it belongs to, its line number
 * on that side (the new side for context rows — one gutter column, Claude
 * Code's convention), and its content, display-escaped and carrying syntax SGR
 * when the highlighter applied.
 */
interface DiffRow {
  readonly kind: 'added' | 'removed' | 'context' | 'fold'
  /** The row's line number; `0` for fold rows, which carry none. */
  readonly line: number
  /** Display-escaped content (for fold rows, the fold note itself). */
  readonly content: string
  /** Whether `content` carries syntax-highlight SGR rather than plain text. */
  readonly highlighted: boolean
  /**
   * Word-level fragments from pairing this row against its counterpart on the
   * other side; set only on unhighlighted added/removed rows with shared words.
   */
  readonly segments?: readonly DiffSegment[]
}

/** One word-level fragment of a paired changed row: its text and whether it changed. */
interface DiffSegment {
  readonly text: string
  readonly changed: boolean
}

/**
 * A side's content lines under the terminator rule the Web DiffBlock also
 * applies: empty text is zero lines, a trailing newline terminates the last
 * line, and an interior blank line survives.
 */
function diffContentLines(text: string): string[] {
  if (text === '') return []
  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  return body.split('\n')
}

/**
 * The highlight language for a diff path: its lowercased extension, when the
 * final path segment carries one. The highlighter itself passes unknown
 * languages through, so no alias table is needed here.
 */
function diffLanguage(path: string): string | undefined {
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  const dot = path.slice(slash + 1).lastIndexOf('.')
  if (dot < 1) return undefined
  const extension = path.slice(slash + dot + 2).toLowerCase()
  return extension === '' ? undefined : extension
}

/**
 * Syntax-highlight one change block's rows through the injected hook. The
 * highlighter's own gating (color off, unknown language, module not yet
 * loaded, oversized input) returns the rows unchanged, which callers detect
 * row by row to fall back to the plain single-color rendering; a row-count
 * mismatch (a defensive invariant — the hook splits the same text it is
 * given) is treated the same way.
 */
function highlightRows(
  plain: readonly string[],
  language: string | undefined,
  highlight: DiffHighlight | undefined,
): readonly string[] | undefined {
  if (highlight === undefined || language === undefined) return undefined
  const highlighted = highlight(plain.join('\n'), language)
  return highlighted.length === plain.length ? highlighted : undefined
}

/**
 * Fold oversized diff rows: the middle of any unchanged run longer than
 * {@link DIFF_CONTEXT_LINES} on both sides collapses to one dim note (added
 * and removed rows are never dropped by this pass), and a diff still longer
 * than {@link DIFF_MAX_RENDER_LINES} keeps head and tail halves with the
 * middle collapsed the same way.
 */
function foldDiffRows(rows: readonly DiffRow[]): DiffRow[] {
  const collapsed: DiffRow[] = []
  let run: DiffRow[] = []
  const flushRun = (): void => {
    if (run.length > 2 * DIFF_CONTEXT_LINES) {
      collapsed.push(...run.slice(0, DIFF_CONTEXT_LINES))
      collapsed.push({
        kind: 'fold',
        line: 0,
        content: `⋯ ${run.length - 2 * DIFF_CONTEXT_LINES} unchanged lines`,
        highlighted: false,
      })
      collapsed.push(...run.slice(-DIFF_CONTEXT_LINES))
    } else {
      collapsed.push(...run)
    }
    run = []
  }
  for (const row of rows) {
    if (row.kind === 'context') run.push(row)
    else {
      flushRun()
      collapsed.push(row)
    }
  }
  flushRun()
  if (collapsed.length <= DIFF_MAX_RENDER_LINES) return collapsed
  const keep = Math.floor(DIFF_MAX_RENDER_LINES / 2)
  return [
    ...collapsed.slice(0, keep),
    { kind: 'fold', line: 0, content: `⋯ ${collapsed.length - 2 * keep} lines`, highlighted: false },
    ...collapsed.slice(-keep),
  ]
}

/**
 * Word-diff the paired rows of an exact line diff: each adjacent removed run
 * and the added run that follows it pair index-aligned (the classic
 * pairing), and the words that actually changed become emphasized segments
 * while shared words keep the line color. Highlighted rows (syntax SGR
 * already interleaved) and fully replaced pairs (no shared word) keep the
 * plain single-color rendering; the approximate whole-side fallback never
 * reaches this pass.
 */
function applyWordDiff(rows: readonly DiffRow[]): DiffRow[] {
  const result = [...rows]
  let index = 0
  while (index < result.length) {
    if (result[index]?.kind !== 'removed') {
      index += 1
      continue
    }
    const removedStart = index
    while (result[index + 1]?.kind === 'removed') index += 1
    const removedRun = result.slice(removedStart, index + 1)
    const addedStart = index + 1
    while (result[index + 1]?.kind === 'added') index += 1
    const addedRun = result.slice(addedStart, index + 1)
    for (let pair = 0; pair < Math.min(removedRun.length, addedRun.length); pair += 1) {
      const removed = removedRun[pair] as DiffRow
      const added = addedRun[pair] as DiffRow
      if (removed.highlighted || added.highlighted) continue
      const parts = compareWords(removed.content, added.content)
      const shared = parts.some(part => part.added !== true && part.removed !== true && part.value.trim() !== '')
      if (!shared) continue
      result[removedStart + pair] = {
        ...removed,
        segments: parts
          .filter(part => part.added !== true)
          .map(part => ({ text: part.value, changed: part.removed === true })),
      }
      result[addedStart + pair] = {
        ...added,
        segments: parts
          .filter(part => part.removed !== true)
          .map(part => ({ text: part.value, changed: part.added === true })),
      }
    }
    index += 1
  }
  return result
}

/**
 * Style folded diff rows for the terminal: a dim, right-aligned line-number
 * gutter sized to the largest rendered line (`max(4, digits + 2)` columns),
 * then the side marker and content. A highlighted row keeps its syntax colors
 * and colors only the marker (SGR has no color stack, so marker and content
 * colors must not nest); a word-paired row keeps the line color on shared
 * words and emphasizes the changed words through the diff word roles; any
 * other plain row keeps the pre-highlighter look of one color across marker
 * and content.
 */
function renderDiffRows(rows: readonly DiffRow[], palette: Palette): string[] {
  const maxLine = rows.reduce((max, row) => Math.max(max, row.line), 0)
  const gutterWidth = Math.max(4, String(maxLine).length + 2)
  return rows.map((row) => {
    if (row.kind === 'fold') {
      return `${' '.repeat(gutterWidth + 2)}${palette.dim(row.content)}`
    }
    const gutter = palette.dim(String(row.line).padStart(gutterWidth))
    if (row.highlighted) {
      const marker = row.kind === 'added' ? palette.success('+') : row.kind === 'removed' ? palette.error('-') : ' '
      return `${gutter}${marker} ${row.content}`
    }
    if (row.segments !== undefined && row.kind !== 'context') {
      // Colored spans concatenate rather than nest (the single-Colored rule):
      // the marker and the shared words take the side's line color, the
      // changed words take its word role.
      const lineRole = row.kind === 'added' ? palette.success : palette.error
      const wordRole = row.kind === 'added' ? palette.diffAddedWord : palette.diffRemovedWord
      const marker = row.kind === 'added' ? '+' : '-'
      const body = row.segments
        .map(segment => segment.changed ? wordRole(segment.text) : lineRole(segment.text))
        .join('')
      return `${gutter}${lineRole(`${marker} `)}${body}`
    }
    const body = row.kind === 'added'
      ? palette.success(`+ ${row.content}`)
      : row.kind === 'removed'
        ? palette.error(`- ${row.content}`)
        : palette.dim(`  ${row.content}`)
    return `${gutter}${body}`
  })
}

/**
 * A file diff rendered as terminal rows in the Claude Code shape: a dim
 * line-number gutter (new-side numbers for added and context rows, old-side
 * for removed), syntax-highlighted row content when a highlighter is
 * available, paired changed rows word-diffed so the changed words emphasize
 * over the line color, long unchanged runs and oversized diffs folded to dim
 * `⋯` notes, and unchanged context that stays neutral and does not affect
 * exact change totals. Comparisons beyond the edit-distance budget fall back
 * to whole-side rendering so a model-authored pending edit cannot stall the
 * TUI.
 */
export function renderDiff(
  diff: FileDiff,
  maxDiffEditLength: number,
  palette: Palette,
  skipPathHeader = false,
  highlight?: DiffHighlight,
): RenderedDiff {
  // The card header names the call (settled verb title); a single-file diff
  // whose title already carries the path skips the body's path header, while a
  // multi-file diff keeps one path header per file.
  const lines = skipPathHeader ? [] : [palette.bold(displayText(diff.path))]
  const language = diffLanguage(diff.path)
  const rows: DiffRow[] = []
  let added = 0
  let removed = 0
  let oldLine = 0
  let newLine = 0
  let approximate = false

  /**
   * Append one change block's lines as rows of `kind`, consuming the side
   * counters as the Web DiffBlock would (removed consumes old, added consumes
   * new, context consumes both and displays its new-side number).
   */
  const push = (value: string, kind: 'added' | 'removed' | 'context'): void => {
    const plain = diffContentLines(displayText(value))
    if (plain.length === 0) return
    const highlighted = highlightRows(plain, language, highlight)
    for (const [index, plainLine] of plain.entries()) {
      const content = highlighted?.[index]
      if (kind === 'removed') oldLine += 1
      else if (kind === 'context') {
        newLine += 1
        oldLine += 1
      } else {
        newLine += 1
      }
      rows.push({
        kind,
        line: kind === 'removed' ? oldLine : newLine,
        content: content ?? plainLine,
        highlighted: content !== undefined && content !== plainLine,
      })
    }
    if (kind === 'added') added += plain.length
    else if (kind === 'removed') removed += plain.length
  }

  if (diff.oldText === null) {
    push(diff.newText, 'added')
  } else {
    const changes = compareLines(diff.oldText, diff.newText, { maxEditLength: maxDiffEditLength })
    if (changes === undefined) {
      approximate = true
      lines.push(palette.dim(`[exact line diff omitted: >${maxDiffEditLength} changed lines]`))
      push(diff.oldText, 'removed')
      push(diff.newText, 'added')
    } else {
      for (const change of changes) {
        push(change.value, change.added ? 'added' : change.removed ? 'removed' : 'context')
      }
    }
  }
  const folded = foldDiffRows(rows)
  return { lines: [...lines, ...renderDiffRows(approximate ? folded : applyWordDiff(folded), palette)], added, removed, approximate }
}

/** One suggested command row inside the welcome box. */
export interface WelcomeSuggestion {
  /** The command as typed, e.g. `/new`. */
  readonly command: string
  /** What it does, in a few words. */
  readonly description: string
}

/**
 * Contents of the welcome box shown before the first user message: the
 * configured welcome line (or the default), the live model and working
 * directory, and a few suggested commands.
 */
export interface WelcomeBoxInfo {
  /** Configured welcome line; `undefined` renders the default. */
  readonly welcome: string | undefined
  /** Current model label. */
  readonly model: string
  /** Formatted working directory. */
  readonly directory: string
  /** Suggested commands, one `command description` row each. */
  readonly suggestions: readonly WelcomeSuggestion[]
}

/** Left (`│ `) plus right (` │`) frame columns of the welcome box. */
const WELCOME_FRAME_COLUMNS = 4

/**
 * The startup header. While the session log is pristine (nothing beyond the
 * opening lifecycle prelude, no title) it renders a codex-style welcome box:
 * a dim rounded frame (the framed editor's `╭─╮│╰─╯`) sized to its content,
 * holding the block-letter logo painted through the brand gradient (or,
 * below logo width, one compact brand line), the welcome line, the live
 * model and directory, suggested commands, and the shortcut tips row. The
 * sweep reveal clips the box left-to-right on startup; the shimmer pass then
 * sweeps the logo inside it.
 *
 */
export class HeaderComponent implements Component {
  /** Columns of the box currently revealed; `undefined` renders it whole. */
  private revealWidth: number | undefined
  /** Left edge of the shimmer window over the logo; `undefined` = off. */
  private shimmerOffset: number | undefined
  /** Full width of the last rendered welcome box (the reveal sweep's target). */
  private boxWidth = 0

  constructor(
    private readonly welcome: () => WelcomeBoxInfo,
    private readonly palette: Palette,
    private readonly gradient: boolean,
  ) {}

  /**
   * Clip the box to `width` columns (the sweep reveal); `undefined` restores it.
   * @param width - Revealed box width in columns, or `undefined` for the whole box.
   */
  setRevealWidth(width: number | undefined): void {
    this.revealWidth = width
  }

  /**
   * Park the shimmer highlight at `offset` columns (or clear it).
   * @param offset - Left edge of the highlight window, or `undefined` to clear.
   */
  setShimmerOffset(offset: number | undefined): void {
    this.shimmerOffset = offset
  }

  /**
   * The welcome box's full width in columns as last rendered (`0` before the
   * first render); the reveal sweep drives its clip to this target.
   * @returns The box width in columns.
   */
  welcomeBoxWidth(): number {
    return this.boxWidth
  }

  invalidate(): void {}

  render(width: number): string[] {
    const usable = Math.max(1, width - 2)
    return this.renderWelcome(usable, this.welcome())
  }

  /**
   * The welcome box: content rows padded to the widest row inside a dim
   * rounded frame, reveal-clipped while the sweep runs. The block logo fits
   * from `logoFullWidth + frame` columns up; below it the box holds the
   * one-line text brand instead.
   */
  private renderWelcome(usable: number, info: WelcomeBoxInfo): string[] {
    const content: string[] = []
    if (usable >= logoFullWidth() + WELCOME_FRAME_COLUMNS) {
      content.push(...fullLogoRows().map(row =>
        paintLogoRow(row, this.palette, this.gradient, this.shimmerOffset),
      ))
    } else {
      const name = this.gradient
        ? this.palette.bold(gradientText('DEEPSEEK'))
        : this.palette.bold(this.palette.accent('DEEPSEEK'))
      content.push(`${name} ${this.palette.bold('HARNESS')}`)
    }
    content.push('')
    content.push(this.palette.dim(displayText(info.welcome ?? DEFAULT_WELCOME)))
    content.push('')
    content.push(`${this.palette.dim('model:')} ${displayText(info.model)}`)
    content.push(`${this.palette.dim('directory:')} ${displayText(info.directory)}`)
    content.push('')
    for (const suggestion of info.suggestions) {
      content.push(`${displayText(suggestion.command)} ${this.palette.dim(suggestion.description)}`)
    }
    content.push('')
    content.push(this.palette.dim(LOGO_TIPS))
    const innerWidth = Math.min(
      Math.max(1, usable - WELCOME_FRAME_COLUMNS),
      Math.max(...content.map(line => visibleWidth(line))),
    )
    this.boxWidth = innerWidth + WELCOME_FRAME_COLUMNS
    const border = (glyph: string): string => this.palette.dim(glyph)
    const horizontal = '─'.repeat(innerWidth + 2)
    const lines = [
      border(`╭${horizontal}╮`),
      ...content.map(line => `${border('│')} ${padToWidth(line, innerWidth)} ${border('│')}`),
      border(`╰${horizontal}╯`),
    ]
    if (this.revealWidth === undefined) {
      return lines.map(line => truncateToWidth(line, usable, ''))
    }
    const revealed = this.revealWidth
    return lines.map(line => truncateToWidth(line, revealed, ''))
  }
}

/** Welcome line under the logo when no title/welcome is configured. */
const DEFAULT_WELCOME = '探索未至之境 — coding agent ready'
/** Shortcut tips row under the welcome line. */
const LOGO_TIPS = '/ commands · @ files · /sessions history · Ctrl+O cards · Shift+Tab mode'

/**
 * One image content block, rendered through pi-tui's `Image` once the
 * attachment bytes land (kitty/iTerm2 protocols; other terminals get the
 * component's own fallback line). Until then a placeholder line shows.
 */
export class ImageBlockComponent extends Container {
  constructor(
    ref: ImageAttachmentRef,
    load: (ref: ImageAttachmentRef) => Promise<Uint8Array | undefined>,
    palette: Palette,
  ) {
    super()
    const attachmentId = String(ref.attachmentId)
    this.addChild(new Text(palette.dim(`[loading image ${displayText(attachmentId)}]`), 0, 0))
    void load(ref).then((data) => {
      this.clear()
      if (data === undefined) {
        this.addChild(new Text(palette.dim(`[image ${displayText(attachmentId)} unavailable]`), 0, 0))
      } else {
        this.addChild(new Image(
          Buffer.from(data).toString('base64'),
          ref.mediaType,
          { fallbackColor: text => palette.dim(text) },
          { maxWidthCells: 40, filename: attachmentId },
        ))
      }
      this.invalidate()
    })
  }

  override invalidate(): void {
    for (const child of this.children) child.invalidate()
  }
}

/**
 * User message body rows: the first visual row carries codex's `› ` prompt
 * marker (bold over dim), continuation rows align under its text column.
 * Wrapping happens here rather than in pi-tui's `Text` so the hanging indent
 * survives soft wraps.
 */
class UserBodyComponent implements Component {
  constructor(private readonly text: string, private readonly palette: Palette) {}

  invalidate(): void {}

  render(width: number): string[] {
    const rows = wrapTextWithAnsi(this.text, Math.max(1, width - 2))
    return rows.map((row, index) => index === 0
      ? `${this.palette.bold(this.palette.dim('›'))} ${row}`
      : `  ${row}`)
  }
}

/**
 * A user or steering prompt rendered as a codex-style bubble: every row (the
 * role header, the body, image blocks) is padded to the component width and
 * filled with the palette's derived `bubble` background, so the user's own
 * messages read as one band apart from the assistant's bare text. The `You`
 * header takes the permission blue (bold, no underline — the underline stays
 * the Assistant header's banding), and a dim `HH:MM` stamp rides the header
 * when the event time is known. Image blocks render inline beneath the text
 * through {@link ImageBlockComponent}.
 */
export class UserMessageComponent extends Container {
  constructor(
    text: string,
    private readonly palette: Palette,
    images: readonly ImageAttachmentRef[] = [],
    loadImage?: (ref: ImageAttachmentRef) => Promise<Uint8Array | undefined>,
    /** Wall-clock time of the `user/message` event, for the header stamp. */
    at?: number,
  ) {
    super()
    const stamp = at === undefined ? '' : ` ${palette.dim(formatClockTime(at))}`
    this.addChild(new Text(palette.bold(palette.permission('You')) + stamp, 0, 0))
    if (text !== '') this.addChild(new UserBodyComponent(displayText(text), palette))
    const loader: (ref: ImageAttachmentRef) => Promise<Uint8Array | undefined>
      = loadImage === undefined ? () => Promise.resolve(undefined) : loadImage
    for (const image of images) {
      this.addChild(new ImageBlockComponent(
        image,
        loader,
        palette,
      ))
    }
  }

  /**
   * Render the children, then pad each row to the full width and fill it with
   * the bubble background. The pad rides along only when the fill actually
   * paints (color on) — trailing pad spaces without a background would be
   * invisible on screen yet noise in a monochrome drag-copy.
   */
  override render(width: number): string[] {
    const fill = this.palette.bubble('') !== ''
    return super.render(width).map((row) => {
      if (!fill) return row
      const padded = row + ' '.repeat(Math.max(0, width - visibleWidth(row)))
      return this.palette.bubble(padded)
    })
  }
}

/**
 * A settled assistant reply body rendered through Markdown. Past `maxLines`
 * rendered rows the body folds to a head preview plus one dim disclosure row
 * (`… +M lines (click to expand)`); the owning StreamingAssistantComponent
 * holds the expanded state and rebuilds this component when it flips, the
 * same disclosure pattern the folded Thinking line uses. Streaming replies
 * never reach this component — they render in full so the live tail stays
 * visible.
 */
class FoldableBodyComponent implements Component {
  private readonly markdown: Markdown

  constructor(
    text: string,
    private readonly maxLines: number,
    private readonly expanded: boolean,
    private readonly palette: Palette,
    mdTheme: MarkdownTheme,
  ) {
    this.markdown = new Markdown(text, 0, 0, mdTheme, { color: value => palette.text(value) })
  }

  invalidate(): void {
    this.markdown.invalidate()
  }

  render(width: number): string[] {
    const rows = this.markdown.render(width)
    if (this.expanded || rows.length <= this.maxLines) return rows
    return [
      ...rows.slice(0, this.maxLines),
      this.palette.dim(`… +${rows.length - this.maxLines} lines ${shortcutHint('click', 'expand')}`),
    ]
  }
}

/** The disclosure row a folded assistant body ends with (click target). */
const FOLDED_BODY_HINT = /^… \+\d+ lines \(click to expand\)$/u

/**
 * Children of a settled assistant message: optional reasoning block then the
 * response text. The first visible step in a turn carries the Assistant role
 * header (with a dim `HH:MM` stamp when the step's start time is known) and
 * opens the message-level two-row gap; later steps are one-row-gap
 * continuations. A settled
 * step folds its reasoning to one dim `∴ Thinking` line unless expanded
 * (Claude Code's default), while a streaming step keeps the reasoning live;
 * a folded continuation with no visible body renders nothing at all, so
 * tool-only steps leave no blank segment behind. Shown reasoning renders as a
 * Markdown blockquote, so the quote style's dim `▎` bar gives the thinking
 * block a left edge apart from tool output and the reply. A settled reply
 * body longer than `maxMessageLines` rendered rows folds behind a
 * click-to-expand disclosure row; a streaming reply always renders in full.
 */
function assistantMessageChildren(
  content: readonly ContentBlock[],
  showReasoning: boolean,
  foldedContinuation: boolean,
  palette: Palette,
  mdTheme: MarkdownTheme,
  settled: boolean,
  thinkingMs: number | undefined,
  headerAt: number | undefined,
  maxMessageLines: number,
  textExpanded: boolean,
): Component[] {
  const reasoning = displayText(textBlocks(content, 'reasoning').trim())
  const text = displayText(textBlocks(content, 'text').trim())
  const showsReasoning = reasoning !== '' && (!settled || showReasoning)
  const foldsReasoning = settled && reasoning !== '' && !showReasoning
  if (foldedContinuation && !showsReasoning && !foldsReasoning && text === '') return []
  const children: Component[] = [new Spacer(foldedContinuation ? 1 : 2)]
  if (!foldedContinuation) {
    const stamp = headerAt === undefined ? '' : ` ${palette.dim(formatClockTime(headerAt))}`
    children.push(new Text(palette.underline(palette.bold(palette.accent('Assistant'))) + stamp, 0, 0))
  }
  const duration = thinkingMs === undefined ? '' : ` for ${formatStatusDuration(thinkingMs)}`
  const liveDuration = thinkingMs === undefined ? '…' : `… ${formatStatusDuration(thinkingMs)}`
  const reasoningLines = reasoning === '' ? 0 : reasoning.split('\n').length
  if (foldsReasoning) {
    children.push(new Text(palette.italic(palette.dim(
      `▶ Thinking${duration} · ${String(reasoningLines)} lines ${shortcutHint('ctrl+r', 'expand')}`,
    )), 0, 0))
  } else if (showsReasoning) {
    // Quote-prefix every line (blank lines keep a bare `>` so the bar does not
    // break at paragraph gaps) and let the Markdown quote style draw the bar.
    const quoted = reasoning.split('\n').map(line => line === '' ? '>' : `> ${line}`).join('\n')
    children.push(
      new Text(palette.italic(palette.dim(
        `▼ ${THINKING_GLYPH} Thinking${settled ? duration : liveDuration}${settled ? ` ${shortcutHint('ctrl+r', 'collapse')}` : ''}`,
      )), 0, 0),
      new Markdown(quoted, 0, 0, mdTheme, { color: value => palette.dim(value), italic: true }),
    )
  }
  if (text) {
    children.push(settled
      ? new FoldableBodyComponent(text, maxMessageLines, textExpanded, palette, mdTheme)
      : new Markdown(text, 0, 0, mdTheme, { color: value => palette.text(value) }))
  }
  return children
}


interface StreamingBlock {
  type: string
  text: string
}

/** A live assistant step: streamed reasoning/text blocks until the message settles. */
export class StreamingAssistantComponent extends Container {
  private readonly blocks = new Map<number, StreamingBlock>()
  private settledContent: readonly ContentBlock[] | undefined
  private foldedContinuation = false
  private startedAt: number | undefined
  private thinkingStartedAt: number | undefined
  private thinkingMs: number | undefined
  /** Whether a settled over-long reply body is expanded past its fold. */
  private textExpanded = false
  constructor(
    /** The step's turn/step coordinates, used to group steps into its turn. */
    readonly position: StepPosition,
    private showReasoning: boolean,
    private readonly palette: Palette,
    private readonly mdTheme: MarkdownTheme,
    /** Rendered-line budget for a settled reply body before it folds. */
    private readonly maxMessageLines: number,
    /** Shared channel clock; the channel animation tick drives repaint. */
    private readonly now: () => number = Date.now,
  ) {
    super()
    this.rebuild()
  }

  /**
   * Record the step's start time (its `step/start` event time) for the
   * collapsed thinking line's duration and the role header's clock stamp.
   * @param time - Step start in epoch milliseconds, or `undefined` when the
   * opening event is unavailable (the duration and stamp are simply omitted).
   */
  markStart(time: number | undefined): void {
    this.startedAt = time
  }

  /**
   * Replace the streamed blocks with the step's settled content.
   * @param content - The settled assistant content blocks.
   * @param at - Settle time in epoch milliseconds (the `assistant/message`
   * event time) for the collapsed thinking duration; omitted leaves it unset.
   */
  settle(content: readonly ContentBlock[], at?: number): void {
    this.settledContent = content
    const hasReasoning = content.some(block => block.type === 'reasoning' && block.text !== '')
    const timingStart = this.thinkingStartedAt ?? (hasReasoning ? this.startedAt : undefined)
    if (this.thinkingMs === undefined && at !== undefined && timingStart !== undefined) {
      this.thinkingMs = Math.max(0, at - timingStart)
    }
    this.rebuild()
  }

  /**
   * Whether this step's assistant message has settled.
   * @returns `true` once {@link settle} has run.
   */
  isSettled(): boolean {
    return this.settledContent !== undefined
  }

  override invalidate(): void {
    this.rebuild()
    super.invalidate()
  }

  /**
   * Fold one streamed chunk into the live block buffer and re-render.
   * @param chunk - The streamed assistant chunk.
   */
  update(chunk: StreamChunk, at = this.now()): void {
    if ((chunk.type === 'reasoning-delta' || (chunk.type === 'block-start' && chunk.blockType === 'reasoning'))
      && this.thinkingStartedAt === undefined) {
      this.thinkingStartedAt = at
    }
    if ((chunk.type === 'text-delta' || (chunk.type === 'block-start' && chunk.blockType === 'text'))
      && this.thinkingStartedAt !== undefined && this.thinkingMs === undefined) {
      this.thinkingMs = Math.max(0, at - this.thinkingStartedAt)
    }
    if (chunk.type === 'block-start') {
      this.blocks.set(chunk.index, { type: chunk.blockType, text: '' })
    } else if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
      const type = chunk.type === 'text-delta' ? 'text' : 'reasoning'
      const block = this.blocks.get(chunk.index) ?? { type, text: '' }
      block.text += chunk.text
      this.blocks.set(chunk.index, block)
    } else if (chunk.type === 'block-end' && (chunk.block.type === 'text' || chunk.block.type === 'reasoning')) {
      this.blocks.set(chunk.index, { type: chunk.block.type, text: chunk.block.text })
    }
    this.rebuild()
  }

  override render(width: number): string[] {
    if (this.settledContent === undefined && this.thinkingStartedAt !== undefined && this.thinkingMs === undefined) {
      this.rebuild()
    }
    return super.render(width)
  }

  /**
   * Toggle whether reasoning blocks render, then re-render.
   * @param show - Whether to show reasoning blocks.
   */
  setShowReasoning(show: boolean): void {
    this.showReasoning = show
    this.rebuild()
  }

  /**
   * Toggle this step's disclosure rows: the folded Thinking line switches the
   * reasoning block, and a folded reply body's `… +M lines (click to expand)`
   * row expands the body in place (one-way, like the tool-card preview).
   */
  clickTranscriptRow(row: number, width: number): boolean {
    const line = stripTerminalControls(this.render(width)[row] ?? '')
    if (line.includes('Thinking')) {
      this.setShowReasoning(!this.showReasoning)
      return true
    }
    if (!this.textExpanded && FOLDED_BODY_HINT.test(line.trimEnd())) {
      this.textExpanded = true
      this.rebuild()
      return true
    }
    return false
  }

  /**
   * Mark this step as a folded continuation of its turn: no `Assistant` header,
   * and no output at all while the step has no visible body. Used while tool
   * cards are hidden so a turn reads as one assistant message.
   * @param folded - Whether to render as a headerless continuation.
   */
  setFoldedContinuation(folded: boolean): void {
    if (this.foldedContinuation === folded) return
    this.foldedContinuation = folded
    this.rebuild()
  }

  /**
   * Whether the step currently renders visible reasoning or text.
   * @returns `true` when a header-owning render would show a body.
   */
  hasVisibleBody(): boolean {
    const content = this.presentedContent()
    return textBlocks(content, 'text').trim() !== ''
      || textBlocks(content, 'reasoning').trim() !== ''
  }

  /** The settled content when available, otherwise the streamed blocks in model order. */
  private presentedContent(): readonly ContentBlock[] {
    return this.settledContent ?? [...this.blocks.entries()]
      .sort(([left], [right]) => left - right)
      .flatMap<ContentBlock>(([, block]) => {
        if (block.type === 'text') return [{ type: 'text', text: block.text }]
        if (block.type === 'reasoning') return [{ type: 'reasoning', text: block.text }]
        return []
      })
  }

  private rebuild(): void {
    this.clear()
    const children = assistantMessageChildren(
      this.presentedContent(),
      this.showReasoning,
      this.foldedContinuation,
      this.palette,
      this.mdTheme,
      this.settledContent !== undefined,
      this.thinkingMs ?? (this.thinkingStartedAt === undefined ? undefined : Math.max(0, this.now() - this.thinkingStartedAt)),
      this.startedAt,
      this.maxMessageLines,
      this.textExpanded,
    )
    for (const child of children) this.addChild(child)
  }
}

/**
 * A tool card's body split at the Markdown boundary. `prelude` rows are already
 * styled and render verbatim (a terminal `$` command, its cwd, a diff's hunks);
 * `lines` is the tool's own text. A generic card renders both as one Markdown
 * document under the dim body tone.
 */
interface CardBody {
  readonly prelude: readonly string[]
  readonly lines: readonly string[]
}

/**
 * Ctrl+O card-visibility cycle: `hidden` drops tool cards from the transcript,
 * `collapsed` previews the first body lines, `expanded` shows everything.
 */
export type ToolCardVisibility = 'hidden' | 'collapsed' | 'expanded'

/**
 * Prefix a card's body rows with the result marker: the first non-blank row
 * carries `⎿`, later rows align under its text column, blank rows stay empty.
 */
function prefixResultLines(body: readonly string[]): string[] {
  let marked = false
  return body.map((line) => {
    if (line === '') return ''
    if (!marked) {
      marked = true
      return `${RESULT_MARKER}${line}`
    }
    return `${RESULT_CONTINUATION}${line}`
  })
}

/**
 * Transcript card with a width-keyed rendered-row cache. pi-tui re-renders
 * every component each frame and relies on per-component line caches (its own
 * `Text`/`Markdown` do this); a card that rebuilds rows inside `render(width)`
 * would re-wrap its output every frame
 * ([rationale](../../../../../.agents/notes/implemented/bug-fix/2026-08-03-tui-long-session-render-costs.md)).
 * Subclasses render through {@link renderLines} and call {@link dropLines}
 * from every state mutator; with `invalidate()` (pi-tui's tree-wide cascade)
 * also dropping, a state change always re-renders.
 */
abstract class CachedCardComponent implements Component {
  private cached: { width: number; lines: string[] } | undefined

  /** Discard the cached rows so the next render recomputes them. */
  protected dropLines(): void {
    this.cached = undefined
  }

  invalidate(): void {
    this.cached = undefined
  }

  render(width: number): string[] {
    if (this.cached?.width !== width) this.cached = { width, lines: this.renderLines(width) }
    return this.cached.lines
  }

  /**
   * Render the card's rows for `width` without caching.
   * @param width - Render width the rows are wrapped to.
   * @returns The card's rows.
   */
  protected abstract renderLines(width: number): string[]
}

/** A tool call and its result, rendered as a collapsible status card. */
export class ToolCardComponent extends CachedCardComponent {
  private result: { content: ContentBlock[]; isError: boolean; meta?: JsonValue } | undefined
  private visibility: ToolCardVisibility = 'collapsed'
  private callView: ToolCallView
  private resultView: ToolResultView | undefined
  private diffBodyCache: { view: ToolCallView | ToolResultView; body: CardBody } | undefined
  private endedAt: number | undefined
  private spinnerFrame: string | undefined

  constructor(
    private readonly name: string,
    private readonly parsed: ParsedArguments,
    private readonly definition: ToolDefinition | undefined,
    private readonly maxOutputLines: number,
    private readonly maxDiffEditLength: number,
    private readonly palette: Palette,
    private readonly mdTheme: MarkdownTheme,
    /** Wall-clock time of the `tool/call` event, for the settled duration. */
    private readonly startedAt?: number  ,
  ) {
    super()
    this.callView = this.presentCall()
  }

  /** Whether the call is still awaiting its result. */
  isPending(): boolean {
    return this.result === undefined
  }

  /** The call's registered tool name, for grouping and group summaries. */
  get toolName(): string {
    return this.name
  }

  /**
   * The card's current verb label (progressive while pending, settled after),
   * for surfaces that name the call outside the transcript (approval dialogs).
   */
  label(): string {
    return this.isPending()
      ? progressiveTitle(this.name, this.callView)
      : settledTitle(this.name, this.mergedView())
  }

  /**
   * Show `frame` in place of the pending glyph (the braille spinner); one
   * frame per animation tick while the newest pending card animates.
   * @param frame - The spinner frame glyph, or `undefined` for the hollow dot.
   */
  setSpinner(frame: string | undefined): void {
    if (this.spinnerFrame === frame) return
    this.spinnerFrame = frame
    this.dropLines()
  }

  private presentCall(): ToolCallView {
    if (this.parsed.valid && this.definition?.presentCall) {
      try {
        const view = this.definition.presentCall(this.parsed.value)
        if (view !== undefined) return view
      } catch (error: unknown) {
        return { card: 'generic', title: displayText(this.name), rawInput: `Presenter failed: ${String(error)}` }
      }
    }
    return { card: 'generic', title: displayText(this.name), rawInput: this.parsed.value }
  }

  /**
   * Record the tool result and derive its result view.
   * @param event - The `tool/result` event payload.
   * @param endedAt - Wall-clock time of the `tool/result` event.
   */
  updateResult(event: Extract<SessionEvent, { type: 'tool/result' }>['data'], endedAt?: number): void {
    this.diffBodyCache = undefined
    this.endedAt = endedAt
    this.spinnerFrame = undefined
    this.dropLines()
    const result = event.message.content[0]
    this.result = {
      content: [...result.content],
      isError: result.isError === true,
      ...event.meta !== undefined ? { meta: event.meta } : {},
    }
    if (this.parsed.valid && this.definition?.presentResult) {
      try {
        const view = this.definition.presentResult(this.parsed.value, this.result)
        if (view !== undefined) this.resultView = view
      } catch (error: unknown) {
        this.resultView = { card: 'generic', content: [{ type: 'text', text: `Presenter failed: ${String(error)}` }] }
      }
    }
  }

  /**
   * Set the card's visibility state.
   * @param visibility - Hidden, collapsed preview, or full body.
   */
  setVisibility(visibility: ToolCardVisibility): void {
    this.visibility = visibility
    this.dropLines()
  }

  /** Toggle this card only when its disclosure header row is clicked. */
  clickTranscriptRow(row: number, _width: number): boolean {
    if (row !== 1 || this.visibility === 'hidden') return false
    this.setVisibility(this.visibility === 'expanded' ? 'collapsed' : 'expanded')
    return true
  }

  protected renderLines(width: number): string[] {
    // Hidden renders nothing — not even the leading gap — so the transcript
    // keeps only the conversation, the way Codex hides tool calls.
    if (this.visibility === 'hidden') return []
    const isError = this.result?.isError ?? false
    // Claude-Code-style marker: the braille spinner frame while pending (the
    // hollow dot before the first tick or in a replayed log), the filled
    // platform-appropriate settled dot (`⏺` on macOS, `●` elsewhere) once
    // settled; the header color (warning/success/error) doubles the state.
    const pending = this.result === undefined
    const glyph = pending ? this.spinnerFrame ?? '○' : TOOL_SETTLED()
    const rawBody = this.renderBody(width)
    const view = this.resultView ?? this.callView
    // A generic card's own content, a read card's `content` fallback (the
    // envelope-stripped file text — the TUI has no dedicated read rendering, so a
    // read renders exactly as before the read card existed), or a search/web
    // card's fallback to the raw result content (neither the `search` nor the
    // `web` view carries a `content` copy), all render as one dim Markdown block
    // below, so links/lists/headings keep the unified dim styling rather than
    // reading as bare text. A search card thus stays byte-identical to the
    // pre-search-card generic fallback. Terminal and diff cards own their body
    // styling, so they are excluded (mirrors renderBody's post-terminal/diff fallback).
    const markdownContent = view.card === 'generic'
      ? view.content ?? this.result?.content
      : undefined
    const unknownXml = this.definition === undefined && markdownContent !== undefined
      ? renderUnknownXml(
        displayText(contentText(markdownContent)),
        this.maxOutputLines,
        this.visibility === 'expanded',
        displayText,
        text => this.palette.dim(text),
        text => this.palette.dim(text),
        /* v8 ignore next -- renderUnknownXml calls the collapsed summary only when hidden XML children exceed this card's limit. */
        count => this.palette.dim(`  … +${count} lines ${shortcutHint('ctrl+o', 'expand')}`),
      )
      : undefined
    // A generic card renders title and result as one Markdown document, so the
    // document's own block spacing is preserved, then dims every row — the whole
    // card body reads as one dim block under the status-colored header.
    let body = unknownXml ?? (markdownContent !== undefined && rawBody.lines.length > 0
      ? this.dimBody(rawBody, width)
      : [...rawBody.prelude, ...rawBody.lines])
    if (isError) {
      let styled = false
      body = body.map((line) => {
        if (styled || line === '') return line
        styled = true
        return this.palette.error(stripTerminalControls(line))
      })
    }
    const visibleBody = unknownXml !== undefined || this.visibility === 'expanded'
      ? body
      : preview(body, this.maxOutputLines, count => this.palette.dim(`… +${count} lines ${shortcutHint('ctrl+o', 'expand')}`))
    // The header is one card row: the marker glyph, a verb title naming what
    // THIS call does (progressive while pending, the presenter's settled label
    // once resolved), and the wall-clock duration once settled. While pending
    // the whole row carries the warning color; once settled only the status
    // glyph keeps the success/error color and the prose drops to dim, so a
    // screen of finished cards does not shout over the conversation. Body rows
    // sit under a `⎿` continuation marker so the output reads as the call's
    // result.
    const statusColor = pending
      ? this.palette.warning
      : isError ? this.palette.error : this.palette.success
    const label = pending
      ? progressiveTitle(this.name, this.callView)
      : settledTitle(this.name, this.mergedView())
    const duration = pending || this.startedAt === undefined || this.endedAt === undefined
      ? ''
      : ` · ${formatStatusDuration(Math.max(0, this.endedAt - this.startedAt))}`
    // The header is a single card row: collapse an embedded newline in a
    // model-authored label to an inline escape so it cannot break onto extra
    // rows and collide with the body lines that follow.
    const disclosure = this.visibility === 'expanded' ? '▼' : '▶'
    const headerText = `${disclosure} ${glyph} ${displayInlineText(label)}${duration}`
    const maxWidth = Math.max(1, width - 2)
    const header = pending
      ? this.palette.warning(truncateToWidth(headerText, maxWidth, ''))
      : truncateToWidth(
        this.palette.dim(`${disclosure} `) + statusColor(glyph) + this.palette.dim(` ${displayInlineText(label)}${duration}`),
        maxWidth,
        '',
      )
    // The blank first row is the card's own paragraph gap (no external Spacer),
    // so the hidden state removes the gap together with the card.
    const lines: string[] = ['', header]
    if (visibleBody.length > 0) {
      lines.push(...new Text(prefixResultLines(visibleBody).join('\n'), 0, 0).render(width))
    }
    return lines
  }

  /** The pending terminal call view, when this row is a terminal card. */
  private terminalPending(): TerminalCallView | undefined {
    return this.callView.card === 'terminal' ? this.callView : undefined
  }

  /**
   * The settled label's view: the result view with its omitted fields falling
   * back to the call view's (a result view that replaces no title keeps the
   * pending one — e.g. a terminal result carries the output but not the
   * command, which lives in the call view's title).
   */
  private mergedView(): { card: string; title?: string; description?: string } {
    const call = this.callView as { card: string; title?: string; description?: string }
    if (this.resultView === undefined) return call
    const result = this.resultView as { card: string; title?: string; description?: string }
    const title = result.title ?? call.title
    const description = result.description ?? call.description
    return {
      card: result.card,
      ...title !== undefined ? { title } : {},
      ...description !== undefined ? { description } : {},
    }
  }

  private renderBody(width: number): CardBody {
    const view = this.resultView ?? this.callView
    if (view.card === 'terminal') {
      const pending = this.terminalPending()
      const prelude: string[] = []
      const lines: string[] = []
      // The command shows as a $-line here whenever it is not the header: either a
      // description headlines the row (the command still belongs somewhere) or the row
      // is a pending undescribed call (the classic running-command echo). A completed
      // undescribed row keeps the command only in the header.
      // The command and cwd are each a single card row, so escape a multi-line
      // command inline (displayInlineText) — a real newline would break onto extra
      // rows and collide with the output below.
      const headlined = pending?.description !== undefined && pending.description !== ''
      const commandInBody = pending !== undefined && (headlined || this.result === undefined)
      if (commandInBody) prelude.push(this.palette.dim(`$ ${displayInlineText(pending.title)}`))
      if (pending?.cwd) prelude.push(this.palette.dim(displayInlineText(pending.cwd)))
      if (this.resultView?.card === 'terminal') {
        if (this.resultView.output) lines.push(...this.dimOutput(this.resultView.output))
        if (this.resultView.exitCode !== undefined) lines.push(this.palette.dim(`[exit ${this.resultView.exitCode}]`))
        if (this.resultView.signal !== undefined) {
          lines.push(this.palette.error(`[signal ${displayText(this.resultView.signal)}]`))
        }
      } else if (this.result !== undefined) {
        lines.push(...this.dimOutput(contentText(this.result.content)))
      }
      return { prelude: prelude.filter(Boolean), lines: lines.filter(Boolean) }
    }
    if (view.card === 'diff') {
      if (this.diffBodyCache?.view === view) return this.diffBodyCache.body
      // A single-file diff whose title already names the file keeps the path
      // out of the body; multi-file diffs (or a title-less view) keep one path
      // header per file. A trailing footer summarizes the exact changed rows
      // when the bounded comparison succeeds (`+A -R · N file(s)`, the counts
      // bold). Row content syntax-highlights through the same hook the
      // Markdown code fences use when the theme carries one.
      const first = view.diffs[0]
      const skipPath = view.diffs.length === 1 && first !== undefined
        && view.title !== undefined && view.title.includes(first.path)
      const renderedDiffs = view.diffs.map(diff =>
        renderDiff(
          diff,
          this.maxDiffEditLength,
          this.palette,
          skipPath,
          this.mdTheme.highlightCode,
        ),
      )
      const added = renderedDiffs.reduce((total, rendered) => total + rendered.added, 0)
      const removed = renderedDiffs.reduce((total, rendered) => total + rendered.removed, 0)
      const approximate = renderedDiffs.some(rendered => rendered.approximate)
      const hunks = renderedDiffs.flatMap((rendered, index) => {
        return [...index > 0 ? [''] : [], ...rendered.lines]
      })
      const files = new Set(view.diffs.map(diff => diff.path)).size
      const footer = [
        this.palette.dim('⎿ '),
        this.palette.success(this.palette.bold(`+${added}`)),
        this.palette.dim(' · '),
        this.palette.error(this.palette.bold(`-${removed}`)),
        this.palette.dim(` · ${files} file${files === 1 ? '' : 's'}${approximate ? ' · approximate' : ''}`),
      ].join('')
      // A diff's own `+`/`-` colors carry its meaning, so it renders verbatim
      // rather than under the dim result-output color.
      const body = { prelude: [...hunks, footer], lines: [] }
      this.diffBodyCache = { view, body }
      return body
    }
    if (view.card === 'read') return this.renderRead(view)
    if (view.card === 'search') return this.renderSearch(view)
    if (view.card === 'web') return this.renderWeb(view, width)
    // A generic card carries its own formatted content, falling back to the
    // raw result text when its presenter omits a replacement.
    // The presenter title headlines the HEADER (progressive/settled verb title),
    // so the body carries only the output itself.
    const content = view.content ?? this.result?.content
    const prelude: string[] = []
    const lines: string[] = []
    if (content !== undefined) lines.push(...displayText(contentText(content)).split('\n'))
    const rawInput = this.result === undefined && this.callView.card === 'generic'
      ? this.callView.rawInput
      : undefined
    if (rawInput !== undefined) lines.push(...pretty(rawInput).split('\n'))
    // Blank-line trimming spans the whole body, so the title counts as a row:
    // interior blanks (a result's own paragraph break) survive while the body's
    // leading and trailing ones are dropped.
    const total = prelude.length + lines.length
    return {
      prelude,
      lines: lines.filter((line, index) => {
        const row = prelude.length + index
        return line.length > 0 || (row > 0 && row < total - 1)
      }),
    }
  }

  /** Render one completed file read with stable source line numbers. */
  private renderRead(view: Extract<ToolResultView, { card: 'read' }>): CardBody {
    const gutterWidth = Math.max(1, String(Math.max(view.totalLines, view.offset)).length)
    const lines = view.lines.map((line) => {
      const source = displayText(line.text)
      const highlighted = view.lang === undefined
        ? source
        : this.mdTheme.highlightCode?.(source, view.lang)?.[0] ?? source
      return `${this.palette.dim(String(line.number).padStart(gutterWidth))} ${highlighted}`
    })
    if (lines.length === 0) lines.push(this.palette.dim(`No lines returned from ${displayText(view.path)}.`))
    const returned = view.lines.length
    const end = view.lines.at(-1)?.number ?? Math.max(0, view.offset - 1)
    lines.push(this.palette.dim(`Showing ${returned} of ${view.totalLines} lines · through ${end}`))
    return { prelude: [], lines }
  }

  /** Render completed grep/glob results from their structured presentation. */
  private renderSearch(view: Extract<ToolResultView, { card: 'search' }>): CardBody {
    const lines: string[] = []
    if (view.shape === 'matches') {
      for (const file of view.files) {
        if (lines.length > 0) lines.push('')
        lines.push(this.palette.code(displayText(file.path)))
        const gutterWidth = Math.max(1, ...file.matches.map(match => String(match.lineNumber).length))
        for (const match of file.matches) {
          lines.push(`${this.palette.dim(String(match.lineNumber).padStart(gutterWidth))} ${displayText(match.line)}`)
        }
      }
    } else {
      lines.push(...view.paths.map(path => this.palette.code(displayText(path))))
    }
    if (lines.length === 0) lines.push(this.palette.dim('No matches.'))
    if (view.truncated) lines.push(this.palette.warning(`Showing a limited result set · ${view.total} total`))
    else lines.push(this.palette.dim(`${view.total} result${view.total === 1 ? '' : 's'}`))
    return { prelude: [], lines }
  }

  /** Render structured web search citations or a fetch summary plus body. */
  private renderWeb(view: Extract<ToolResultView, { card: 'web' }>, width: number): CardBody {
    if (view.kind === 'search') {
      const lines: string[] = []
      if (view.answer !== undefined && view.answer !== '') lines.push(...this.dimOutput(view.answer), '')
      for (const [index, source] of view.sources.entries()) {
        const label = source.title === undefined || source.title === '' ? source.url : source.title
        lines.push(`${this.palette.dim(`${index + 1}.`)} ${this.palette.code(displayText(label))}`)
        if (label !== source.url) lines.push(`   ${this.palette.dim(displayText(source.url))}`)
        if (source.snippet !== undefined && source.snippet !== '') lines.push(`   ${this.palette.dim(displayText(source.snippet))}`)
      }
      if (lines.length === 0) lines.push(...this.dimBody({ prelude: [], lines: displayText(contentText(this.result?.content ?? [])).split('\n') }, width))
      if (view.truncated) lines.push(this.palette.warning('Source list truncated'))
      return { prelude: [], lines }
    }
    const summary = `${view.statusCode} · ${displayText(view.url)}${view.truncated ? ' · truncated' : ''}`
    const content = displayText(contentText(this.result?.content ?? [])).split('\n')
    return { prelude: [this.palette.dim(summary)], lines: this.dimBody({ prelude: [], lines: content }, width) }
  }

  /**
   * A tool's own output text as dim rows — the card's result-output color, which
   * separates what the tool produced from the card's own framing. A blank row
   * stays the empty string so the terminal branch's blank-row filter still reads
   * it as blank instead of as an ANSI-wrapped value.
   */
  private dimOutput(text: string): string[] {
    return displayText(text).split('\n').map(line => line === '' ? line : this.palette.dim(line))
  }

  /**
   * Render a generic card's prelude and result as one Markdown document under the
   * dim body tone. Rendering both together preserves the document's own block
   * spacing (Markdown's blank row before a heading); dimming every row keeps the
   * card body one uniform tone, so only the status-colored header carries color.
   */
  private dimBody(body: CardBody, width: number): string[] {
    const rows = new Markdown([...body.prelude, ...body.lines].join('\n'), 0, 0, this.mdTheme, {
      color: value => this.palette.text(value),
    }).render(width)
    // A whitespace-only row carries no output to dim; leaving it unwrapped keeps
    // Markdown's padding out of the styled ranges.
    return rows.map(row => row.trim() === '' ? row : this.palette.dim(row))
  }
}

/**
 * A foldable tool name → the noun its calls tally in a collapsed group row:
 * `read` reads files, `grep` searches patterns, `glob` lists directories (the
 * harness has no separate `ls` tool — `glob` owns directory listings). A
 * foldable name absent from this table falls back to a per-name count segment.
 */
const TOOL_GROUP_NOUNS: Readonly<Record<string, 'file' | 'pattern' | 'dir'>> = {
  read: 'file',
  grep: 'pattern',
  glob: 'dir',
}

/** The verb each category segment headlines (`file` first, so a full row reads `Read 2 files · searched 1 pattern`). */
const TOOL_GROUP_VERBS: Readonly<Record<'file' | 'pattern' | 'dir', string>> = {
  file: 'Read',
  pattern: 'searched',
  dir: 'listed',
}

/** The collapsed-group category order: files, then patterns, then directories. */
const TOOL_GROUP_ORDER = ['file', 'pattern', 'dir'] as const

/**
 * A run of adjacent low-signal tool calls (reads, searches, listings)
 * collapsed into one Claude-Code-style summary row — `⏺ Read 12 files ·
 * searched 3 patterns · listed 2 dirs (ctrl+o to expand)`, one dim row with
 * bold counts where twenty full cards used to stand. The member cards are
 * reused, so results keep flowing into the same objects: `collapsed` renders
 * only the summary (its glyph tracks the newest pending member, with that
 * call's label as the activity hint), `expanded` lists each member's own rows
 * beneath the summary (through the members' per-card width caches), and
 * `hidden` drops the row together with the cards.
 */
export class CollapsedToolGroupComponent extends CachedCardComponent {
  private visibility: ToolCardVisibility = 'collapsed'
  private spinnerFrame: string | undefined
  private readonly members: ToolCardComponent[]

  constructor(cards: readonly ToolCardComponent[], private readonly palette: Palette) {
    super()
    this.members = [...cards]
  }

  /** The member cards, in arrival order. */
  get cards(): readonly ToolCardComponent[] {
    return this.members
  }

  /** Toggle this group only when its summary row is clicked. */
  clickTranscriptRow(row: number, _width: number): boolean {
    if (row !== 1 || this.visibility === 'hidden') return false
    this.setVisibility(this.visibility === 'expanded' ? 'collapsed' : 'expanded')
    return true
  }

  /**
   * Add one more adjacent member call and re-render the summary.
   * @param card - The later foldable call's card, already registered with the
   * visibility cycle and result map by the assembly layer.
   */
  add(card: ToolCardComponent): void {
    this.members.push(card)
    this.dropLines()
  }

  /** The newest member still awaiting its result, when the run is mid-flight. */
  private pendingCard(): ToolCardComponent | undefined {
    return this.members.findLast(card => card.isPending())
  }

  /**
   * Show `frame` in place of the pending glyph (the braille spinner) while any
   * member pends; a fully settled group ignores it.
   * @param frame - The spinner frame glyph, or `undefined` for the hollow dot.
   */
  setSpinner(frame: string | undefined): void {
    if (this.spinnerFrame === frame) return
    this.spinnerFrame = frame
    if (this.pendingCard() !== undefined) this.dropLines()
  }

  /**
   * Drop cached rows after a member card mutated outside this component — a
   * result landing (settled glyph, counts) or any other state the summary reads.
   */
  refresh(): void {
    this.dropLines()
  }

  /**
   * Set the group's visibility state.
   * @param visibility - Hidden (nothing at all), collapsed summary row, or the
   * expanded list of member cards.
   */
  setVisibility(visibility: ToolCardVisibility): void {
    this.visibility = visibility
    this.dropLines()
  }

  /**
   * The summary segments in display order: the three fixed categories
   * (`files`, `patterns`, `dirs`), then per-tool-name counts for foldable
   * names with no category. Each carries the wording split around its count so
   * the row can bold the number while the prose stays dim.
   */
  private segments(): readonly { count: number; before: string; after: string }[] {
    const counts: Record<string, number> = { file: 0, pattern: 0, dir: 0 }
    const others = new Map<string, number>()
    for (const card of this.members) {
      const noun = TOOL_GROUP_NOUNS[card.toolName]
      if (noun !== undefined) counts[noun] = (counts[noun] ?? 0) + 1
      else others.set(card.toolName, (others.get(card.toolName) ?? 0) + 1)
    }
    const segments: { count: number; before: string; after: string }[] = []
    const push = (count: number, before: string, after: string, capitalize: boolean): void => {
      segments.push({
        count,
        before: capitalize && before !== '' ? before.slice(0, 1).toUpperCase() + before.slice(1) : before,
        after,
      })
    }
    let first = true
    for (const noun of TOOL_GROUP_ORDER) {
      const count = counts[noun] ?? 0
      if (count === 0) continue
      push(count, `${TOOL_GROUP_VERBS[noun]} `, ` ${noun}${count === 1 ? '' : 's'}`, first)
      first = false
    }
    for (const [name, count] of others) {
      push(count, '', ` × ${name}`, false)
    }
    return segments
  }

  /**
   * The summary row through the palette: dim prose, a state glyph that keeps
   * the success color once the run settles (pending stays dim with the prose),
   * bold counts, the pieces concatenated (SGR has no color stack, so spans
   * never nest).
   * @param glyph - The state glyph (pending spinner frame or settled dot).
   * @param settled - Whether every member has settled.
   */
  private summaryRow(glyph: string, settled: boolean): string {
    const dim = this.palette.dim
    const bold = this.palette.bold
    const pieces: string[] = [settled ? this.palette.success(glyph) : dim(glyph), dim(' ')]
    for (const [index, segment] of this.segments().entries()) {
      if (index > 0) pieces.push(dim(' · '))
      if (segment.before !== '') pieces.push(dim(segment.before))
      pieces.push(bold(String(segment.count)))
      pieces.push(dim(segment.after))
    }
    return pieces.join('')
  }

  protected renderLines(width: number): string[] {
    // Hidden renders nothing — not even the leading gap — so the group leaves
    // the transcript exactly as its member cards would have.
    if (this.visibility === 'hidden') return []
    const pending = this.pendingCard()
    const glyph = pending === undefined ? TOOL_SETTLED() : this.spinnerFrame ?? '○'
    if (this.visibility === 'expanded') {
      // Verbose mode lists every member under the summary header; the members
      // render through their own cached-card contract, so this stays a plain
      // concatenation of their rows.
      return ['', `▼ ${this.summaryRow(glyph, pending === undefined)}`, ...this.members.flatMap(card => card.render(width))]
    }
    // One card row: the summary, the newest pending call's label as the
    // activity hint, and the expand shortcut — a single terminal row.
    const row = [
      `▶ ${this.summaryRow(glyph, pending === undefined)}`,
      ...(pending === undefined ? [] : [this.palette.dim(` · ${displayInlineText(pending.label())}`)]),
      this.palette.dim(` ${shortcutHint('ctrl+o', 'expand')}`),
    ].join('')
    return ['', truncateToWidth(row, Math.max(1, width - 2), '')]
  }
}

/**
 * Matches a lone reminder-frame tag on its own line, capturing the element name.
 * Producers emit the frame as whole lines (`workspace-context`, `dsh-tool-skill`),
 * so anchoring the whole line keeps a tag mentioned inside prose from matching.
 */
const REMINDER_FRAME_LINE = /^<(\/?)([a-zA-Z][\w:.-]*)>$/u

/**
 * Drop a producer's outer reminder frame, keeping the instruction body verbatim.
 * The card header already names the source, so the frame lines carry nothing.
 * Only a matched open/close pair on the first and last lines is removed, so a
 * body that merely starts with a tag-like line is left intact.
 * @param text - Complete model-facing context text.
 * @returns The body without its outer frame lines, trimmed of the blank lines they leave.
 */
function stripReminderFrame(text: string): string {
  // A frame needs an open line and a distinct close line, so anything shorter than
  // two lines is already frameless.
  const [first = '', ...rest] = text.split('\n')
  const last = rest.at(-1)
  if (last === undefined) return text
  const open = REMINDER_FRAME_LINE.exec(first.trim())
  const close = REMINDER_FRAME_LINE.exec(last.trim())
  if (open?.[1] !== '' || close?.[1] !== '/' || open[2] !== close[2]) return text
  return rest.slice(0, -1).join('\n').replace(/^\n+|\n+$/gu, '')
}

/**
 * Injected context (plugin/goal source, e.g. `workspace-context`), rendered as a
 * collapsible dim card that shares the tool-card `Ctrl+O` toggle. The header is
 * `Context · <label>`; the body is the message text as dim prose, one tone with
 * the header and the fold marker, folded to `maxOutputLines`, with a surrounding
 * reminder frame stripped because the source label already names the context.
 *
 * Injected context is prose, not markup, so this card does not parse it. The
 * `<system-reminder>` frame is a prompting convention no model is trained on
 * ([envelope rationale](../../../../../.agents/notes/implemented/simplification/2026-07-20-unwrap-injected-content-envelopes.md)),
 * and instruction bodies legitimately contain a raw `&` or angle-bracket
 * placeholders (`packages/<group>/<pkg>/`, `-t <name>`) that are prose rather than
 * elements. Tree-rendering such a payload depended on whether it happened to be
 * well-formed XML, which made both the fold and the frame-line suppression
 * content-dependent.
 */
export class ContextCardComponent extends CachedCardComponent {
  private expanded = false

  constructor(
    private readonly label: string,
    private readonly text: string,
    private readonly maxOutputLines: number,
    private readonly palette: Palette,
  ) {
    super()
  }

  /**
   * Expand or collapse the card body.
   * @param expanded - Whether the full body is shown.
   */
  setExpanded(expanded: boolean): void {
    this.expanded = expanded
    this.dropLines()
  }

  /** Toggle this context block from its disclosure header. */
  clickTranscriptRow(row: number, _width: number): boolean {
    if (row !== 0) return false
    this.setExpanded(!this.expanded)
    return true
  }

  protected renderLines(width: number): string[] {
    const header = this.palette.dim(`${this.expanded ? '▼' : '▶'} Context · ${displayText(this.label)}`)
    // Emptiness is decided on the stripped text: styling a blank body would yield
    // one escape-only row, which reads as a stray blank line under the header.
    const stripped = stripReminderFrame(this.text)
    if (stripped === '') return [header]
    const body = stripped.split('\n')
      .map(line => line === '' ? line : this.palette.dim(displayText(line)))
    const visibleBody = this.expanded
      ? body
      : preview(body, this.maxOutputLines, count => this.palette.dim(`… +${count} lines ${shortcutHint('ctrl+o', 'expand')}`))
    return [header, ...new Text(visibleBody.join('\n'), 0, 0).render(width)]
  }
}

/** The plan/todo panel rendered above the prompt. */
export class TodoComponent implements Component {
  private todos: readonly TodoItem[] = []

  constructor(private readonly palette: Palette) {}

  /**
   * Replace the rendered plan items.
   * @param todos - The current todo items.
   */
  update(todos: readonly TodoItem[]): void {
    this.todos = todos
  }

  invalidate(): void {}

  render(width: number): string[] {
    if (this.todos.length === 0) return []
    const lines: string[] = [this.palette.bold(this.palette.accent('Plan'))]
    for (const todo of this.todos) {
      const prefix = todo.status === 'completed'
        ? this.palette.success('✓')
        : todo.status === 'in_progress'
          ? this.palette.warning('●')
          : this.palette.dim('○')
      const content = displayText(todo.content)
      const text: string = todo.status === 'completed' ? this.palette.dim(content) : content
      lines.push(truncateToWidth(`  ${prefix} ${text}`, width, ''))
    }
    return ['', ...lines]
  }
}
