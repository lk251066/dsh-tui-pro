import { visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'
import { SessionListComponent, type SessionListItem } from '../src/components/session-list.ts'
import { createPalette } from '../src/components/theme.ts'

const palette = createPalette({ truecolor: false, colorName: 'blue' })
const items: SessionListItem[] = [
  { id: 'assistant', title: 'Assistant', workspace: 'personal', status: 'stopped', lastActivityAgo: '', isActive: false },
  { id: 'main', title: 'Main session', workspace: 'project', status: 'running', lastActivityAgo: 'now', isActive: true },
  { id: 'debug', title: 'Debug session', workspace: 'project', status: 'idle', lastActivityAgo: '8m', isActive: false },
]

function createList(maxRows = 12): SessionListComponent {
  return new SessionListComponent(palette, { maxRows: () => maxRows })
}

describe('SessionListComponent', () => {
  it('renders a compact active-workspace empty state at the requested width', () => {
    const lines = createList().render(32)
    expect(lines.join('\n')).toContain('No active sessions')
    expect(lines.every(line => visibleWidth(line) === 32)).toBe(true)
  })

  it('renders assistant, stopped, idle, and running rows without focus state', () => {
    const list = createList()
    list.setItems(items)
    const lines = list.render(44)
    const text = lines.join('\n')
    expect(text).toContain('Active sessions · 3')
    expect(text).toContain('Assistant · personal')
    expect(text).toContain('Main session · project')
    expect(text).toContain('Debug session · project')
    expect(text).not.toContain('\x1b[7m')
    expect(lines.every(line => visibleWidth(line) === 44)).toBe(true)
  })

  it('centers a bounded window around the current session', () => {
    const many = Array.from({ length: 10 }, (_, index): SessionListItem => ({
      id: `session-${index}`,
      title: `Session ${index}`,
      workspace: 'project',
      status: index === 9 ? 'stopped' : 'idle',
      lastActivityAgo: `${index}m`,
      isActive: index === 8,
    }))
    const list = createList(8)
    list.setItems(many)
    const text = list.render(36).join('\n')
    expect(text).toContain('Session 8')
    expect(text).toContain('↑')
  })
})
