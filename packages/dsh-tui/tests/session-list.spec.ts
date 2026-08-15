import { describe, expect, it } from 'vitest'
import { SessionListComponent, type SessionListItem } from '../src/components/session-list.ts'
import { createPalette } from '../src/components/theme.ts'

describe('SessionListComponent', () => {
  const palette = createPalette({ truecolor: false, colorName: 'blue' })

  it('renders empty list', () => {
    const list = new SessionListComponent(palette, 20)
    list.setItems([])
    const lines = list.render(30)
    expect(lines.some(line => line.includes('(no sessions)'))).toBe(true)
  })

  it('renders session items with status and cwd', () => {
    const items: SessionListItem[] = [
      {
        id: 'main',
        title: 'Main Session',
        cwd: '/home/user/project',
        status: 'running',
        lastActivityAgo: '2m ago',
        isActive: true,
      },
      {
        id: 'debug',
        title: 'Debug Session',
        cwd: '/home/user/api',
        status: 'idle',
        lastActivityAgo: '1h ago',
        isActive: false,
      },
    ]
    const list = new SessionListComponent(palette, 20)
    list.setItems(items)
    const lines = list.render(40)

    const text = lines.join('\n')
    expect(text).toContain('Main Session')
    expect(text).toContain('Debug Session')
    expect(text).toContain('/home/user/project')
    expect(text).toContain('running')
    expect(text).toContain('idle')
  })

  it('highlights selected item', () => {
    const items: SessionListItem[] = [
      { id: 'a', title: 'A', cwd: '/a', status: 'idle', lastActivityAgo: '1m ago', isActive: false },
      { id: 'b', title: 'B', cwd: '/b', status: 'idle', lastActivityAgo: '2m ago', isActive: false },
    ]
    const list = new SessionListComponent(palette, 20)
    list.setItems(items)

    // Initially selects first item
    expect(list.getSelectedSessionId()).toBe('a')

    list.selectNext()
    expect(list.getSelectedSessionId()).toBe('b')

    list.selectPrevious()
    expect(list.getSelectedSessionId()).toBe('a')
  })

  it('wraps navigation at boundaries', () => {
    const items: SessionListItem[] = [
      { id: 'a', title: 'A', cwd: '/a', status: 'idle', lastActivityAgo: '1m ago', isActive: false },
      { id: 'b', title: 'B', cwd: '/b', status: 'idle', lastActivityAgo: '2m ago', isActive: false },
    ]
    const list = new SessionListComponent(palette, 20)
    list.setItems(items)

    // At first item, previous wraps to last
    expect(list.getSelectedSessionId()).toBe('a')
    list.selectPrevious()
    expect(list.getSelectedSessionId()).toBe('b')

    // At last item, next wraps to first
    list.selectNext()
    expect(list.getSelectedSessionId()).toBe('a')
  })

  it('truncates long titles and paths', () => {
    const longTitle = 'A'.repeat(50)
    const longPath = '/home/user/very/long/path/to/project/directory'
    const items: SessionListItem[] = [
      {
        id: 'long',
        title: longTitle,
        cwd: longPath,
        status: 'idle',
        lastActivityAgo: '1m ago',
        isActive: false,
      },
    ]
    const list = new SessionListComponent(palette, 20)
    list.setItems(items)
    const lines = list.render(30)

    const text = lines.join('\n')
    // Should contain ellipsis due to truncation
    expect(text).toContain('…')
  })

  it('shows scroll indicators when list exceeds visible height', () => {
    const items: SessionListItem[] = Array.from({ length: 10 }, (_, i) => ({
      id: `session-${i}`,
      title: `Session ${i}`,
      cwd: `/home/session${i}`,
      status: 'idle' as const,
      lastActivityAgo: `${i}m ago`,
      isActive: false,
    }))
    const list = new SessionListComponent(palette, 5) // Only 5 visible
    list.setItems(items)
    const lines = list.render(40)

    const text = lines.join('\n')
    // Should show "more below" indicator
    expect(text).toContain('more below')
  })

  it('marks active session with (current)', () => {
    const items: SessionListItem[] = [
      { id: 'a', title: 'A', cwd: '/a', status: 'idle', lastActivityAgo: '1m ago', isActive: true },
      { id: 'b', title: 'B', cwd: '/b', status: 'idle', lastActivityAgo: '2m ago', isActive: false },
    ]
    const list = new SessionListComponent(palette, 20)
    list.setItems(items)
    const lines = list.render(40)

    const text = lines.join('\n')
    expect(text).toContain('(current)')
  })
})
