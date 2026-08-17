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
  sessions.setItems([{
    id: 'main',
    title: 'Main session',
    status: 'running',
    lastActivityAgo: 'now',
    isActive: true,
  }], 'main')
  return new WorkspaceSidebarComponent(palette, sessions, {
    terminalRows: () => rows,
    activity: { render: () => [] },
  })
}

describe('WorkspaceSidebarComponent', () => {
  it('keeps workspace, sessions, and active status visible in one pane', () => {
    const sidebar = createSidebar()
    sidebar.update({
      cwd: 'D:\\work\\deepseekharness',
      branch: 'feature/sidebar',
      status: 'running',
      model: 'deepseek-v4-flash',
      contextPercent: 63,
      inputTokens: 1_234,
      outputTokens: 987,
      cacheHitRate: 80,
      queued: 2,
      permission: 'acceptEdits',
      plan: true,
    })

    const lines = sidebar.render(32)
    const text = stripSgr(lines.join('\n'))

    expect(text).toContain('Workspace')
    expect(text).toContain('deepseekharness')
    expect(text).toContain('feature/sideb')
    expect(text).toContain('Active sessions · 1')
    expect(text).toContain('Main session')
    expect(text).toContain('Current')
    expect(text).toContain('Status')
    expect(text).toContain('Running')
    expect(text).toContain('deepseek-v4-flash')
    expect(text).toContain('63%')
    expect(text).toContain('↑1.2k ↓987')
    expect(text).toMatch(/Cache\s+80%/u)
    expect(text).toMatch(/Queue\s+2/u)
    expect(text).toMatch(/Perm\s+acceptEdits/u)
    expect(text).toMatch(/Plan\s+on/u)
    expect(lines.every(line => visibleWidth(line) === 32)).toBe(true)
  })

  it('renders stable empty operational values before the first model turn', () => {
    const lines = createSidebar(24).render(24)
    const text = stripSgr(lines.join('\n'))

    expect(text).toContain('Idle')
    expect(text).toContain('model unset')
    expect(text).toContain('unknown')
    expect(text).toContain('↑0 ↓0')
    expect(text).not.toContain('Cache')
    expect(text).toMatch(/Queue\s+0/u)
    expect(text).toMatch(/Perm\s+unavailable/u)
    expect(text).toMatch(/Plan\s+off/u)
    expect(lines.every(line => visibleWidth(line) === 24)).toBe(true)
    expect(lines).toHaveLength(24)
  })
})
