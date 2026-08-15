import { visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it, vi } from 'vitest'
import { SessionListComponent, type SessionListItem } from '../src/components/session-list.ts'
import { createPalette } from '../src/components/theme.ts'

const palette = createPalette({ truecolor: false, colorName: 'blue' })
const items: SessionListItem[] = [
  {
    id: 'main',
    title: 'Main session',
    cwd: 'D:\\work\\deepseekharness',
    status: 'running',
    lastActivityAgo: 'now',
    isActive: true,
  },
  {
    id: 'debug',
    title: 'Debug session',
    cwd: '/work/api',
    status: 'idle',
    lastActivityAgo: '8m',
    isActive: false,
  },
]

function createList(overrides: Partial<ConstructorParameters<typeof SessionListComponent>[1]> = {}) {
  return new SessionListComponent(palette, {
    maxRows: () => 12,
    ...overrides,
  })
}

describe('SessionListComponent', () => {
  it('renders a compact empty state at the requested width', () => {
    const list = createList()
    const lines = list.render(32)

    expect(lines.join('\n')).toContain('No live sessions')
    expect(lines.every(line => visibleWidth(line) === 32)).toBe(true)
  })

  it('renders two rows per session with workspace and activity metadata', () => {
    const list = createList()
    list.setItems(items, 'main')
    const lines = list.render(40)
    const text = lines.join('\n')

    expect(text).toContain('Main session')
    expect(text).toContain('deepseekharness')
    expect(text).toContain('Debug session')
    expect(text).toContain('api')
    expect(lines.every(line => visibleWidth(line) === 40)).toBe(true)
  })

  it('preserves selection across refreshes and accepts an active-session preference', () => {
    const list = createList()
    list.setItems(items, 'debug')
    expect(list.getSelectedSessionId()).toBe('debug')

    list.setItems([...items].reverse())
    expect(list.getSelectedSessionId()).toBe('debug')

    list.setItems(items, 'main')
    expect(list.getSelectedSessionId()).toBe('main')
  })

  it('wraps keyboard navigation and activates the selected session', () => {
    const onActivate = vi.fn()
    const onChange = vi.fn()
    const list = createList({ onActivate, onChange })
    list.setItems(items, 'main')

    list.handleInput('\x1b[A')
    expect(list.getSelectedSessionId()).toBe('debug')
    list.handleInput('\x1b[B')
    expect(list.getSelectedSessionId()).toBe('main')
    list.handleInput('\r')

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onActivate).toHaveBeenCalledWith('main')
  })

  it('returns focus on Right or Escape', () => {
    const onExit = vi.fn()
    const list = createList({ onExit })

    list.handleInput('\x1b[C')
    list.handleInput('\x1b')

    expect(onExit).toHaveBeenCalledTimes(2)
  })

  it('uses reverse video only for the focused selection', () => {
    const list = createList()
    list.setItems(items, 'main')
    expect(list.render(40).join('\n')).not.toContain('\x1b[7m')

    list.focused = true
    expect(list.render(40).join('\n')).toContain('\x1b[7m')
  })

  it('keeps the selected row visible in a bounded viewport', () => {
    const many = Array.from({ length: 10 }, (_, index): SessionListItem => ({
      id: `session-${index}`,
      title: `Session ${index}`,
      cwd: `/work/session-${index}`,
      status: 'idle',
      lastActivityAgo: `${index}m`,
      isActive: index === 8,
    }))
    const list = createList({ maxRows: () => 8 })
    list.setItems(many, 'session-8')
    const text = list.render(36).join('\n')

    expect(text).toContain('Session 8')
    expect(text).toContain('↑')
  })
})
