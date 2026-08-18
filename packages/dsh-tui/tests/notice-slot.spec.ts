import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NoticeSlotComponent } from '../src/components/notice-slot.ts'
import { createPalette } from '../src/components/theme.ts'

/** The dim, warning, and error SGR opens a `createPalette(true)` (dark) row carries. */
const DIM_SGR = '\x1b[2;39m'
const WARNING_SGR = '\x1b[33m'
const ERROR_SGR = '\x1b[31m'

describe('notice slot', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders nothing before any notice and after clear', () => {
    const slot = new NoticeSlotComponent(createPalette(true), vi.fn())
    expect(slot.render(80)).toEqual([])
    slot.show('Config reload complete.', 'info', 1_000)
    slot.clear()
    expect(slot.render(80)).toEqual([])
    // Clearing again stays quiet and idempotent.
    slot.clear()
    expect(slot.render(80)).toEqual([])
  })

  it('shows one dim row for an info notice and requests a render', () => {
    const requestRender = vi.fn()
    const slot = new NoticeSlotComponent(createPalette(true), requestRender)
    slot.show('Tool and context cards expanded.')
    const [row] = slot.render(80)
    expect(row).toContain(DIM_SGR)
    expect(row).toContain('Tool and context cards expanded.')
    expect(requestRender).toHaveBeenCalledTimes(1)
  })

  it('paints warning and error notices with their transcript roles', () => {
    const slot = new NoticeSlotComponent(createPalette(true), vi.fn())
    slot.show('careful', 'warning')
    expect(slot.render(80)[0]).toContain(WARNING_SGR)
    slot.show('broken', 'error')
    const [row] = slot.render(80)
    expect(row).toContain(ERROR_SGR)
    expect(row).toContain('broken')
  })

  it('escapes terminal control characters at the render boundary', () => {
    const slot = new NoticeSlotComponent(createPalette(true), vi.fn())
    slot.show('a\x1b]2;title\x07b')
    const [row] = slot.render(80)
    expect(row).toContain('a\\x1b]2;title\\x07b')
    expect(row).not.toContain('\x1b]2;')
  })

  it('truncates to the given width with an ellipsis', () => {
    const slot = new NoticeSlotComponent(createPalette(true), vi.fn())
    slot.show('Theme switched to deepseek-dark.', 'info', 60_000)
    const narrow = slot.render(10)[0]
    expect(narrow).toContain('…')
    expect(narrow).not.toContain('deepseek-dark')
  })

  it('auto-clears after the duration and renders once more', () => {
    const requestRender = vi.fn()
    const slot = new NoticeSlotComponent(createPalette(true), requestRender)
    slot.show('Reasoning expanded.', 'info', 5_000)
    expect(requestRender).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(4_999)
    expect(slot.render(80)).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(slot.render(80)).toEqual([])
    expect(requestRender).toHaveBeenCalledTimes(2)
  })

  it('replacing a notice restarts its timer', () => {
    const slot = new NoticeSlotComponent(createPalette(true), vi.fn())
    slot.show('first', 'info', 1_000)
    vi.advanceTimersByTime(900)
    slot.show('second', 'info', 1_000)
    // Past the first deadline: the replacement still shows.
    vi.advanceTimersByTime(200)
    expect(slot.render(80)[0]).toContain('second')
    // Its own deadline clears it.
    vi.advanceTimersByTime(800)
    expect(slot.render(80)).toEqual([])
  })

  it('clear cancels the auto-clear timer', () => {
    const requestRender = vi.fn()
    const slot = new NoticeSlotComponent(createPalette(true), requestRender)
    slot.show('gone soon', 'info', 1_000)
    slot.clear()
    requestRender.mockClear()
    vi.advanceTimersByTime(5_000)
    expect(slot.render(80)).toEqual([])
    expect(requestRender).not.toHaveBeenCalled()
  })

  it('dispose stops the timer without rendering', () => {
    const requestRender = vi.fn()
    const slot = new NoticeSlotComponent(createPalette(true), requestRender)
    slot.show('teardown', 'info', 1_000)
    requestRender.mockClear()
    slot.dispose()
    vi.advanceTimersByTime(5_000)
    expect(slot.render(80)).toEqual([])
    expect(requestRender).not.toHaveBeenCalled()
  })
})

describe('notice slot fade-out', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fades the row through truecolor grays over the last 800ms', () => {
    const requestRender = vi.fn()
    const slot = new NoticeSlotComponent(createPalette(true), requestRender, true)
    slot.show('Theme switched.', 'info', 5_000)
    // Full kind tone before the fade window.
    expect(slot.render(80)[0]).toContain(DIM_SGR)
    // Inside the window the kind color drops to the gray interpolation.
    vi.advanceTimersByTime(4_500)
    const midRow = slot.render(80)[0] ?? ''
    expect(midRow).toContain('\x1b[38;2;')
    expect(midRow).not.toContain(DIM_SGR)
    expect(midRow).toContain('Theme switched.')
    // The gray dims as the deadline approaches, and the fade ticks repaint.
    const midGray = Number(/38;2;(\d+);/.exec(midRow)?.[1])
    vi.advanceTimersByTime(400)
    const lateRow = slot.render(80)[0] ?? ''
    const lateGray = Number(/38;2;(\d+);/.exec(lateRow)?.[1])
    expect(lateGray).toBeLessThan(midGray)
    expect(requestRender.mock.calls.length).toBeGreaterThan(1)
    // The deadline still clears the row.
    vi.advanceTimersByTime(100)
    expect(slot.render(80)).toEqual([])
  })

  it('keeps the direct clear without truecolor', () => {
    const slot = new NoticeSlotComponent(createPalette(true), vi.fn())
    slot.show('plain', 'info', 5_000)
    vi.advanceTimersByTime(4_900)
    expect(slot.render(80)[0]).toContain(DIM_SGR)
    vi.advanceTimersByTime(100)
    expect(slot.render(80)).toEqual([])
  })

  it('clears a notice shorter than the fade window directly', () => {
    const slot = new NoticeSlotComponent(createPalette(true), vi.fn(), true)
    slot.show('brief', 'info', 500)
    vi.advanceTimersByTime(400)
    expect(slot.render(80)[0]).toContain(DIM_SGR)
    vi.advanceTimersByTime(100)
    expect(slot.render(80)).toEqual([])
  })
})
