import { describe, expect, it, vi } from 'vitest'
import { CURSOR_MARKER, Editor, TUI, visibleWidth, type Terminal } from '@earendil-works/pi-tui'
import { FramedEditorComponent } from '../src/components/framed-editor.ts'

/**
 * These suites drive the real pi-tui Editor (a `TUI` over a null terminal is
 * all its constructor and render need — same recipe as the render experiments
 * this spec's recognition rule was derived from). Only the conservative
 * fallback edges, unreachable with a well-formed editor, use minimal stubs;
 * live terminal behaviour is separately smoke-checked under ConPTY.
 */

class NullTerminal implements Terminal {
  columns = 88
  rows = 32
  kittyProtocolActive = false
  start(): void {}
  stop(): void {}
  write(): void {}
  moveBy(): void {}
  hideCursor(): void {}
  showCursor(): void {}
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void {}
  setTitle(): void {}
  setProgress(): void {}
}

const SUGGESTIONS = [
  { value: '/help', label: 'help', description: 'Show help' },
  { value: '/model', label: 'model', description: 'Pick model' },
  { value: '/plan', label: 'plan', description: 'Plan mode' },
]

const identity = (text: string): string => text

function createEditor(focused: boolean): { framed: FramedEditorComponent; editor: Editor } {
  const tui = new TUI(new NullTerminal())
  const editor = new Editor(tui, {
    borderColor: identity,
    selectList: {
      selectedPrefix: identity,
      selectedText: identity,
      description: identity,
      scrollInfo: identity,
      noMatch: identity,
    },
  }, {
    paddingX: 1,
    frame: 'none',
    prompt: { first: 'dsh > ', continuation: '      ' },
  })
  editor.focused = focused
  editor.setAutocompleteProvider({
    getSuggestions: async (lines, cursorLine, cursorCol) => {
      const before = (lines[cursorLine] ?? '').slice(0, cursorCol)
      return /^\/\w*$/.test(before) ? { prefix: before, items: SUGGESTIONS } : null
    },
    applyCompletion: () => {
      throw new Error('selection is not exercised here')
    },
  })
  return { framed: new FramedEditorComponent(editor), editor }
}

/** Let the editor's 0–20 ms autocomplete debounce and request settle. */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 40))
}

const top = (width: number): string => `╭${'─'.repeat(width - 2)}╮`
const bottom = (width: number): string => `╰${'─'.repeat(width - 2)}╯`

