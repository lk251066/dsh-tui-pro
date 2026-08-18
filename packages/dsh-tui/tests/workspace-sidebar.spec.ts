import { visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'
import { SessionListComponent } from '../src/components/session-list.ts'
import { createPalette } from '../src/components/theme.ts'
import { WorkspaceSidebarComponent } from '../src/components/workspace-sidebar.ts'

const palette = createPalette(true, 'dark')
const sgrPattern = new RegExp(`${String.fromCodePoint(27)}\\[[0-9;]*m`, 'gu')

function stripSgr(text: string): string {
  return text.replaceAll(sgrPattern, '')
}

function createSidebar(rows = 32): WorkspaceSidebarComponent {
  const sessions = new SessionListComponent(palette, { maxRows: () => 8 })
  sessions.setItems([
    {
      kind: 'assistant',
      id: 'assistant',
      title: 'Assistant',
      status: 'idle',
      lastActivityAgo: '2m',
      isActive: false,
    },
    {
      kind: 'project',
      id: 'main',
      title: 'Main session',
      workspace: 'deepseekharness',
      status: 'running',
      lastActivityAgo: 'now',
      isActive: true,
    },
  ])
  return new WorkspaceSidebarComponent(palette, sessions, {
    terminalRows: () => rows,
    activity: { render: () => [] },
  })
}

describe('WorkspaceSidebarComponent', () => {
  it('keeps workspace, sessions, and active status visible in one pane', () => {
    const sidebar = createSidebar()
    sidebar.update({
      status: 'running',
      inputTokens: 1_234,
      outputTokens: 987,
      cacheHitRate: 80,
      permission: 'acceptEdits',
      plan: true,
    })

    const lines = sidebar.render(32)
    const text = stripSgr(lines.join('\n'))

    expect(text).toContain('Assistant')
    expect(text).not.toContain('Workspace')
    expect(text).toContain('Active sessions · 1')
    expect(text).toContain('Main session')
    expect(text).toContain('Status')
    expect(text).toContain('Running')
    expect(text).not.toContain('deepseek-v4-flash')
    expect(text).not.toContain('63%')
    expect(text).toContain('↑1.2k ↓987')
    expect(text).toContain('cache 80%')
    expect(text).not.toMatch(/Queue\s+2/u)
    expect(text).toMatch(/Perm acceptEdits/u)
    expect(text).toContain('plan on')
    expect(lines.every(line => visibleWidth(line) === 32)).toBe(true)
  })

  it('renders stable empty operational values before the first model turn', () => {
    const lines = createSidebar(24).render(24)
    const text = stripSgr(lines.join('\n'))

    expect(text).toContain('Idle')
    expect(text).not.toContain('model unset')
    expect(text).toContain('↑0 ↓0')
    expect(text).not.toContain('Cache')
    expect(text).not.toMatch(/Queue\s+0/u)
    expect(text).toMatch(/Perm unavailable/u)
    expect(text).toContain('plan off')
    expect(lines.every(line => visibleWidth(line) === 24)).toBe(true)
    expect(lines).toHaveLength(24)
  })
})
