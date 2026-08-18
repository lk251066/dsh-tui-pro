import { describe, expect, it } from 'vitest'
import {
  ASSISTANT_GLYPH,
  RESULT_CONTINUATION,
  RESULT_MARKER,
  shortcutHint,
  THINKING_GLYPH,
  TOOL_SETTLED,
  USER_GLYPH,
} from '../src/components/figures.ts'

describe('figures', () => {
  it('branches the settled tool glyph by platform', () => {
    // macOS terminal fonts render ⏺ level with the title; Windows and Linux
    // fonts sit it above the line, so those platforms fall back to ●.
    expect(TOOL_SETTLED('darwin')).toBe('⏺')
    expect(TOOL_SETTLED('win32')).toBe('●')
    expect(TOOL_SETTLED('linux')).toBe('●')
  })

  it("defaults to the running platform's glyph", () => {
    expect(TOOL_SETTLED()).toBe(process.platform === 'darwin' ? '⏺' : '●')
  })

  it('formats shortcut hints with and without parentheses', () => {
    expect(shortcutHint('ctrl+o', 'expand')).toBe('(ctrl+o to expand)')
    expect(shortcutHint('ctrl+r', 'expand', {})).toBe('(ctrl+r to expand)')
    expect(shortcutHint('ctrl+o', 'expand', { parens: false })).toBe('ctrl+o to expand')
  })

  it('pins the shared marker glyphs', () => {
    expect(RESULT_MARKER).toBe('  ⎿ ')
    expect(RESULT_CONTINUATION).toBe('    ')
    expect(USER_GLYPH).toBe('❯')
    expect(ASSISTANT_GLYPH).toBe('✦')
    expect(THINKING_GLYPH).toBe('✻')
  })
})
