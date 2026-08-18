import { describe, expect, it } from 'vitest'
import { WorkingLineComponent } from '../src/components/working-line.ts'
import { createPalette } from '../src/components/theme.ts'

/** Fixed render clock so elapsed time and stall gaps are exact in assertions. */
const NOW = 1_700_000_000_000

/** The dim and warning SGR opens a `createPalette(true)` (dark) line carries. */
const DIM_SGR = '\x1b[2;39m'
const WARNING_SGR = '\x1b[33m'
const stripSgr = (text: string): string => text.replaceAll(/\x1b\[[0-9;]*m/gu, '')

function makeLine(): WorkingLineComponent {
  return new WorkingLineComponent(createPalette(true), () => NOW)
}

describe('working line', () => {
  it('renders nothing while idle', () => {
    const line = makeLine()
    line.update(true, NOW - 1000, 'Reading src/foo.ts', '⠋', { verb: 'Pondering' })
    line.update(false, undefined, undefined, undefined)
    expect(line.render(80)).toEqual([])
  })

  it('keeps the legacy four-argument call shape working', () => {
    const line = makeLine()
    line.update(true, NOW - 1500, undefined, '⠙')
    const [row] = line.render(80)
    expect(row).toContain(DIM_SGR)
    expect(stripSgr(row)).toContain('⠙ Thinking… · 1.5s')
    expect(row).not.toContain('↓')
  })

  it('shows the turn verb and elapsed time between tools', () => {
    const line = makeLine()
    line.update(true, NOW - 2000, undefined, '⠙', { verb: 'Pondering' })
    const [row] = line.render(80)
    expect(stripSgr(row)).toContain('⠙ Pondering · 2.0s')
    expect(row).not.toContain('Thinking…')
  })

  it('prefers a pending tool activity over the turn verb', () => {
    const line = makeLine()
    line.update(true, NOW - 2000, 'Reading src/foo.ts', '⠋', { verb: 'Pondering' })
    const [row] = line.render(80)
    expect(stripSgr(row)).toContain('⠋ Reading src/foo.ts')
    expect(row).not.toContain('Pondering')
  })

  it('does not repeat token statistics supplied by the streaming channel', () => {
    const line = makeLine()
    const channelStatus = { verb: 'Vibing', emittedTokens: 128 }
    line.update(true, NOW - 1000, undefined, '⠋', channelStatus)
    expect(stripSgr(line.render(80)[0])).toBe('⠋ Vibing · 1.0s')
  })

  it('paints the line warning-colored once output stalls past three seconds', () => {
    const line = makeLine()
    line.update(true, NOW - 10_000, undefined, '⠋', { verb: 'Pondering', lastOutputAt: NOW - 5000 })
    const stalled = line.render(80)[0]
    expect(stalled).toContain(WARNING_SGR)
    expect(stalled).toContain(DIM_SGR)
    // Exactly three seconds is not yet a stall; only beyond it is.
    line.update(true, NOW - 10_000, undefined, '⠋', { verb: 'Pondering', lastOutputAt: NOW - 3000 })
    expect(line.render(80)[0]).toContain(DIM_SGR)
  })

  it('stays dim while output flows and when staleness cannot be judged', () => {
    const line = makeLine()
    line.update(true, NOW - 10_000, undefined, '⠋', { verb: 'Pondering', lastOutputAt: NOW - 1000 })
    expect(line.render(80)[0]).toContain(DIM_SGR)
    line.update(true, NOW - 10_000, undefined, '⠋', { verb: 'Pondering' })
    expect(line.render(80)[0]).toContain(DIM_SGR)
  })

  it('truncates to the given width', () => {
    const line = makeLine()
    line.update(true, NOW - 1000, undefined, '⠋', { verb: 'Reticulating' })
    const narrow = line.render(10)[0]
    expect(narrow).not.toContain('Reticulating')
  })
})
