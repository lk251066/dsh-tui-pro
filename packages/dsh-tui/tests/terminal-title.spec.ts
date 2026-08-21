import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTerminalTitleController,
  formatTerminalTitle,
  TERMINAL_TITLE_INTERVAL_MS,
} from '../src/chat/terminal-title.ts'

describe('terminal title', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('keeps the active session name static while idle', () => {
    const titles: string[] = []
    const progress: boolean[] = []
    const controller = createTerminalTitleController({
      terminal: {
        setTitle: title => { titles.push(title) },
        setProgress: active => { progress.push(active) },
      },
      productTitle: 'DeepSeek Harness',
      activeTitle: () => 'Repair commands',
      runningCount: () => 0,
    })

    controller.sync()
    expect(titles).toEqual(['Repair commands — DeepSeek Harness'])
    expect(progress).toEqual([false])
    vi.advanceTimersByTime(TERMINAL_TITLE_INTERVAL_MS * 2)
    expect(titles).toHaveLength(1)
    controller.dispose()
  })

  it('animates a process-wide running count and settles when all sessions stop', () => {
    let runningCount = 1
    let activeTitle = 'Main task'
    const titles: string[] = []
    const progress: boolean[] = []
    const controller = createTerminalTitleController({
      terminal: {
        setTitle: title => { titles.push(title) },
        setProgress: active => { progress.push(active) },
      },
      productTitle: 'DSH',
      activeTitle: () => activeTitle,
      runningCount: () => runningCount,
    })

    controller.sync()
    expect(titles.at(-1)).toBe('⠋ 1 running · Main task — DSH')
    expect(progress).toEqual([true])

    vi.advanceTimersByTime(TERMINAL_TITLE_INTERVAL_MS)
    expect(titles.at(-1)).toBe('⠙ 1 running · Main task — DSH')

    runningCount = 3
    activeTitle = 'Other task'
    controller.sync()
    expect(titles.at(-1)).toBe('⠙ 3 running · Other task — DSH')
    expect(progress).toEqual([true])

    runningCount = 0
    controller.sync()
    expect(titles.at(-1)).toBe('Other task — DSH')
    expect(progress).toEqual([true, false])
    const settledWrites = titles.length
    vi.advanceTimersByTime(TERMINAL_TITLE_INTERVAL_MS * 2)
    expect(titles).toHaveLength(settledWrites)
    controller.dispose()
  })

  it('sanitizes title input and does not repeat the product label', () => {
    expect(formatTerminalTitle('DSH', 'DSH', 0, '⠋')).toBe('DSH')
    expect(formatTerminalTitle('unsafe\u001B]0;title\u0007', 'DSH', 2, '⠋'))
      .toBe('⠋ 2 running · unsafe\\x1b]0;title\\x07 — DSH')
  })

  it('clears progress and leaves a stable title on disposal', () => {
    const titles: string[] = []
    const progress: boolean[] = []
    const controller = createTerminalTitleController({
      terminal: {
        setTitle: title => { titles.push(title) },
        setProgress: active => { progress.push(active) },
      },
      productTitle: 'DSH',
      activeTitle: () => 'Task',
      runningCount: () => 2,
    })

    controller.sync()
    controller.dispose()
    expect(progress).toEqual([true, false])
    expect(titles.at(-1)).toBe('Task — DSH')
    const writes = titles.length
    vi.advanceTimersByTime(TERMINAL_TITLE_INTERVAL_MS * 2)
    controller.sync()
    expect(titles).toHaveLength(writes)
  })
})
