import { visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'
import { SessionListComponent, type SessionListItem } from '../src/components/session-list.ts'
import { createPalette } from '../src/components/theme.ts'

const palette = createPalette({ truecolor: false, colorName: 'blue' })
const items: SessionListItem[] = [
  { kind: 'assistant', id: 'assistant', title: 'Assistant', status: 'stopped', lastActivityAgo: '', isActive: false },
  { kind: 'project', id: 'main', title: 'Main session', workspace: 'project', status: 'running', lastActivityAgo: 'now', isActive: true },
  { kind: 'project', id: 'debug', title: 'Debug session', workspace: 'project', status: 'idle', lastActivityAgo: '8m', isActive: false },
]

function createList(maxRows = 12): SessionListComponent {
  return new SessionListComponent(palette, { maxRows: () => maxRows })
}

describe('SessionListComponent', () => {
  it('renders separate assistant and active-project empty states at the requested width', () => {
    const lines = createList().render(32)
    expect(lines.join('\n')).toContain('Assistant')
    expect(lines.join('\n')).toContain('Unavailable')
    expect(lines.join('\n')).toContain('No active sessions')
    expect(lines.every(line => visibleWidth(line) === 32)).toBe(true)
  })

  it('renders assistant, stopped, idle, and running rows without focus state', () => {
    const list = createList()
    list.setItems(items)
    const lines = list.render(44)
    const text = lines.join('\n')
    expect(text).toContain('Active sessions · 2')
    expect(text).not.toContain('personal')
    expect(text).toContain('Assistant')
    expect(text).toContain('Main session')
    expect(text).toContain('Debug session')
    expect(text).not.toContain('project')
    expect(text).not.toContain('›')
    expect(text).toContain(palette.accent('Main session'))
    expect(text).not.toContain('\x1b[7m')
    expect(lines.every(line => visibleWidth(line) === 44)).toBe(true)
  })

  it('maps only rendered session rows to clickable items', () => {
    const list = createList()
    list.setItems(items)
    expect(list.itemAtRow(2)?.id).toBe('assistant')
    expect(list.itemAtRow(3)).toBeUndefined()
    expect(list.itemAtRow(5)).toBeUndefined()
    expect(list.itemAtRow(6)?.id).toBe('main')
  })

  it('omits the group header when every session shares one workspace', () => {
    const list = createList()
    list.setItems(items.filter(item => item.kind === 'project'))
    const lines = list.render(44)
    const text = lines.join('\n')
    expect(text).toContain('Active sessions · 2')
    expect(text).toContain('Main session')
    expect(text).toContain('Debug session')
    expect(text).not.toContain('project')
    expect(list.itemAtRow(2)).toBeUndefined()
    expect(list.itemAtRow(6)?.id).toBe('main')
    expect(list.itemAtRow(7)?.id).toBe('debug')
  })

  it('groups project sessions without treating the assistant as a workspace', () => {
    const list = createList(14)
    list.setItems([
      items[0] as SessionListItem,
      items[1] as SessionListItem,
      { ...(items[2] as SessionListItem), kind: 'project', workspace: 'other' },
    ])
    const text = list.render(44).join('\n')
    expect(text).toContain('project')
    expect(text).toContain('other')
    expect(text).not.toContain('personal')
  })

  it('centers a bounded window around the current session', () => {
    const many = Array.from({ length: 10 }, (_, index): SessionListItem => ({
      kind: 'project',
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
