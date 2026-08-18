import { describe, expect, it } from 'vitest'
import { Markdown, visibleWidth } from '@earendil-works/pi-tui'
import { CallId, createToolResultMessage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import {
  CollapsedToolGroupComponent,
  StreamingAssistantComponent,
  TodoComponent,
  ToolCardComponent,
  UserMessageComponent,
} from '../src/components/transcript.ts'
import { TOOL_SETTLED } from '../src/components/figures.ts'
import { parseArguments } from '../src/components/content.ts'
import { createPalette, markdownTheme } from '../src/components/theme.ts'

const plain = createPalette(false)
const color = createPalette(true, 'dark')
const plainMd = markdownTheme(plain)
const colorMd = markdownTheme(color)

/** A fixed wall-clock time for reasoning-duration tests. */
const STAMP = new Date(2026, 6, 21, 12, 30, 0).getTime()

function toolResult(text: string): Extract<SessionEvent, { type: 'tool/result' }>['data'] {
  const message = createToolResultMessage({
    callId: CallId('call-1'),
    content: [{ type: 'text', text }],
    isError: false,
  })
  return { turn: 1, step: 1, message }
}

function toolCard(palette: typeof plain, mdTheme: typeof plainMd): ToolCardComponent {
  return new ToolCardComponent('bash', parseArguments('{}'), undefined, 10, 2_000, palette, mdTheme)
}

describe('UserMessageComponent', () => {
  it('renders the directional marker with a hanging indent and no repeated role label', () => {
    const rows = new UserMessageComponent('one\ntwo', plain).render(40).map(row => row.trimEnd())
    expect(rows).toEqual(['❯ one', '  two'])
  })

  it('indents soft-wrapped continuation rows under the marker column', () => {
    const rows = new UserMessageComponent('aaaaaaaaaaaaaaaaaaaa', plain).render(12).map(row => row.trimEnd())
    expect(rows).toEqual(['❯ aaaaaaaaaa', '  aaaaaaaaaa'])
  })

  it('fills every row to the component width with the bubble background', () => {
    const rows = new UserMessageComponent('hi', color).render(24)
    for (const row of rows) {
      expect(row.startsWith('\x1b[100m')).toBe(true)
      expect(row.endsWith('\x1b[49m')).toBe(true)
      expect(visibleWidth(row)).toBe(24)
    }
    expect(rows[0]).toContain(' hi')
  })

  it('skips the fill and the padding when color is off', () => {
    const rows = new UserMessageComponent('hi', plain).render(24).map(row => row.trimEnd())
    expect(rows).toEqual(['❯ hi'])
  })
})

describe('StreamingAssistantComponent', () => {
  it('opens one row below the user message without a repeated role label', () => {
    const step = new StreamingAssistantComponent({ turn: 1, step: 1 }, false, plain, plainMd, 30)
    step.markStart(STAMP)
    step.settle([{ type: 'text', text: 'answer' }], STAMP + 2_000)
    const rows = step.render(40)
    expect(rows[0]).toBe('')
    expect(rows[1]?.trimEnd()).toBe('✦ answer')
  })

  it('renders shown reasoning as a quoted block with the ▎ bar', () => {
    const step = new StreamingAssistantComponent({ turn: 1, step: 1 }, true, plain, plainMd, 30)
    step.markStart(STAMP)
    step.settle([
      { type: 'reasoning', text: 'let me think\n\nsecond para' },
      { type: 'text', text: 'answer' },
    ], STAMP + 2_000)
    const rows = step.render(40)
    expect(rows.join('\n')).toContain('✻ Thinking for 2.0s')
    const trimmed = rows.map(row => row.trimEnd())
    const first = trimmed.findIndex(row => row === '  ▎ let me think')
    expect(first).toBeGreaterThan(-1)
    // The bar does not break at the paragraph gap.
    expect(trimmed[first + 1]).toBe('  ▎')
    expect(trimmed[first + 2]).toBe('  ▎ second para')
  })

  it('quotes streamed reasoning on the live path too', () => {
    const step = new StreamingAssistantComponent({ turn: 1, step: 1 }, false, plain, plainMd, 30)
    step.markStart(STAMP)
    step.update({ type: 'block-start', index: 0, blockType: 'reasoning' })
    step.update({ type: 'reasoning-delta', index: 0, text: 'streamed thought' })
    const rows = step.render(40)
    expect(rows.join('\n')).toContain('✻ Thinking…')
    expect(rows.map(row => row.trimEnd())).toContain('  ▎ streamed thought')
  })

  it('updates live thinking duration from the shared repaint clock', () => {
    let now = STAMP
    const step = new StreamingAssistantComponent(
      { turn: 1, step: 1 },
      false,
      plain,
      plainMd,
      30,
      () => now,
    )
    step.markStart(STAMP)
    step.update({ type: 'block-start', index: 0, blockType: 'reasoning' }, STAMP + 500)
    step.update({ type: 'reasoning-delta', index: 0, text: 'streamed thought' }, STAMP + 500)
    now = STAMP + 2_500
    expect(step.render(40).join('\n')).toContain('Thinking… 2.0s')
  })

  it('stops live thinking duration when response text begins', () => {
    const step = new StreamingAssistantComponent({ turn: 1, step: 1 }, false, plain, plainMd, 30)
    step.update({ type: 'block-start', index: 0, blockType: 'reasoning' }, STAMP)
    step.update({ type: 'reasoning-delta', index: 0, text: 'thought' }, STAMP)
    step.update({ type: 'block-start', index: 1, blockType: 'text' }, STAMP + 1_250)
    step.update({ type: 'text-delta', index: 1, text: 'answer' }, STAMP + 1_250)
    step.settle([
      { type: 'reasoning', text: 'thought' },
      { type: 'text', text: 'answer' },
    ], STAMP + 3_000)
    expect(step.render(40).join('\n')).toContain('Thinking for 1.2s')
  })

  it('keeps the folded reasoning summary bar-free', () => {
    const step = new StreamingAssistantComponent({ turn: 1, step: 1 }, false, plain, plainMd, 30)
    step.markStart(STAMP)
    step.settle([
      { type: 'reasoning', text: 'hidden thought' },
      { type: 'text', text: 'answer' },
    ], STAMP + 2_000)
    const rows = step.render(40)
    expect(rows.join('\n')).toContain('✻ Thinking for 2.0s · 1 lines')
    expect(rows.join('\n')).not.toContain('▎')
    expect(rows.join('\n')).not.toContain('hidden thought')
  })
})

describe('StreamingAssistantComponent long-reply fold', () => {
  const body = Array.from({ length: 8 }, (_, index) => `line ${index + 1}`).join('\n')

  it('folds a settled reply past maxMessageLines to a head preview and a disclosure row', () => {
    const step = new StreamingAssistantComponent({ turn: 1, step: 1 }, false, plain, plainMd, 3)
    step.markStart(STAMP)
    step.settle([{ type: 'text', text: body }], STAMP + 2_000)
    const rows = step.render(40).map(row => row.trimEnd())
    expect(rows).toEqual(['', '✦ line 1', '  line 2', '  line 3', '  … +5 lines (click to expand)'])
  })

  it('expands the folded reply when its disclosure row is clicked', () => {
    const step = new StreamingAssistantComponent({ turn: 1, step: 1 }, false, plain, plainMd, 3)
    step.markStart(STAMP)
    step.settle([{ type: 'text', text: body }], STAMP + 2_000)
    const hintRow = step.render(40).findIndex(row => row.includes('click to expand'))
    expect(step.clickTranscriptRow(hintRow, 40)).toBe(true)
    const rows = step.render(40).map(row => row.trimEnd())
    expect(rows).toContain('  line 8')
    expect(rows.join('\n')).not.toContain('click to expand')
    // A click anywhere else is not a disclosure.
    expect(step.clickTranscriptRow(0, 40)).toBe(false)
  })

  it('never folds a streaming reply', () => {
    const step = new StreamingAssistantComponent({ turn: 1, step: 1 }, false, plain, plainMd, 3)
    step.update({ type: 'block-start', index: 0, blockType: 'text' })
    step.update({ type: 'text-delta', index: 0, text: body })
    const rows = step.render(40).map(row => row.trimEnd())
    expect(rows).toContain('  line 8')
    expect(rows.join('\n')).not.toContain('click to expand')
  })

  it('keeps a reply within the budget unfolded', () => {
    const step = new StreamingAssistantComponent({ turn: 1, step: 1 }, false, plain, plainMd, 30)
    step.settle([{ type: 'text', text: 'short answer' }], STAMP + 2_000)
    expect(step.render(40).join('\n')).not.toContain('click to expand')
  })
})

describe('ToolCardComponent header tones', () => {
  it('keeps the whole pending header in the running-tool color', () => {
    const card = toolCard(color, colorMd)
    expect(card.render(80)[1]?.startsWith('\x1b[36m○\x1b[39m \x1b[36mbash')).toBe(true)
  })

  it('settles to a dim header with only the status glyph colored', () => {
    const card = toolCard(color, colorMd)
    card.updateResult(toolResult('output line'))
    expect(card.render(80)[1]?.startsWith(
      `\x1b[32m${TOOL_SETTLED()}\x1b[39m \x1b[2;39mbash`,
    )).toBe(true)
  })

  it('colors a failed settled glyph in the error role', () => {
    const card = toolCard(color, colorMd)
    card.updateResult({
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: CallId('call-1'),
        content: [{ type: 'text', text: 'boom' }],
        isError: true,
      }),
    })
    expect(card.render(80)[1]).toContain(`\x1b[31m${TOOL_SETTLED()}\x1b[39m`)
    expect(card.render(80)[1]).toContain('\x1b[2;39m')
    expect(card.render(80).join('\n')).toContain('\x1b[31mboom')
  })
})

