import { describe, expect, it, vi } from 'vitest'
import type { AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions'
import {
  ApprovalDialog,
  ConfirmDialog,
  QuestionDialog,
  contextMeter,
  type ApprovalChoice,
  type QuestionSelection,
} from '../src/components/dialogs.ts'
import { createPalette } from '../src/components/theme.ts'

/** Color-disabled palette: components render plain text, so labels assert exactly. */
const plain = createPalette(false, 'dark')
/** Color-enabled palette: asserts the exact SGR pairs each role emits. */
const color = createPalette(true, 'dark')

function questionDialog(
  question: AskUserQuestionItem,
  done: (selection: QuestionSelection) => void,
  maxVisible = 5,
): QuestionDialog {
  return new QuestionDialog(question, 1, 1, 1, maxVisible, () => 24, plain, done, vi.fn())
}

describe('number-key direct selection', () => {
  it('QuestionDialog single-select: a digit confirms that option', () => {
    const done = vi.fn()
    const dialog = questionDialog({
      id: 'single', question: 'Pick one', options: [{ label: 'Alpha' }, { label: 'Beta' }],
    }, done)
    dialog.render(60)
    dialog.handleInput('2')
    expect(done).toHaveBeenCalledTimes(1)
    expect(done).toHaveBeenCalledWith({ selected: ['Beta'] })
  })

  it('QuestionDialog multi-select: a digit toggles that option\'s checkmark', () => {
    const done = vi.fn()
    const dialog = questionDialog({
      id: 'multi', question: 'Pick many', multiSelect: true,
      options: [{ label: 'One' }, { label: 'Two' }],
    }, done)
    dialog.render(60)
    dialog.handleInput('1')
    dialog.handleInput('2')
    dialog.handleInput('1')
    const midRender = dialog.render(60).join('\n')
    expect(midRender).toContain('[ ] One')
    expect(midRender).toContain('[x] Two')
    dialog.handleInput('\r')
    expect(done).toHaveBeenCalledWith({ selected: ['Two'] })
  })

  it('QuestionDialog: a digit for an option outside the visible window is ignored', () => {
    const done = vi.fn()
    const dialog = questionDialog({
      id: 'windowed', question: 'Pick one', options: [{ label: 'Visible' }, { label: 'Hidden' }],
    }, done, 1)
    dialog.render(60)
    expect(dialog.render(60).join('\n')).toContain('↓ 1 more')
    dialog.handleInput('2')
    expect(done).not.toHaveBeenCalled()
    dialog.handleInput('1')
    expect(done).toHaveBeenCalledWith({ selected: ['Visible'] })
  })

  it('QuestionDialog: digits reach the custom-answer input, not the options', () => {
    const done = vi.fn()
    const dialog = questionDialog({
      id: 'custom', question: 'Choose or type', options: [{ label: 'Default' }],
    }, done)
    dialog.render(60)
    dialog.handleInput('\t')
    dialog.handleInput('1')
    dialog.handleInput('\r')
    expect(done).toHaveBeenCalledWith({ selected: [], custom: '1' })
  })

  it('ApprovalDialog: options carry dim N. prefixes and digits pick them', () => {
    const choose = vi.fn<(choice: ApprovalChoice, feedback?: string) => void>()
    const dialog = new ApprovalDialog(
      'bash', undefined, 'rm -rf /tmp',
      plain, choose, vi.fn(),
    )
    const rendered = dialog.render(64).join('\n')
    expect(rendered).toContain('1. Allow once')
    expect(rendered).toContain('2. Always allow bash this session')
    expect(rendered).toContain('3. Reject')
    dialog.handleInput('2')
    expect(choose).toHaveBeenCalledWith('allow-session')
  })

  it('ApprovalDialog: an out-of-range digit is ignored and Enter still works', () => {
    const choose = vi.fn<(choice: ApprovalChoice, feedback?: string) => void>()
    const dialog = new ApprovalDialog('bash', undefined, undefined, plain, choose, vi.fn())
    dialog.render(64)
    dialog.handleInput('4')
    expect(choose).not.toHaveBeenCalled()
    dialog.handleInput('\r')
    expect(choose).toHaveBeenCalledWith('allow-once')
  })

  it('ApprovalDialog: the numbered prefix renders dim beside the plain label', () => {
    const dialog = new ApprovalDialog('bash', undefined, undefined, color, vi.fn(), vi.fn())
    expect(dialog.render(64).join('\n')).toContain(`${color.dim('1. ')}Allow once`)
  })
})

describe('approval Tab footnote', () => {
  it('Tab opens the footnote line; Enter submits it with the highlighted option', () => {
    const choose = vi.fn<(choice: ApprovalChoice, feedback?: string) => void>()
    const dialog = new ApprovalDialog('bash', undefined, undefined, plain, choose, vi.fn())
    dialog.render(64)
    dialog.handleInput('\t')
    expect(dialog.render(64).join('\n')).toContain('tell the agent what to do differently')
    // Digits join the draft while the footnote input is focused.
    dialog.handleInput('1')
    dialog.handleInput('use a sandbox')
    dialog.handleInput('\r')
    expect(choose).toHaveBeenCalledWith('allow-once', '1use a sandbox')
  })

  it('an empty footnote submits the highlighted option unchanged', () => {
    const choose = vi.fn<(choice: ApprovalChoice, feedback?: string) => void>()
    const dialog = new ApprovalDialog('bash', undefined, undefined, plain, choose, vi.fn())
    dialog.render(64)
    dialog.handleInput('\x1b[B') // ↓ highlights the session grant
    dialog.handleInput('\x1b[B') // ↓ highlights Reject
    dialog.handleInput('\t')
    dialog.handleInput('\r')
    expect(choose).toHaveBeenCalledWith('reject', undefined)
  })

  it('Esc returns to the options and keeps the draft for a later Tab', () => {
    const choose = vi.fn<(choice: ApprovalChoice, feedback?: string) => void>()
    const dialog = new ApprovalDialog('bash', undefined, undefined, plain, choose, vi.fn())
    dialog.render(64)
    dialog.handleInput('\t')
    dialog.handleInput('wait')
    dialog.handleInput('\x1b')
    expect(choose).not.toHaveBeenCalled()
    dialog.handleInput('\t')
    expect(dialog.render(64).join('\n')).toContain('> wait')
    dialog.handleInput('\r')
    expect(choose).toHaveBeenCalledWith('allow-once', 'wait')
  })

  it('a digit in footnote mode edits the draft instead of picking an option', () => {
    const choose = vi.fn<(choice: ApprovalChoice, feedback?: string) => void>()
    const dialog = new ApprovalDialog('bash', undefined, undefined, plain, choose, vi.fn())
    dialog.render(64)
    dialog.handleInput('\t')
    dialog.handleInput('3')
    expect(choose).not.toHaveBeenCalled()
    dialog.handleInput('\r')
    expect(choose).toHaveBeenCalledWith('allow-once', '3')
  })
})

describe('risk confirmation defaults to the safe item', () => {
  it('Enter lands on the safe No item unless the risky item is focused explicitly', () => {
    const safe = vi.fn()
    const dialog = new ConfirmDialog('Full access', 'single-line message', plain, safe, vi.fn())
    dialog.render(64)
    dialog.handleInput('\r')
    expect(safe).toHaveBeenCalledTimes(1)
    expect(safe).toHaveBeenCalledWith(false)

    const risky = vi.fn()
    const confirmFocused = new ConfirmDialog('Full access', 'single-line message', plain, risky, vi.fn(), 1)
    confirmFocused.render(64)
    confirmFocused.handleInput('\r')
    expect(risky).toHaveBeenCalledWith(true)
  })

  it('Escape still resolves the confirmation safely', () => {
    const choose = vi.fn()
    const dialog = new ConfirmDialog('Full access', 'single-line message', plain, choose, vi.fn())
    dialog.handleInput('\x1b')
    expect(choose).toHaveBeenCalledWith(false)
  })

  it('a two-line message renders an error-colored WARNING title over a warning body', () => {
    const dialog = new ConfirmDialog(
      'Full access',
      'WARNING: danger-full-access disables all permission checks\nThe agent can run any command.',
      color, vi.fn(), vi.fn(),
    )
    const rendered = dialog.render(64).join('\n')
    expect(rendered).toContain(`${color.error('WARNING: danger-full-access disables all permission checks')}`)
    expect(rendered).toContain(`${color.warning('The agent can run any command.')}`)
  })
})

describe('context meter percent follows the pressure tier', () => {
  it('keeps the bar-only default and colors the optional percent with the bar', () => {
    expect(contextMeter(50, color)).not.toContain('%')
    expect(contextMeter(50, color, { percent: true })).toContain(color.dim('50%'))
    expect(contextMeter(60, color, { percent: true })).toContain(color.warning('60%'))
    expect(contextMeter(85, color, { percent: true })).toContain(color.error('85%'))
  })

  it('applies the 60/85 thresholds and shares the tier color with the bar fill', () => {
    expect(contextMeter(59.9, color, { percent: true })).toContain(color.dim('60%'))
    expect(contextMeter(60, color, { percent: true })).toContain(color.warning('60%'))
    expect(contextMeter(84.9, color, { percent: true })).toContain(color.warning('85%'))
    expect(contextMeter(85, color, { percent: true })).toContain(color.error('85%'))
    // The number and the filled cells carry the same tier color.
    expect(contextMeter(90, color, { percent: true })).toContain(color.error('█'.repeat(9)))
  })
})
