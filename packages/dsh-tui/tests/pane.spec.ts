import { describe, expect, it, vi } from 'vitest'
import {
  ApprovalDialog,
  ConfirmDialog,
  DetailsDialog,
  ModelDialog,
  StaticDialog,
  ThemeDialog,
} from '../src/components/dialogs.ts'
import { createPalette } from '../src/components/theme.ts'

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

  it('DetailsDialog: single top rule instead of the rounded frame', () => {
    const dialog = new DetailsDialog('collapsed', false, plain, vi.fn(), vi.fn())
    const joined = dialog.render(60).join('\n')
    expect(joined).toContain('Transcript details')
    expect(joined).toContain('─'.repeat(60))
    expect(joined).not.toContain('╭')
    expect(joined).not.toContain('╰')
  })

  it('ThemeDialog: single top rule instead of the rounded frame', () => {
    const dialog = new ThemeDialog(
      [{ name: 'deepseek', description: 'Adaptive', dark: false }],
      'deepseek',
      plain,
      vi.fn(),
      vi.fn(),
    )
    const joined = dialog.render(60).join('\n')
    expect(joined).toContain('Theme')
    expect(joined).toContain('─'.repeat(60))
    expect(joined).not.toContain('╭')
    expect(joined).not.toContain('╰')
  })

  it('the rule takes the accent color and the title is bold', () => {
    const dialog = new StaticDialog('Context', ['body'], color, vi.fn())
    const lines = dialog.render(60)
    expect(lines[1]).toBe(color.bold('Context'))
    expect(lines[2]).toBe(color.accent('─'.repeat(60)))
  })
})

describe('strong-interruption dialogs keep the rounded frame', () => {
  it('ModelDialog renders the round border', () => {
    const dialog = new ModelDialog(
      [{ provider: 'deepseek', model: 'chat', modelName: 'Chat' }],
      undefined,
      5,
      plain,
      vi.fn(),
      vi.fn(),
    )
    const joined = dialog.render(60).join('\n')
    expect(joined).toContain('╭ Select model')
    expect(joined).toContain('╰')
  })

  it('ApprovalDialog renders the round border', () => {
    const dialog = new ApprovalDialog('bash', undefined, 'rm -rf /tmp', plain, vi.fn(), vi.fn())
    const joined = dialog.render(64).join('\n')
    expect(joined).toContain('╭ Approval')
    expect(joined).toContain('╰')
  })

  it('ConfirmDialog renders the round border', () => {
    const dialog = new ConfirmDialog('Full access', 'single-line message', plain, vi.fn(), vi.fn())
    const joined = dialog.render(64).join('\n')
    expect(joined).toContain('╭ Full access')
    expect(joined).toContain('╰')
  })
})