describe('ToolCardComponent semantic cards', () => {
  it('renders plan review as a dedicated plan panel', () => {
    const card = new ToolCardComponent(
      'exit_plan_mode',
      parseArguments('{}'),
      {
        presentCall: () => ({
          card: 'generic',
          kind: 'plan',
          title: 'Implementation',
          content: [{ type: 'text', text: '# Steps\n\n- Verify behavior' }],
        }),
      } as never,
      10,
      2_000,
      plain,
      plainMd,
    )
    const rows = card.render(48).map(row => row.trimEnd())
    expect(rows.join('\n')).toContain('Plan · Implementation · reviewing')
    expect(rows.join('\n')).toContain('Verify behavior')
    expect(card.render(16).every(row => visibleWidth(row) <= 16)).toBe(true)
  })

  it('names delegated work as a subagent and keeps its prompt under the card', () => {
    const card = new ToolCardComponent(
      'subagent',
      parseArguments('{}'),
      {
        presentCall: () => ({
          card: 'generic',
          kind: 'delegate',
          title: 'Delegate parser repair',
          rawInput: 'Inspect the parser and repair the failing cases.',
        }),
      } as never,
      10,
      2_000,
      plain,
      plainMd,
    )
    const output = card.render(40).map(row => row.trimEnd()).join('\n')
    expect(output).toContain('○ Subagent · parser repair')
    expect(output).toContain('⎿ Inspect the parser and repair the')
  })
})

