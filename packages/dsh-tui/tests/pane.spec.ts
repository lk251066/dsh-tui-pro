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
