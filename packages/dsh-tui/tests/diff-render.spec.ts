import { describe, expect, it } from 'vitest'
import {
  DIFF_CONTEXT_LINES,
  DIFF_MAX_RENDER_LINES,
  renderDiff,
  type DiffHighlight,
} from '../src/components/transcript.ts'
import { createPalette } from '../src/components/theme.ts'
import { createCodeHighlighter } from '../src/components/highlight.ts'

// Monochrome rows read as their plain text, so the structural assertions
// (gutter numbers, markers, fold notes) run against a colorless palette; the
// highlighting cases build a colored palette and assert the SGR shapes.
const mono = createPalette(false)
const color = createPalette(true)

/** CSI sequences only; the rows under test carry no OSC hyperlinks. */
const plain = (rows: readonly string[]): string[] => rows.map(row => row.replaceAll(/\x1b\[[0-9;]*[A-Za-z]/g, ''))

/** A fake ready highlighter wrapping every row in one SGR pair. */
const fakeHighlight: DiffHighlight = (code, lang) =>
  code.split('\n').map(line => `\x1b[36m${lang}:${line}\x1b[39m`)

/** A highlighter that renders everything plain (module not ready, color off). */
const plainHighlight: DiffHighlight = code => code.split('\n')

describe('renderDiff line-number gutter', () => {
  it('numbers rows per side: new for added/context, old for removed', () => {
    const rendered = renderDiff(
      { path: 'a.txt', oldText: 'a\nb\nc', newText: 'a\nB\nc\nd' },
      2_000,
      mono,
      true,
    )
    expect(rendered.approximate).toBe(false)
    // jsdiff frames this as one context row then a replace block
    // (`b\nc` → `B\nc\nd`); the counters stay per side either way.
    expect(rendered.added).toBe(3)
    expect(rendered.removed).toBe(2)
    // Gutter width max(4, digits+2) = 4; the marker sits flush after it.
    expect(rendered.lines).toEqual([
      '   1  a',
      '   2- b',
      '   3- c',
      '   2+ B',
      '   3+ c',
      '   4+ d',
    ])
  })

  it('numbers a new file from 1', () => {
    const rendered = renderDiff({ path: 'new.txt', oldText: null, newText: 'x\ny\n' }, 2_000, mono, true)
    expect(rendered.lines).toEqual(['   1+ x', '   2+ y'])
    expect(rendered.added).toBe(2)
    expect(rendered.removed).toBe(0)
    expect(rendered.approximate).toBe(false)
  })

  it('widens the gutter for large line numbers', () => {
    const hundred = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n')
    const rendered = renderDiff({ path: 'big.ts', oldText: null, newText: hundred }, 2_000, mono, true)
    // 100 lines needs 3 digits, so the gutter is max(4, 3+2) = 5 wide.
    expect(rendered.lines[0]).toBe('    1+ line 1')
    expect(rendered.lines[rendered.lines.length - 1]).toMatch(/^\s*100\+ line 100$/)
  })

  it('numbers the whole-side fallback rows from 1 on each side', () => {
    const rendered = renderDiff(
      { path: 'b.txt', oldText: 'old one\nold two', newText: 'new one\nnew two' },
      1,
      mono,
      true,
    )
    expect(rendered.approximate).toBe(true)
    expect(rendered.lines).toEqual([
      '[exact line diff omitted: >1 changed lines]',
      '   1- old one',
      '   2- old two',
      '   1+ new one',
      '   2+ new two',
    ])
    expect(rendered.added).toBe(2)
    expect(rendered.removed).toBe(2)
  })

  it('keeps the path header unless told to skip it', () => {
    const rendered = renderDiff({ path: 'a.txt', oldText: 'a', newText: 'b' }, 2_000, mono)
    expect(rendered.lines[0]).toBe('a.txt')
    expect(rendered.lines).toHaveLength(3)
  })
})

describe('renderDiff context folding', () => {
  it('folds only the middle of a long unchanged run', () => {
    const range = (from: number, to: number): string[] =>
      Array.from({ length: to - from + 1 }, (_, i) => `ctx ${from + i}`)
    // One change framed by 20 unchanged rows above and 10 below; both runs
    // fold to their first and last DIFF_CONTEXT_LINES rows around one note.
    const frame = [...range(1, 20), 'old tail', ...range(21, 30)]
    const oldText = frame.join('\n')
    const newText = [...frame.slice(0, 20), 'new tail', ...frame.slice(21)].join('\n')
    const rendered = renderDiff({ path: 'c.txt', oldText, newText }, 2_000, mono, true)
    expect(rendered.lines).toEqual([
      // 20 context rows above fold to 3 + note + 3 (new-side numbers).
      '   1  ctx 1',
      '   2  ctx 2',
      '   3  ctx 3',
      '      ⋯ 14 unchanged lines',
      '  18  ctx 18',
      '  19  ctx 19',
      '  20  ctx 20',
      // The change itself never folds, with exact side numbers.
      '  21- old tail',
      '  21+ new tail',
      // 10 context rows below fold the same way (new side continues at 22).
      '  22  ctx 21',
      '  23  ctx 22',
      '  24  ctx 23',
      '      ⋯ 4 unchanged lines',
      '  29  ctx 28',
      '  30  ctx 29',
      '  31  ctx 30',
    ])
    // Folded-away rows never render, but the totals stay exact.
    expect(rendered.lines.join('\n')).not.toContain('ctx 10')
    expect(rendered.lines.join('\n')).not.toContain('ctx 25')
    expect(rendered.added).toBe(1)
    expect(rendered.removed).toBe(1)
  })

  it('leaves short context runs unfolded', () => {
    const text = Array.from({ length: 2 * DIFF_CONTEXT_LINES }, (_, i) => `keep ${i + 1}`).join('\n')
    const rendered = renderDiff({ path: 'c.txt', oldText: text, newText: text }, 2_000, mono, true)
    expect(rendered.lines.some(row => row.includes('⋯'))).toBe(false)
    expect(rendered.lines).toHaveLength(2 * DIFF_CONTEXT_LINES)
  })

  it('caps the whole diff at head and tail halves with a fold note', () => {
    // 100 added rows and no context: only the whole-diff cap applies.
    const hundred = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n')
    const rendered = renderDiff({ path: 'big.ts', oldText: null, newText: hundred }, 2_000, mono, true)
    const keep = Math.floor(DIFF_MAX_RENDER_LINES / 2)
    expect(rendered.lines).toHaveLength(keep + 1 + keep)
    // The note aligns under the content column (5-wide gutter + marker + space).
    expect(rendered.lines[keep]).toBe(`       ⋯ ${100 - 2 * keep} lines`)
    expect(rendered.lines[0]).toMatch(/1\+ line 1$/)
    expect(rendered.lines[rendered.lines.length - 1]).toMatch(/100\+ line 100$/)
    // Middle rows are gone, but the exact totals survive the fold.
    expect(rendered.lines.join('\n')).not.toContain('line 50')
    expect(rendered.added).toBe(100)
    expect(rendered.removed).toBe(0)
  })
})

describe('renderDiff syntax highlighting', () => {
  it('colors the marker alone and keeps syntax colors on the content', () => {
    const rendered = renderDiff(
      { path: 'a.ts', oldText: 'x\nkeep', newText: 'y\nkeep' },
      2_000,
      color,
      true,
      fakeHighlight,
    )
    // Gutter dim, marker colored per side, content carries the highlight SGR;
    // the trailing context row keeps its syntax colors undimmed.
    expect(rendered.lines).toEqual([
      `${color.dim('   1')}${color.error('-')} \x1b[36mts:x\x1b[39m`,
      `${color.dim('   1')}${color.success('+')} \x1b[36mts:y\x1b[39m`,
      `${color.dim('   2')}  \x1b[36mts:keep\x1b[39m`,
    ])
    // The whole row is never re-wrapped in one side color.
    expect(rendered.lines[0]).not.toBe(`${color.dim('   1')}${color.error('- \x1b[36mts:x\x1b[39m')}`)
  })

  it('derives the language from the path extension', () => {
    const langs: (string | undefined)[] = []
    const probe: DiffHighlight = (code, lang) => {
      langs.push(lang)
      return code.split('\n')
    }
    // One call per change block: removed and added, both with the extension.
    renderDiff({ path: 'src/only.ts', oldText: 'a', newText: 'b' }, 2_000, mono, true, probe)
    expect(langs).toEqual(['ts', 'ts'])
    // No extension (or only a dotfile prefix) means the hook is never invoked.
    const calls = langs.length
    renderDiff({ path: 'noext', oldText: 'a', newText: 'b' }, 2_000, mono, true, probe)
    renderDiff({ path: '.gitignore', oldText: 'a', newText: 'b' }, 2_000, mono, true, probe)
    expect(langs.length).toBe(calls)
  })

  it('falls back to whole-line side colors when the hook renders plain', () => {
    // A not-yet-loaded (or color-disabled) highlighter returns the rows
    // unchanged; the card then colors marker and content as one span, the
    // pre-highlighter look.
    const rendered = renderDiff(
      { path: 'a.ts', oldText: 'x', newText: 'y' },
      2_000,
      color,
      true,
      plainHighlight,
    )
    expect(rendered.lines).toEqual([
      `${color.dim('   1')}${color.error('- x')}`,
      `${color.dim('   1')}${color.success('+ y')}`,
    ])
  })

  it('falls back when no highlight hook is injected at all', () => {
    const rendered = renderDiff({ path: 'a.ts', oldText: 'x', newText: 'y' }, 2_000, color, true)
    expect(rendered.lines).toEqual([
      `${color.dim('   1')}${color.error('- x')}`,
      `${color.dim('   1')}${color.success('+ y')}`,
    ])
  })

  it('emits no escapes at all when color is off, even through a real highlighter', () => {
    const disabled = createCodeHighlighter(mono, false)
    const rendered = renderDiff(
      { path: 'a.ts', oldText: 'const a = 1', newText: 'const b = 2' },
      2_000,
      mono,
      true,
      disabled.highlightCode,
    )
    expect(rendered.lines.join('\n')).not.toContain('\x1b')
    expect(rendered.lines[0]).toBe('   1- const a = 1')
  })

  it('dims fold notes rather than numbering them', () => {
    const hundred = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n')
    const rendered = renderDiff({ path: 'big.ts', oldText: null, newText: hundred }, 2_000, color, true)
    const keep = Math.floor(DIFF_MAX_RENDER_LINES / 2)
    expect(rendered.lines[keep]).toBe(`${' '.repeat(7)}${color.dim(`⋯ ${100 - 2 * keep} lines`)}`)
  })

  it('renders unhighlighted monochrome rows with no escapes', () => {
    const rendered = renderDiff({ path: 'a.txt', oldText: 'a', newText: 'b' }, 2_000, mono, true)
    expect(rendered.lines).toEqual(['   1- a', '   1+ b'])
    expect(plain(rendered.lines)).toEqual(rendered.lines)
  })
})

describe('renderDiff word-level emphasis', () => {
  it('emphasizes the changed words of a paired -/+ row over the line color', () => {
    const rendered = renderDiff(
      { path: 'a.txt', oldText: 'const a = 1', newText: 'const a = 2' },
      2_000,
      color,
      true,
    )
    // Shared words keep the side's line color (one span per unchanged run);
    // only the changed word takes the bold word role.
    expect(rendered.lines[0]).toBe(
      `${color.dim('   1')}${color.error('- ')}${color.error('const a = ')}${color.diffRemovedWord('1')}`,
    )
    expect(rendered.lines[1]).toBe(
      `${color.dim('   1')}${color.success('+ ')}${color.success('const a = ')}${color.diffAddedWord('2')}`,
    )
    // The plain text still reads as the plain side rows.
    expect(plain(rendered.lines)).toEqual(['   1- const a = 1', '   1+ const a = 2'])
  })

  it('keeps a fully replaced pair in the single line color', () => {
    const rendered = renderDiff(
      { path: 'a.txt', oldText: 'aaa bbb', newText: 'ccc ddd' },
      2_000,
      color,
      true,
    )
    expect(rendered.lines).toEqual([
      `${color.dim('   1')}${color.error('- aaa bbb')}`,
      `${color.dim('   1')}${color.success('+ ccc ddd')}`,
    ])
  })

  it('does not word-diff unpaired rows or the whole-side fallback', () => {
    const added = renderDiff({ path: 'n.txt', oldText: null, newText: 'x\ny\n' }, 2_000, color, true)
    expect(added.lines.join('\n')).not.toContain('1;32')
    const fallback = renderDiff(
      { path: 'b.txt', oldText: 'old one\nold two', newText: 'new one\nnew two' },
      1,
      color,
      true,
    )
    expect(fallback.approximate).toBe(true)
    expect(fallback.lines.join('\n')).not.toContain('1;31')
    expect(fallback.lines.join('\n')).not.toContain('1;32')
  })

  it('word-diffs unchanged plain text when color is off', () => {
    const rendered = renderDiff(
      { path: 'a.txt', oldText: 'const a = 1', newText: 'const a = 2' },
      2_000,
      mono,
      true,
    )
    expect(rendered.lines).toEqual(['   1- const a = 1', '   1+ const a = 2'])
    expect(plain(rendered.lines)).toEqual(rendered.lines)
  })

  it('keeps syntax-highlighted rows on their syntax colors alone', () => {
    const rendered = renderDiff(
      { path: 'a.ts', oldText: 'const a = 1', newText: 'const a = 2' },
      2_000,
      color,
      true,
      fakeHighlight,
    )
    // Highlighted rows never take word segments: marker colored, content SGR.
    expect(rendered.lines[0]).toBe(`${color.dim('   1')}${color.error('-')} \x1b[36mts:const a = 1\x1b[39m`)
    expect(rendered.lines.join('\n')).not.toContain('1;31')
    expect(rendered.lines.join('\n')).not.toContain('1;32')
  })
})
