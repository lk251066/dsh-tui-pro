import { describe, expect, it, vi } from 'vitest'
import { MemoryBrowserDialog } from '../src/components/dialogs.ts'
import { createPalette } from '../src/components/theme.ts'

/** Color-disabled palette: rows render plain text, so labels assert exactly. */
const plain = createPalette(false, 'dark')

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
