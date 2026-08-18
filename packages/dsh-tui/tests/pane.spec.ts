import { describe, expect, it, vi } from 'vitest'
import {
  ApprovalDialog,
  ConfirmDialog,
  DetailsDialog,
  EffortDialog,
  ModelDialog,
  StaticDialog,
  ThemeDialog,
} from '../src/components/dialogs.ts'
import { createPalette } from '../src/components/theme.ts'
import { stripTerminalControls } from '../src/components/transcript-selection.ts'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'

/** Color-disabled palette: frames render plain text, so glyphs assert exactly. */
const plain = createPalette(false, 'dark')
/** Color-enabled palette: asserts the exact SGR pair the rule and title emit. */
const color = createPalette(true, 'dark')

describe('browse dialogs render the Claude Code pane form', () => {
  it('StaticDialog: a blank row, bold title, and one full-width rule — no border', () => {
    const dialog = new StaticDialog('Context', ['tokens used', 'second row'], plain, () => {}, () => ['refreshed'])
    const lines = dialog.render(60)
    expect(lines[0]).toBe('')
    expect(lines[1]).toBe('Context')
    expect(lines[2]).toBe('─'.repeat(60))
    expect(lines.join('\n')).toContain('  tokens used')
    expect(lines.join('\n')).not.toContain('╭')
    expect(lines.join('\n')).not.toContain('╰')
    expect(lines.join('\n')).not.toContain('│')
  })

  it('DetailsDialog: renders in the bottom interaction area without a frame', () => {
    const dialog = new DetailsDialog('collapsed', false, plain, vi.fn(), vi.fn())
    const joined = dialog.render(60).join('\n')
    expect(joined).toContain('Transcript details')
    expect(joined).not.toContain('╭')
    expect(joined).not.toContain('╰')
    expect(joined).not.toContain('│')
  })

  it('ThemeDialog: renders in the bottom interaction area without a frame', () => {
    const dialog = new ThemeDialog(
      [{ name: 'deepseek', description: 'Adaptive', dark: false }],
      'deepseek',
      plain,
      vi.fn(),
      vi.fn(),
    )
    const joined = dialog.render(60).join('\n')
    expect(joined).toContain('Theme')
    expect(joined).not.toContain('╭')
    expect(joined).not.toContain('╰')
    expect(joined).not.toContain('│')
  })

  it('the rule takes the accent color and the title is bold', () => {
    const dialog = new StaticDialog('Context', ['body'], color, vi.fn())
    const lines = dialog.render(60)
    expect(lines[1]).toBe(color.bold('Context'))
    expect(lines[2]).toBe(color.accent('─'.repeat(60)))
  })

  it('bounds long content and scrolls by line, page, and endpoint keys', () => {
    const close = vi.fn()
    const dialog = new StaticDialog(
      'Diagnostics',
      Array.from({ length: 10 }, (_, index) => `row ${String(index + 1)}`),
      plain,
      close,
      undefined,
      () => 9,
    )

    const first = dialog.render(60)
    expect(first).toHaveLength(9)
    expect(first.join('\n')).toContain('row 1')
    expect(first.join('\n')).toContain('row 4')
    expect(first.join('\n')).not.toContain('row 5')

    dialog.handleInput('\x1b[B')
    expect(dialog.render(60).join('\n')).toContain('row 5')
    dialog.handleInput('\x1b[6~')
    expect(dialog.render(60).join('\n')).toContain('row 9')
    dialog.handleInput('\x1b[F')
    expect(dialog.render(60).join('\n')).toContain('row 10')
    dialog.handleInput('\x1b[H')
    expect(dialog.render(60).join('\n')).toContain('1-4 of 10')

    dialog.handleInput('q')
    expect(close).toHaveBeenCalledOnce()
  })

  it('renders a compact scroll position and persistent navigation footer', () => {
    const dialog = new StaticDialog(
      'Diagnostics',
      ['alpha', 'beta', 'gamma', 'delta', 'epsilon'],
      plain,
      vi.fn(),
      () => ['refreshed'],
      () => 8,
    )

    const visibleLines = dialog.render(72).map(line => stripTerminalControls(line).trimEnd())
    expect(visibleLines).toMatchInlineSnapshot(`
      [
        "",
        "Diagnostics",
        "────────────────────────────────────────────────────────────────────────",
        "  alpha",
        "  beta",
        "  gamma",
        "",
        "  1-3 of 5 · ↑/↓ line · PgUp/PgDn page · Home/End · r refresh · Esc/q",
      ]
    `)
  })
})

describe('built-in choices use the unframed bottom interaction form', () => {
  const expectBottomInteraction = (joined: string, title: string): void => {
    expect(joined).toContain(`  ${title}`)
    expect(joined).not.toContain('╭')
    expect(joined).not.toContain('╰')
    expect(joined).not.toContain('│')
  }

  it('ModelDialog renders without popup chrome', () => {
    const dialog = new ModelDialog(
      [{ provider: 'deepseek', model: 'chat', modelName: 'Chat' }],
      undefined,
      5,
      plain,
      vi.fn(),
      vi.fn(),
    )
    const joined = dialog.render(60).join('\n')
    expectBottomInteraction(joined, 'Select model')
  })

  it('EffortDialog renders the current model and choices without popup chrome', () => {
    const dialog = new EffortDialog(
      'deepseek/chat',
      {
        efforts: [
          { id: ReasoningEffortId('low'), name: 'Low' },
          { id: ReasoningEffortId('high'), name: 'High' },
        ],
        defaultEffort: ReasoningEffortId('low'),
      },
      undefined,
      plain,
      vi.fn(),
      vi.fn(),
    )
    const joined = dialog.render(64).join('\n')
    expectBottomInteraction(joined, 'Reasoning effort · deepseek/chat')
    expect(joined).toContain('Low')
    expect(joined).toContain('current')
  })

  it('ApprovalDialog renders without popup chrome', () => {
    const dialog = new ApprovalDialog('bash', undefined, 'rm -rf /tmp', plain, vi.fn(), vi.fn())
    const joined = dialog.render(64).join('\n')
    expectBottomInteraction(joined, 'Approval')
  })

  it('ConfirmDialog renders without popup chrome', () => {
    const dialog = new ConfirmDialog('Full access', 'single-line message', plain, vi.fn(), vi.fn())
    const joined = dialog.render(64).join('\n')
    expectBottomInteraction(joined, 'Full access')
  })
})
