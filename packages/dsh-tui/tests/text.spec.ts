import { describe, expect, it } from 'vitest'
import { visibleWidth } from '@earendil-works/pi-tui'
import { padToWidth } from '../src/components/text.ts'

describe('padToWidth', () => {
  it('right-pads a short row to the target width', () => {
    expect(padToWidth('abc', 6)).toBe('abc   ')
  })

  it('returns a row already at width unchanged', () => {
    expect(padToWidth('abcdef', 6)).toBe('abcdef')
  })

  it('clips an overflowing row without an ellipsis', () => {
    // pi-tui's truncateToWidth appends an SGR reset to the clipped row.
    expect(padToWidth('abcdefgh', 6)).toBe('abcdef\x1b[0m')
  })

  it('measures ANSI-styled rows by their visible width', () => {
    const styled = '\x1b[1;32mabc\x1b[22;39m'
    const padded = padToWidth(styled, 6)
    expect(visibleWidth(padded)).toBe(6)
    expect(padded.startsWith(styled)).toBe(true)
    // An over-wide styled row clips by visible cells, keeping the SGR intact.
    expect(visibleWidth(padToWidth('\x1b[32mabcdefgh\x1b[39m', 6))).toBe(6)
  })

  it('treats a non-positive width as zero columns', () => {
    expect(padToWidth('abc', 0)).toBe('')
  })
})
