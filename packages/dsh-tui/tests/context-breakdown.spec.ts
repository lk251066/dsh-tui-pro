import { describe, expect, it } from 'vitest'
import { contextLines, contextSegmentCells, type InsightsDeps } from '../src/chat/insights.ts'
import { contextMeter, diagnosticMeter, formatDiagnosticNumber } from '../src/components/dialogs.ts'
import { createPalette } from '../src/components/theme.ts'

/** Color-disabled palette: rows render plain text, so shapes assert exactly. */
const plain = createPalette(false, 'dark')
/** Color-enabled palette: asserts the exact SGR pairs each segment emits. */
const color = createPalette(true, 'dark')

/** Strip SGR sequences to measure a rendered row's visible width. */
const stripAnsi = (text: string): string => text.replace(/\x1b\[[0-9;]*m/gu, '')

/**
 * Minimal InsightsDeps: a sessionProjections service snapshotting `values`
 * (`undefined` mounts no service at all) and a token meter reporting
 * `totalTokens` when no pressure projection supplies the used count.
 */
function deps(values?: Record<string, unknown>, totalTokens = 0): InsightsDeps {
  return {
    ctx: {
      get: (key: string) => key === 'sessionProjections' && values !== undefined
        ? { snapshot: () => ({ values }) }
        : undefined,
      tokenMeter: { measure: () => ({ totalTokens }) },
    },
    agent: { session: { id: 'session' } },
  } as unknown as InsightsDeps
}

describe('contextSegmentCells — largest-remainder allocation', () => {
  it('splits an even composition into equal segments over its used cells', () => {
    expect(contextSegmentCells({ system: 40, tools: 40, messages: 40 }, 200))
      .toEqual({ system: 4, tools: 4, messages: 4, free: 8 })
  })

  it('awards flooring-lost cells to the largest fractional remainders', () => {
    // Used part is 2 cells (9 of 90); exact quotas 1.11/0.67/0.22 floor to
    // 1/0/0 and the leftover cell goes to tools' larger remainder.
    expect(contextSegmentCells({ system: 5, tools: 3, messages: 1 }, 90))
      .toEqual({ system: 1, tools: 1, messages: 0, free: 18 })
  })

  it('fills the whole bar when the window is fully used, summing to 20 cells', () => {
    // Three equal weights over 20 cells: exact 6.67 each floors to 6/6/6 and
    // the two leftovers tie on remainder, broken toward the earlier category.
    expect(contextSegmentCells({ system: 10, tools: 10, messages: 10 }, 30))
      .toEqual({ system: 7, tools: 7, messages: 6, free: 0 })
  })

  it('clamps an over-window composition to a full bar with no free cells', () => {
    expect(contextSegmentCells({ system: 60, tools: 30, messages: 30 }, 100))
      .toEqual({ system: 10, tools: 5, messages: 5, free: 0 })
  })

  it('renders an all-free bar for a zero composition or an unknown window', () => {
    expect(contextSegmentCells({ system: 0, tools: 0, messages: 0 }, 100))
      .toEqual({ system: 0, tools: 0, messages: 0, free: 20 })
    expect(contextSegmentCells({ system: 50, tools: 50, messages: 50 }, 0))
      .toEqual({ system: 0, tools: 0, messages: 0, free: 20 })
  })

  it('never loses cells: the four segments always sum to the bar width', () => {
    const cases: Array<[{ system: number; tools: number; messages: number }, number]> = [
      [{ system: 12345, tools: 3000, messages: 5000 }, 100000],
      [{ system: 0, tools: 5000, messages: 0 }, 10000],
      [{ system: 999, tools: 1, messages: 0 }, 1000],
      [{ system: 1, tools: 1, messages: 1 }, 7],
      [{ system: 100, tools: 0, messages: 0 }, 50],
      [{ system: 33333, tools: 33333, messages: 33334 }, 100000],
    ]
    for (const [parts, window] of cases) {
      const cells = contextSegmentCells(parts, window)
      expect(cells.system + cells.tools + cells.messages + cells.free).toBe(20)
      expect(Math.min(cells.system, cells.tools, cells.messages, cells.free)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('/context segmented bar and legend', () => {
  // Used 20,345 of a 100,000 window; composition 12,345/3,000/5,000 claims 4
  // bar cells (largest remainder 2/1/1) and leaves 16 free.
  const values = {
    contextPressure: { projectedTokens: 20345, contextWindow: 100000 },
    contextBreakdown: { systemTokens: 12345, toolsTokens: 3000, messageTokens: 5000 },
  }

  it('renders one 20-cell segmented bar after the meters, each segment in its role color', () => {
    const lines = contextLines(deps(values), color)
    expect(lines[2]).toBe('')
    expect(lines[3]).toBe(
      color.accent('██') + color.warning('█') + color.success('█') + color.dim('·'.repeat(16)),
    )
    // Pin the actual SGR opens: system accent 95, tools warning 33, messages
    // success 32, free dim 2;39 — independent of the palette implementation.
    expect(lines[3]).toContain('\x1b[95m██')
    expect(lines[3]).toContain('\x1b[33m█\x1b[39m')
    expect(lines[3]).toContain('\x1b[32m█\x1b[39m')
    expect(lines[3]).toContain(`\x1b[2;39m${'·'.repeat(16)}\x1b[22;39m`)
    expect(stripAnsi(lines[3] as string)).toBe('████' + '·'.repeat(16))
  })

  it('renders legend rows with two-cell swatches and composition-based percentages', () => {
    const lines = contextLines(deps(values), color)
    expect(lines[4]).toBe(`${color.accent('██')} system  ${formatDiagnosticNumber(12345)} (61%)`)
    expect(lines[5]).toBe(`${color.warning('██')} tools   ${formatDiagnosticNumber(3000)} (15%)`)
    expect(lines[6]).toBe(`${color.success('██')} messages ${formatDiagnosticNumber(5000)} (25%)`)
    expect(lines[7]).toBe(color.dim(`·· free    ${formatDiagnosticNumber(79655)} (80%)`))
  })

  it('keeps the pressure header, both meters, and the heuristic disclaimer', () => {
    const lines = contextLines(deps(values), color)
    expect(lines[0]).toBe(color.bold('~20,345 / 100,000 · 20%'))
    expect(lines[1]).toBe(`${contextMeter(20.345, color)} ${diagnosticMeter(20.345, color)}`)
    expect(lines[8]).toBe('')
    expect(lines[9]).toBe(color.dim('Heuristic composition — proportions are approximate.'))
    expect(lines).toHaveLength(10)
  })

  it('renders the same shapes without any escapes on a color-disabled palette', () => {
    const lines = contextLines(deps(values), plain)
    expect(lines[3]).toBe('████' + '·'.repeat(16))
    expect(lines[4]).toBe('██ system  12,345 (61%)')
    expect(lines[7]).toBe('·· free    79,655 (80%)')
    expect(lines.join('\n')).not.toContain('\x1b')
  })

  it('omits empty segments instead of emitting empty color spans', () => {
    // Tools and messages are too small to earn a cell (0.0001 exact quotas),
    // so their segments vanish entirely rather than opening a color to close
    // it over nothing.
    const skewed = {
      contextPressure: { projectedTokens: 100002, contextWindow: 200000 },
      contextBreakdown: { systemTokens: 100000, toolsTokens: 1, messageTokens: 1 },
    }
    const lines = contextLines(deps(skewed), color)
    expect(lines[3]).toBe(color.accent('█'.repeat(10)) + color.dim('·'.repeat(10)))
    expect(lines[3]).not.toContain('\x1b[33m')
    expect(lines[3]).not.toContain('\x1b[32m')
  })

  it('fills all 20 cells with no free fill when the composition exceeds the window', () => {
    const overflowing = {
      contextPressure: { projectedTokens: 150000, contextWindow: 100000 },
      contextBreakdown: { systemTokens: 60000, toolsTokens: 30000, messageTokens: 60000 },
    }
    const lines = contextLines(deps(overflowing), color)
    expect(lines[0]).toBe(color.bold('~150,000 / 100,000 · 100%'))
    expect(lines[3]).toBe(
      color.accent('█'.repeat(8)) + color.warning('█'.repeat(4)) + color.success('█'.repeat(8)),
    )
    expect(lines[7]).toBe(color.dim('·· free    0 (0%)'))
  })
})

describe('/context fallbacks', () => {
  it('without the projections service, reports played tokens over an unknown window', () => {
    expect(contextLines(deps(undefined, 1234), color))
      .toEqual(['1,234 tokens in play · context window unknown'])
  })

  it('without a breakdown projection, keeps only the header and meters', () => {
    const lines = contextLines(deps({ contextPressure: { projectedTokens: 1000, contextWindow: 128000 } }), color)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(color.bold('~1,000 / 128,000 · 1%'))
    expect(lines.join('\n')).not.toContain('Heuristic')
    expect(lines.join('\n')).not.toContain('free')
  })
})
