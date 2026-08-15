import { describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { MemoryBrowserDialog, SessionPickerDialog, type SessionChoice } from '../src/components/dialogs.ts'
import { createPalette } from '../src/components/theme.ts'

/** Color-disabled palette: rows render plain text, so labels assert exactly. */
const plain = createPalette(false, 'dark')

function choices(): SessionChoice[] {
  return [
    { sessionId: SessionId('main'), label: 'main', detail: 'idle · 2 turns', active: true },
    { sessionId: SessionId('session-a'), label: 'session-a', detail: 'running · 1 turn', active: false },
    { sessionId: SessionId('session-b'), label: 'Fix the login bug', detail: 'session-b · idle', active: false },
  ]
}

function picker(
  rows: readonly SessionChoice[] = choices(),
): { dialog: SessionPickerDialog; choose: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } {
  const choose = vi.fn()
  const close = vi.fn()
  return { dialog: new SessionPickerDialog(rows, plain, choose, close), choose, close }
}

describe('SessionPickerDialog', () => {
  it('renders every row numbered, marks the active one, and shows key hints', () => {
    const rendered = picker().dialog.render(72).join('\n')
    expect(rendered).toContain('Sessions')
    expect(rendered).toContain('1. ● main')
    expect(rendered).toContain('2.')
    expect(rendered).toContain('session-a running · 1 turn')
    expect(rendered).toContain('3.')
    expect(rendered).toContain('Fix the login bug')
    expect(rendered).toContain('↑/↓ move • Enter or 1-9 switch • Esc close')
  })

  it('a digit key chooses that rendered row directly', () => {
    const { dialog, choose } = picker()
    dialog.render(72)
    dialog.handleInput('3')
    expect(choose).toHaveBeenCalledTimes(1)
    expect(choose).toHaveBeenCalledWith(expect.objectContaining({ sessionId: SessionId('session-b') }))
  })

  it('a digit beyond the row count is ignored', () => {
    const { dialog, choose } = picker()
    dialog.render(72)
    dialog.handleInput('9')
    expect(choose).not.toHaveBeenCalled()
  })

  it('Enter chooses the highlighted row; arrows wrap around', () => {
    const { dialog, choose } = picker()
    dialog.render(72)
    dialog.handleInput('\x1b[A') // up from row 0 wraps to the last row
    dialog.handleInput('\r')
    expect(choose).toHaveBeenCalledWith(expect.objectContaining({ sessionId: SessionId('session-b') }))
  })

  it('down then Enter chooses the second row', () => {
    const { dialog, choose } = picker()
    dialog.render(72)
    dialog.handleInput('\x1b[B')
    dialog.handleInput('\r')
    expect(choose).toHaveBeenCalledWith(expect.objectContaining({ sessionId: SessionId('session-a') }))
  })

  it('Escape and Ctrl+C close without choosing', () => {
    const first = picker()
    first.dialog.handleInput('\x1b')
    expect(first.close).toHaveBeenCalledTimes(1)
    expect(first.choose).not.toHaveBeenCalled()
    const second = picker()
    second.dialog.handleInput('\x03')
    expect(second.close).toHaveBeenCalledTimes(1)
    expect(second.choose).not.toHaveBeenCalled()
  })

  it('choosing the active row still reports it (the host no-ops the switch)', () => {
    const { dialog, choose } = picker()
    dialog.render(72)
    dialog.handleInput('1')
    expect(choose).toHaveBeenCalledWith(expect.objectContaining({ active: true }))
  })

  it('an empty set renders the alone state instead of an empty list', () => {
    const { dialog } = picker([])
    const rendered = dialog.render(72).join('\n')
    expect(rendered).toContain('No live sessions besides this one.')
    expect(rendered).toContain('Ctrl+N or /new starts one.')
  })

  it('the highlighted row carries the selection caret', () => {
    const { dialog } = picker()
    const initial = dialog.render(72).join('\n')
    expect(initial).toContain('❯')
    dialog.handleInput('\x1b[B')
    const moved = dialog.render(72).join('\n')
    // Both renders have exactly one caret; after moving, the second row owns it.
    expect(initial.match(/❯/gu)?.length).toBe(1)
    const caretRow = moved.split('\n').findIndex(line => line.includes('❯'))
    const secondRow = moved.split('\n').findIndex(line => line.includes('2.'))
    expect(caretRow).toBe(secondRow)
  })
})

describe('MemoryBrowserDialog', () => {
  /** Rows backed by a mutable list, the way the live store feeds the dialog. */
  function browser(rows: Array<{ id: string; label: string; detail: string }>) {
    const close = vi.fn()
    const removed: string[] = []
    const readRows = () => [...rows]
    const dialog = new MemoryBrowserDialog(readRows(), plain,
      async (id: string) => {
        removed.push(id)
        const index = rows.findIndex(row => row.id === id)
        if (index < 0) return false
        rows.splice(index, 1)
        return true
      },
      close,
      readRows)
    return { dialog, close, removed, rows }
  }

  it('renders rows with a selection caret and key hints', () => {
    const { dialog } = browser([{ id: 'm1', label: 'likes lattes', detail: '[#food] updated 2026-08-15 10:00' }])
    const rendered = dialog.render(72).join('\n')
    expect(rendered).toContain('Memories')
    expect(rendered).toContain('❯likes lattes')
    expect(rendered).toContain('↑/↓ move • d delete • r refresh • Esc close')
  })

  it('renders the empty state when the store has nothing', () => {
    const { dialog } = browser([])
    const rendered = dialog.render(72).join('\n')
    expect(rendered).toContain('No long-term memories yet.')
  })

  it('d deletes the highlighted row after arrows move the highlight', async () => {
    const { dialog, removed } = browser([
      { id: 'a', label: 'first', detail: '' },
      { id: 'b', label: 'second', detail: '' },
      { id: 'c', label: 'third', detail: '' },
    ])
    dialog.render(72)
    dialog.handleInput('\x1b[B') // down → second
    dialog.handleInput('\x1b[B') // down → third
    dialog.handleInput('d')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(removed).toEqual(['c'])
    // The highlight clamps onto the new last row.
    const rendered = dialog.render(72).join('\n')
    expect(rendered).toContain('❯second')
    expect(rendered).not.toContain('third')
  })

  it('up wraps to the last row; r re-reads the store; Esc closes', async () => {
    const { dialog, close } = browser([
      { id: 'a', label: 'first', detail: '' },
      { id: 'b', label: 'second', detail: '' },
    ])
    dialog.render(72)
    dialog.handleInput('\x1b[A') // up from row 0 wraps to the last row
    dialog.handleInput('d')
    await new Promise(resolve => setTimeout(resolve, 0))
    dialog.handleInput('r')
    expect(dialog.render(72).join('\n')).toContain('❯first')
    dialog.handleInput('\x1b')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('keystrokes on an empty store are no-ops except refresh and close', () => {
    const { dialog, close, removed } = browser([])
    dialog.handleInput('\x1b[B')
    dialog.handleInput('d')
    dialog.handleInput('r')
    expect(removed).toEqual([])
    dialog.handleInput('\x03')
    expect(close).toHaveBeenCalledTimes(1)
  })
})
