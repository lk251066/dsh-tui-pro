import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@earendil-works/pi-tui'
import { CallId, createToolResultMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { CollapsedToolGroupComponent, ToolCardComponent } from '../src/components/transcript.ts'
import { TOOL_SETTLED } from '../src/components/figures.ts'
import { TOOL_SPINNER_FRAMES } from '../src/chat/timing.ts'
import { parseArguments } from '../src/components/content.ts'
import { createPalette, markdownTheme } from '../src/components/theme.ts'
import {
  appendAssistant,
  createTuiTestHarness,
  disposeTuiTestHarness,
  type TuiHarness,
  type TuiHarnessOptions,
} from './harness.ts'

const palette = createPalette(false)
const mdTheme = markdownTheme(palette)

function card(name: string): ToolCardComponent {
  return new ToolCardComponent(name, parseArguments('{}'), undefined, 10, 2_000, palette, mdTheme)
}

let nextResultId = 0

/** Settle one member card with a plain text result. */
function settle(target: ToolCardComponent, text = 'output line'): void {
  target.updateResult({
    turn: 1,
    step: 1,
    message: createToolResultMessage({
      callId: CallId(`group-call-${nextResultId++}`),
      content: [{ type: 'text', text }],
      isError: false,
    }),
  })
}

describe('CollapsedToolGroupComponent', () => {
  it('summarizes a single category as one segment with the expand hint', () => {
    const cards = [card('read'), card('read'), card('read')]
    for (const member of cards) settle(member)
    const group = new CollapsedToolGroupComponent(cards, palette)
    const rows = group.render(80)
    // One leading gap row plus the single summary row.
    expect(rows).toHaveLength(2)
    expect(rows[1]).toContain(`${TOOL_SETTLED()} Read 3 files`)
    expect(rows[1]).toContain('(ctrl+o to expand)')
    expect(rows[1]).not.toContain('searched')
    expect(rows[1]).not.toContain('listed')
  })

  it('lists every category in order and pluralizes by count', () => {
    const cards = [card('read'), card('read'), card('grep'), card('glob')]
    for (const member of cards) settle(member)
    const group = new CollapsedToolGroupComponent(cards, palette)
    expect(group.render(80)[1]).toBe(
      `▶ ${TOOL_SETTLED()} Read 2 files · searched 1 pattern · listed 1 dir (ctrl+o to expand)`,
    )
  })

  it('capitalizes the verb of a sole lowercase-verb category', () => {
    const cards = [card('grep'), card('grep'), card('grep')]
    for (const member of cards) settle(member)
    const group = new CollapsedToolGroupComponent(cards, palette)
    expect(group.render(80)[1]).toContain('Searched 3 patterns')
  })

  it('falls back to per-tool counts for names without a category', () => {
    const cards = [card('list'), card('list')]
    for (const member of cards) settle(member)
    const group = new CollapsedToolGroupComponent(cards, palette)
    expect(group.render(80)[1]).toContain('2 × list')
  })

  it('shows the hollow glyph and the newest pending call while the run is mid-flight', () => {
    const settled = [card('read'), card('read')]
    const pending = card('read')
    for (const member of settled) settle(member)
    // `pending` stays unsettled: the summary carries the pending glyph and the
    // call's label as the activity hint.
    const group = new CollapsedToolGroupComponent([...settled, pending], palette)
    const pendingRow = group.render(80)[1] ?? ''
    expect(pendingRow).toContain('○ Read 3 files')
    // The newest pending call's label rides along as the activity hint (a
    // definition-less card titles itself by its bare tool name).
    expect(pendingRow).toContain('· read')
    group.setSpinner('⠋')
    expect(group.render(80)[1]).toContain('⠋ Read 3 files')
    // Settling the last member swaps in the settled dot through refresh().
    settle(pending)
    group.refresh()
    expect(group.render(80)[1]).toContain(`${TOOL_SETTLED()} Read 3 files`)
    expect(group.render(80)[1]).not.toContain('○')
  })

  it('expanded lists every member card under the summary header', () => {
    const cards = [card('read'), card('grep'), card('glob')]
    for (const member of cards) settle(member)
    const group = new CollapsedToolGroupComponent(cards, palette)
    group.setVisibility('expanded')
    const rendered = group.render(80).join('\n')
    // The summary header stays, without the collapsed-mode expand hint.
    expect(rendered).toContain('Read 1 file · searched 1 pattern · listed 1 dir')
    expect(rendered).not.toContain('ctrl+o')
    // Each member renders its own settled header and result body.
    for (const name of ['read', 'grep', 'glob']) {
      expect(rendered.split(`${TOOL_SETTLED()} ${name}`).length - 1).toBe(1)
    }
    expect(rendered.split('⎿ output line').length - 1).toBe(3)
  })

  it('toggles the group from its disclosure row without changing unrelated rows', () => {
    const cards = [card('read'), card('grep'), card('glob')]
    for (const member of cards) settle(member)
    const group = new CollapsedToolGroupComponent(cards, palette)

    expect(group.clickTranscriptRow(0, 80)).toBe(false)
    expect(group.clickTranscriptRow(1, 80)).toBe(true)
    expect(group.render(80)[1]).toContain('▼')
    expect(group.render(80).join('\n')).toContain('⎿ output line')
    expect(group.clickTranscriptRow(1, 80)).toBe(true)
    expect(group.render(80)[1]).toContain('▶')
  })

  it('hidden renders nothing', () => {
    const group = new CollapsedToolGroupComponent([card('read'), card('read'), card('read')], palette)
    group.setVisibility('hidden')
    expect(group.render(80)).toEqual([])
  })

  it('serves repeat same-width renders from the cache and drops it on add()', () => {
    const group = new CollapsedToolGroupComponent([card('read'), card('read'), card('read')], palette)
    const first = group.render(80)
    expect(group.render(80)).toBe(first)
    group.add(card('read'))
    const grown = group.render(80)
    expect(grown).not.toBe(first)
    expect(grown[1]).toContain('Read 4 files')
    expect(group.render(80)).toBe(grown)
  })
})

/** Minimal terminal recorder: appends every write, replays input sends. */
class FakeTerminal implements Terminal {
  columns = 140
  rows = 32
  kittyProtocolActive = false
  output = ''
  title = ''
  progress: boolean[] = []
  started = 0
  stopped = 0
  cursorVisible = true
  drainInput = () => Promise.resolve()
  private onInput: (data: string) => void = () => {}
  private onResize: () => void = () => {}

  start(onInput: (data: string) => void, onResize: () => void): void {
    this.started += 1
    this.onInput = onInput
    this.onResize = onResize
  }

  stop(): void { this.stopped += 1 }

  write(data: string): void { this.output += data }

  send(data: string): void { this.onInput(data) }

  moveBy(): void { this.output += '[move]' }

  hideCursor(): void { this.output += '[hide]' }

  showCursor(): void { this.output += '[show]' }

  clearLine(): void { this.output += '[clear-line]' }

  clearFromCursor(): void { this.output += '[clear-rest]' }

  clearScreen(): void { this.output += '[clear-screen]' }

  setTitle(title: string): void { this.title = title }

  setProgress(active: boolean): void { this.progress.push(active) }

  resize(): void { this.onResize() }
}

async function tick(ms = 25): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function setup(
  options: TuiHarnessOptions = {},
): Promise<TuiHarness<FakeTerminal, (code: number) => void>> {
  const terminal = new FakeTerminal()
  const result = await createTuiTestHarness(terminal, vi.fn(), options)
  await tick()
  return result
}

function toolCallBlocks(ids: readonly string[], name: string): ContentBlock[] {
  return ids.map(id => ({ type: 'tool-call' as const, id: id as never, name, arguments: '{}' }))
}

function appendToolCall(session: Session, callId: string, name: string): void {
  session.append('tool/call', { turn: 1, step: 1, callId: callId as never, name, arguments: '{}' })
}

function appendToolResult(session: Session, callId: string, text = 'result body'): void {
  session.append('tool/result', {
    turn: 1,
    step: 1,
    message: createToolResultMessage({
      callId: callId as never,
      content: [{ type: 'text', text }],
      isError: false,
    }),
  }, { surfaceOp: 'append' })
}

describe('transcript tool grouping', () => {
  it('collapses three adjacent foldable calls into one summary row', async () => {
    const result = await setup()
    appendAssistant(result.session, toolCallBlocks(['g1', 'g2', 'g3'], 'read'))
    for (const id of ['g1', 'g2', 'g3']) appendToolCall(result.session, id, 'read')
    await tick()
    // While the batch still runs, the summary carries the pending glyph and
    // the newest call's label; settling swaps in the settled dot.
    expect(['○', ...TOOL_SPINNER_FRAMES].some(glyph =>
      result.terminal.output.includes(`${glyph} Read 3 files`),
    )).toBe(true)
    for (const id of ['g1', 'g2', 'g3']) appendToolResult(result.session, id)
    await tick()
    expect(result.terminal.output).toContain(`${TOOL_SETTLED()} Read 3 files`)
    expect(result.terminal.output).toContain('(ctrl+o to expand)')
    // The standalone cards are gone: each would headline its own name.
    expect(result.terminal.output).not.toContain(`${TOOL_SETTLED()} read`)
    await disposeTuiTestHarness(result)
  })

  it('tallies mixed categories and settles through the group row', async () => {
    const result = await setup()
    appendAssistant(result.session, [
      ...toolCallBlocks(['m1', 'm2'], 'read'),
      ...toolCallBlocks(['m3'], 'grep'),
      ...toolCallBlocks(['m4'], 'glob'),
    ])
    appendToolCall(result.session, 'm1', 'read')
    appendToolCall(result.session, 'm2', 'read')
    appendToolCall(result.session, 'm3', 'grep')
    appendToolCall(result.session, 'm4', 'glob')
    await tick()
    // Pending members keep the hollow glyph on the group row.
    expect(result.terminal.output).toContain('○ Read 2 files · searched 1 pattern · listed 1 dir')
    for (const id of ['m1', 'm2', 'm3', 'm4']) appendToolResult(result.session, id)
    await tick()
    expect(result.terminal.output).toContain(`${TOOL_SETTLED()} Read 2 files · searched 1 pattern · listed 1 dir`)
    await disposeTuiTestHarness(result)
  })

  it('keeps runs shorter than three as standalone cards', async () => {
    const result = await setup()
    appendAssistant(result.session, toolCallBlocks(['s1', 's2'], 'read'))
    appendToolCall(result.session, 's1', 'read')
    appendToolCall(result.session, 's2', 'read')
    appendToolResult(result.session, 's1')
    appendToolResult(result.session, 's2')
    await tick()
    // Two settled standalone headers, no group summary.
    expect(result.terminal.output.split(`${TOOL_SETTLED()} read`).length - 1).toBe(2)
    expect(result.terminal.output).not.toContain('Read 2 files')
    await disposeTuiTestHarness(result)
  })

  it('breaks the run at a non-foldable call between two foldable ones', async () => {
    const result = await setup()
    appendAssistant(result.session, [
      ...toolCallBlocks(['b1'], 'read'),
      ...toolCallBlocks(['b2'], 'bash'),
      ...toolCallBlocks(['b3', 'b4'], 'read'),
    ])
    appendToolCall(result.session, 'b1', 'read')
    appendToolCall(result.session, 'b2', 'bash')
    appendToolCall(result.session, 'b3', 'read')
    appendToolCall(result.session, 'b4', 'read')
    await tick()
    // The bash card splits the transcript; neither read run reaches three.
    expect(result.terminal.output).not.toContain('Read ')
    expect(result.terminal.output.split('○ read').length - 1).toBe(3)
    await disposeTuiTestHarness(result)
  })

  it('expanded lists the member cards and hidden drops the group', async () => {
    const result = await setup()
    appendAssistant(result.session, toolCallBlocks(['v1', 'v2', 'v3'], 'grep'))
    for (const id of ['v1', 'v2', 'v3']) appendToolCall(result.session, id, 'grep')
    for (const id of ['v1', 'v2', 'v3']) appendToolResult(result.session, id)
    await tick()
    expect(result.terminal.output).toContain(`${TOOL_SETTLED()} Searched 3 patterns`)

    // Ctrl+O → expanded: the group header stays and every member card lists.
    result.terminal.send('\x0f')
    await tick()
    expect(result.terminal.output).toContain('Tool and context cards expanded.')
    expect(result.terminal.output.split(`${TOOL_SETTLED()} grep`).length - 1).toBe(3)

    // Ctrl+O → hidden: after a redraw the frame carries neither the summary
    // row nor any member card.
    result.terminal.send('\x0f')
    await tick()
    expect(result.terminal.output).toContain('Tool cards hidden.')
    result.terminal.send('\x0c')
    await tick()
    const hiddenFrame = result.terminal.output.slice(result.terminal.output.lastIndexOf('\x1b[2J'))
    expect(hiddenFrame).not.toContain('Searched 3 patterns')
    expect(hiddenFrame).not.toContain(TOOL_SETTLED())
    expect(hiddenFrame).not.toContain('grep')
    await disposeTuiTestHarness(result)
  })

  it('replays a logged run as the same collapsed group', async () => {
    const result = await setup({
      beforeMount(session) {
        appendAssistant(session, toolCallBlocks(['r1', 'r2', 'r3'], 'read'))
        for (const id of ['r1', 'r2', 'r3']) {
          appendToolCall(session, id, 'read')
          appendToolResult(session, id)
        }
      },
    })
    // rebuildTranscript at mount replays through the same grouping path.
    expect(result.terminal.output).toContain(`${TOOL_SETTLED()} Read 3 files`)
    expect(result.terminal.output).not.toContain(`${TOOL_SETTLED()} read`)
    await disposeTuiTestHarness(result)
  })
})