describe('FramedEditorComponent autocomplete dropdown split', () => {
  it('renders the dropdown below the bottom border, unwrapped, while the input row stays framed with its cursor marker', async () => {
    const { framed, editor } = createEditor(true)
    editor.handleInput('/')
    await settle()
    const rows = framed.render(80)
    // top border, one framed content row, bottom border, three dropdown rows
    expect(rows).toHaveLength(6)
    expect(rows[0]).toBe(top(80))
    expect(rows[1]).toMatch(/^│ {2}dsh > \//)
    expect(rows[1]).toContain(CURSOR_MARKER)
    expect(rows[1].endsWith('│')).toBe(true)
    expect(visibleWidth(rows[1])).toBe(80)
    expect(rows[2]).toBe(bottom(80))
    // Selected row: frame inset (2) + editor padding (1) + prompt width (6)
    // before the `→ ` marker — aligned with the text it completes.
    expect(rows[3]).toMatch(/^ {9}→ help/)
    expect(rows[4]).toMatch(/^ {11}model/)
    expect(rows[5]).toMatch(/^ {11}plan/)
    for (const row of [rows[3], rows[4], rows[5]]) {
      expect(row).not.toContain('│')
      expect(row).not.toContain(CURSOR_MARKER)
    }
  })

  it('splits the dropdown out even while unfocused, where only the reverse-video fake cursor marks the content row', async () => {
    const { framed, editor } = createEditor(false)
    editor.handleInput('/')
    await settle()
    const rows = framed.render(80)
    expect(rows).toHaveLength(6)
    expect(rows[1]).toMatch(/^│ {2}dsh > \//)
    expect(rows[1]).toContain('\x1b[7m')
    expect(rows.join('\n')).not.toContain(CURSOR_MARKER)
    expect(rows[2]).toBe(bottom(80))
    expect(rows[3]).toMatch(/^ {9}→ help/)
  })

  it('keeps every scrolled continuation row framed when the cursor sits above them with the dropdown open', async () => {
    const { framed, editor } = createEditor(true)
    // 11 lines of content (9 visible on the 32-row terminal), cursor walked
    // back to line 0, slash token completed there via Tab. The continuation
    // rows share the dropdown's all-space prefix — a shape walk would swallow
    // them; the list-count split must not.
    for (let index = 0; index < 11; index++) {
      editor.handleInput(`l${index}`)
      if (index < 10) editor.handleInput('\n')
    }
    for (let step = 0; step < 10; step++) editor.handleInput('\x1b[A')
    editor.handleInput('\x1b[H')
    editor.handleInput('/')
    editor.handleInput('\t')
    await settle()
    expect(editor.isShowingAutocomplete()).toBe(true)
    const rows = framed.render(80)
    // 9 content rows + the `↓ 2 more` indicator stay framed…
    expect(rows).toHaveLength(15)
    for (const row of rows.slice(1, 11)) expect(row.startsWith('│')).toBe(true)
    expect(rows[10]).toContain('↓ 2 more')
    expect(rows[10]).toContain('│')
    // …the bottom border closes the frame before the dropdown rows appear.
    expect(rows[11]).toBe(bottom(80))
    expect(rows[12]).toMatch(/^ {9}→ help/)
    expect(rows[13]).toMatch(/^ {11}model/)
    expect(rows[14]).toMatch(/^ {11}plan/)
    for (const row of [rows[12], rows[13], rows[14]]) {
      expect(row).not.toContain('│')
    }
  })

  it('frames everything when no dropdown is active, including after escape cancels one', async () => {
    const plain = createEditor(true)
    plain.editor.handleInput('hello')
    await settle()
    expect(plain.framed.render(80)).toHaveLength(3)

    const cancelled = createEditor(true)
    cancelled.editor.handleInput('/')
    await settle()
    cancelled.editor.handleInput('\x1b')
    await settle()
    const rows = cancelled.framed.render(80)
    expect(rows).toHaveLength(3)
    expect(rows[2]).toBe(bottom(80))
    expect(rows[1]).toMatch(/^│ {2}dsh > \//)
  })

  it('passes the editor rows through untouched below the minimum framed width', async () => {
    const { framed, editor } = createEditor(true)
    editor.handleInput('/')
    await settle()
    const rendered = framed.render(8).join('\n')
    expect(rendered).not.toContain('╭')
    expect(rendered).not.toContain('╰')
    expect(rendered).not.toContain('│')
  })

  it('delegates invalidation to the wrapped editor', () => {
    const { framed, editor } = createEditor(true)
    const spy = vi.spyOn(editor, 'invalidate')
    framed.invalidate()
    expect(spy).toHaveBeenCalledOnce()
  })

  it('falls back to framing everything when the count source is missing or untrustworthy', () => {
    const base = {
      borderColor: identity,
      invalidate: () => {},
      isShowingAutocomplete: () => true,
      getPaddingX: () => 1,
    }
    const frame = (stub: object, expectedFramed: number): string[] => {
      const rows = new FramedEditorComponent(stub as unknown as Editor).render(80)
      expect(rows).toHaveLength(expectedFramed + 2)
      expect(rows[0]).toBe(top(80))
      expect(rows[rows.length - 1]).toBe(bottom(80))
      return rows
    }

    // Dropdown flagged but no live list to count from: unrecognizable.
    frame({
      ...base,
      render: () => [' dsh > /', '       → help', '         model'],
    }, 3)

    // Count equals the row total (no content row would remain): conservative.
    frame({
      ...base,
      promptWidth: 6,
      autocompleteList: { render: () => ['→ help', '  model'] },
      render: () => ['       → help', '         model'],
    }, 2)

    // A candidate row without the dropdown's leading-space shape…
    frame({
      ...base,
      promptWidth: 6,
      autocompleteList: { render: () => ['→ help'] },
      render: () => [' dsh > /', ' x'],
    }, 2)

    // …or carrying the fake cursor is content miscounted as dropdown.
    frame({
      ...base,
      promptWidth: 6,
      autocompleteList: { render: () => ['→ help'] },
      render: () => [' dsh > /', '       → he\x1b[7m!\x1b[0mlp'],
    }, 2)
  })
})
