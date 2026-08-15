import { describe, expect, it } from 'vitest'
import { createCodeHighlighter } from '../src/components/highlight.ts'
import { createPalette } from '../src/components/theme.ts'

/** Poll `condition` until true, at most ~5 s, so tests never hang on a load failure. */
async function until(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 250 && !condition(); attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}

describe('code highlighter', () => {
  it('renders plain rows before the module lands, without flagging when color is off', () => {
    const monochrome = createCodeHighlighter(createPalette(false), false)
    expect(monochrome.highlightCode('const x = 1\n', 'ts')).toEqual(['const x = 1'])
    expect(monochrome.fallbackUsed()).toBe(false)
    const colored = createCodeHighlighter(createPalette(true), true)
    expect(colored.highlightCode('const x = 1\n', 'ts')).toEqual(['const x = 1'])
    expect(colored.fallbackUsed()).toBe(true)
  })

  it('invokes onReady once the module lands after a fallback render', async () => {
    let ready = false
    const palette = createPalette(true)
    const highlighter = createCodeHighlighter(palette, true, () => { ready = true })
    expect(highlighter.highlightCode('// hi', 'ts')).toEqual(['// hi'])
    highlighter.preload()
    await until(() => ready)
    expect(ready).toBe(true)
    const rows = highlighter.highlightCode('// hi', 'ts')
    expect(rows[0]).toContain('// hi')
  })

  it('highlights code with palette-role ANSI and caches identical rows', async () => {
    const palette = createPalette(true)
    const highlighter = createCodeHighlighter(palette, true)
    highlighter.preload()
    await until(() => {
      const rows = highlighter.highlightCode('const x = 1', 'ts')
      return rows[0] !== undefined && rows[0].includes('\x1b')
    })
    const comment = highlighter.highlightCode('// note', 'ts')
    expect(comment[0]).toContain('\x1b[2;39m// note\x1b[22;39m')
    const keyword = highlighter.highlightCode('const x = 1', 'ts')
    expect(keyword[0]).toContain('\x1b[95mconst\x1b[39m')
    // Cache hit: the same (lang, code) pair returns the identical array instance.
    expect(highlighter.highlightCode('const x = 1', 'ts')).toBe(keyword)
    // A palette swap drops cached rows: invalidate forces recompute.
    highlighter.invalidate()
    expect(highlighter.highlightCode('const x = 1', 'ts')).not.toBe(keyword)
  })

  it('passes through missing languages, unknown languages, and oversized blocks', async () => {
    const palette = createPalette(true)
    const highlighter = createCodeHighlighter(palette, true)
    highlighter.preload()
    await until(() =>  highlighter.highlightCode('const x = 1', 'ts')[0]?.includes('\x1b'))
    expect(highlighter.highlightCode('plain text', '')).toEqual(['plain text'])
    expect(highlighter.highlightCode('plain text', undefined)).toEqual(['plain text'])
    expect(highlighter.highlightCode('!!!', 'totally-not-a-language')).toEqual(['!!!'])
    const huge = 'x'.repeat(9_000)
    expect(highlighter.highlightCode(huge, 'ts')).toEqual([huge])
  })
})
