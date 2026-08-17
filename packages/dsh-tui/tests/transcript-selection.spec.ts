import { describe, expect, it } from 'vitest'
import {
  highlightTranscriptLine,
  selectedTranscriptText,
  stripTerminalControls,
  type TranscriptSelection,
} from '../src/components/transcript-selection.ts'
import { createPalette } from '../src/components/theme.ts'

const palette = createPalette(true, 'dark')

describe('transcript selection helpers', () => {
  it('copies multi-line ANSI text without controls or right padding', () => {
    const selection: TranscriptSelection = {
      anchor: { line: 0, column: 1 },
      focus: { line: 2, column: 4 },
    }
    const lines = [
      '\x1b[95malpha\x1b[39m   ',
      '中文',
      '\x1b[32mbeta\x1b[39m',
    ]

    expect(selectedTranscriptText(lines, selection)).toBe('lpha\n中文\nbeta')
  })

  it('orders a backwards selection', () => {
    expect(selectedTranscriptText(['first', 'second'], {
      anchor: { line: 1, column: 3 },
      focus: { line: 0, column: 2 },
    })).toBe('rst\nsec')
  })

  it('preserves intentionally selected blank transcript rows', () => {
    expect(selectedTranscriptText(['alpha', '', 'beta'], {
      anchor: { line: 0, column: 2 },
      focus: { line: 2, column: 2 },
    })).toBe('pha\n\nbe')
  })

  it('snaps a selection through both cells of a wide grapheme', () => {
    expect(selectedTranscriptText(['A中B'], {
      anchor: { line: 0, column: 2 },
      focus: { line: 0, column: 3 },
    })).toBe('中')
  })

  it('highlights selected cells without dropping inner ANSI styles', () => {
    const line = '\x1b[32mgreen text\x1b[39m'
    const highlighted = highlightTranscriptLine(line, 0, {
      anchor: { line: 0, column: 0 },
      focus: { line: 0, column: 5 },
    }, palette)

    expect(highlighted).toContain('\x1b[7m')
    expect(highlighted).toContain('\x1b[32m')
    expect(stripTerminalControls(highlighted)).toBe('green text')
  })
})