describe('TodoComponent', () => {
  it('keeps the plan compact until the shared detail view expands it', () => {
    const todo = new TodoComponent(plain)
    todo.update([
      { content: 'Read the narrow layout', status: 'completed' },
      { content: 'Align wrapped content under the gutter', status: 'in_progress' },
      { content: 'Verify the terminal', status: 'pending' },
    ])

    const compact = todo.render(30).map(row => row.trimEnd())
    expect(compact.join('\n')).toContain('Plan 1/3 · Align wrapped')
    expect(compact.join('\n')).not.toContain('Read the narrow layout')

    todo.setExpanded(true)
    const expanded = todo.render(30).map(row => row.trimEnd())
    expect(expanded.join('\n')).toContain('✓ Read the narrow layout')
    expect(expanded.join('\n')).toContain('● Align wrapped content')
    expect(expanded.every(row => visibleWidth(row) <= 30)).toBe(true)
  })
})

describe('ToolCardComponent structured result views', () => {
  const makeCard = (presentResult: () => unknown): ToolCardComponent => new ToolCardComponent(
    'inspect',
    parseArguments('{}'),
    {
      presentCall: () => ({ card: 'generic', title: 'Inspect' }),
      presentResult,
    } as never,
    10,
    2_000,
    plain,
    plainMd,
  )

  it('renders read results with source line numbers and a range summary', () => {
    const card = makeCard(() => ({
      card: 'read',
      path: 'src/a.ts',
      offset: 41,
      lines: [{ number: 41, text: 'const answer = 42' }, { number: 42, text: 'export { answer }' }],
      totalLines: 180,
      lang: 'ts',
    }))
    card.updateResult(toolResult('raw fallback'))
    const output = card.render(80).join('\n')
    expect(output).toContain('41 const answer = 42')
    expect(output).toContain('42 export { answer }')
    expect(output).toContain('Showing 2 of 180 lines · through 42')
    expect(output).not.toContain('raw fallback')
  })

  it('groups search matches by path and reports truncation', () => {
    const card = makeCard(() => ({
      card: 'search',
      shape: 'matches',
      files: [{ path: 'src/a.ts', matches: [{ lineNumber: 7, line: 'TODO refine' }] }],
      truncated: true,
      total: 14,
    }))
    card.updateResult(toolResult('raw search fallback'))
    const output = card.render(80).join('\n')
    expect(output).toContain('src/a.ts')
    expect(output).toContain('7 TODO refine')
    expect(output).toContain('limited result set · 14 total')
  })

  it('renders web search citations from structured sources', () => {
    const card = makeCard(() => ({
      card: 'web',
      kind: 'search',
      answer: 'Summary',
      sources: [{ title: 'Reference', url: 'https://example.test', snippet: 'Useful excerpt' }],
      truncated: false,
    }))
    card.updateResult(toolResult('raw web fallback'))
    const output = card.render(80).join('\n')
    expect(output).toContain('Summary')
    expect(output).toContain('1. Reference')
    expect(output).toContain('https://example.test')
    expect(output).toContain('Useful excerpt')
  })
})

describe('CollapsedToolGroupComponent summary glyph', () => {
  function settle(target: ToolCardComponent): void {
    target.updateResult(toolResult('output line'))
  }

  it('paints the settled glyph in the success color and keeps the counts bold', () => {
    const cards = [toolCard(color, colorMd), toolCard(color, colorMd), toolCard(color, colorMd)]
    for (const card of cards) settle(card)
    const group = new CollapsedToolGroupComponent(cards, color)
    const row = group.render(80)[1] ?? ''
    expect(row).toContain(`\x1b[32m${TOOL_SETTLED()}\x1b[39m`)
    expect(row).toContain('\x1b[1m3\x1b[22m')
  })

  it('keeps the pending glyph dim with the prose', () => {
    const cards = [toolCard(color, colorMd), toolCard(color, colorMd), toolCard(color, colorMd)]
    const group = new CollapsedToolGroupComponent(cards, color)
    const row = group.render(80)[1] ?? ''
    expect(row).toContain('\x1b[2;39m○\x1b[22;39m')
    expect(row).not.toContain('\x1b[32m')
  })
})

describe('markdownTheme code block edge', () => {
  it('draws the ▎ bar on every code row, the language row, and the close', () => {
    const rows = new Markdown('before\n```ts\nconst a = 1\n```\nafter', 0, 0, plainMd)
      .render(80)
      .map(row => row.trimEnd())
    expect(rows).toContain('▎ ts')
    expect(rows).toContain('▎ const a = 1')
    // The otherwise-empty closing fence draws the bare bar.
    expect(rows).toContain('▎')
  })

  it('paints the bar in the dim role when color is on', () => {
    // pi-tui's Markdown pads rows to the render width; trim for the SGR compare.
    const rows = new Markdown('```\nx\n```', 0, 0, colorMd).render(80).map(row => row.trimEnd())
    expect(rows[0]).toBe(color.dim('▎'))
    expect(rows[1]).toBe(`${color.dim('▎')} ${color.code('x')}`)
    expect(rows[2]).toBe(color.dim('▎'))
  })

  it('keeps the language label next to the bar when color is on', () => {
    const rows = new Markdown('```ts\nx\n```', 0, 0, colorMd).render(80).map(row => row.trimEnd())
    expect(rows[0]).toBe(color.dim('▎ ts'))
  })
})
