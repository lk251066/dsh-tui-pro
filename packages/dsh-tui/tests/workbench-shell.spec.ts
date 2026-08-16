import { Text, visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'
import { WorkbenchShellComponent } from '../src/components/workbench-shell.ts'
import { createPalette } from '../src/components/theme.ts'

const palette = createPalette({ truecolor: false, colorName: 'blue' })
const sgrPattern = new RegExp(`${String.fromCodePoint(27)}\\[[0-9;]*m`, 'gu')

function stripSgr(text: string): string {
  return text.replaceAll(sgrPattern, '')
}

function createWorkbench(options: {
  readonly rows?: number
  readonly header?: string
  readonly transcript?: string
  readonly auxiliary?: string
  readonly input?: string
  readonly sidebar?: string
  readonly sidebarWidth?: number
} = {}): WorkbenchShellComponent {
  return new WorkbenchShellComponent(palette, {
    terminalRows: () => options.rows ?? 8,
    preferredSidebarWidth: options.sidebarWidth,
    header: new Text(options.header ?? 'header', 0, 0),
    transcript: new Text(options.transcript ?? 'chat', 0, 0),
    auxiliary: new Text(options.auxiliary ?? 'queue', 0, 0),
    dialog: new Text('', 0, 0),
    input: new Text(options.input ?? 'dsh >', 0, 0),
    sidebar: new Text(options.sidebar ?? 'Workspace\nSessions\nStatus', 0, 0),
  })
}

describe('WorkbenchShellComponent', () => {
  it('fills the terminal height and keeps the sidebar on the right', () => {
    const lines = createWorkbench().render(100)
    const plain = lines.map(stripSgr)

    expect(lines).toHaveLength(8)
    expect(plain[0]?.indexOf('│')).toBe(67)
    expect(plain[0]?.slice(68)).toContain('Workspace')
    expect(plain.every(line => visibleWidth(line) === 100)).toBe(true)
  })

  it('fixes the input area to the bottom of the main column', () => {
    const plain = createWorkbench({ rows: 6 }).render(90).map(stripSgr)
    const separator = plain[0]?.indexOf('│') ?? -1

    expect(plain[5]?.slice(0, separator).trim()).toBe('dsh >')
    expect(plain[5]?.slice(separator + 1).trim()).toBe('')
  })

  it('clips long transcripts to the internal viewport while keeping shared chrome fixed', () => {
    const transcript = Array.from({ length: 12 }, (_, index) => `row ${String(index)}`).join('\n')
    const plain = createWorkbench({ rows: 6, transcript }).render(100).map(stripSgr)
    const main = plain.map(line => line.slice(0, line.indexOf('│')).trim())
    const sidebar = plain.map(line => line.slice(line.indexOf('│') + 1).trim())

    expect(plain).toHaveLength(6)
    expect(main).toEqual(['header', '', 'row 10', 'row 11', 'queue', 'dsh >'])
    expect(sidebar).toEqual(['Workspace', 'Sessions', 'Status', '', '', ''])
  })

  it('scrolls the transcript without moving the header, input, or sidebar', () => {
    const transcript = Array.from({ length: 12 }, (_, index) => `row ${String(index)}`).join('\n')
    const workbench = createWorkbench({ rows: 6, transcript })

    workbench.scrollPageUp(100)
    const scrolled = workbench.render(100).map(stripSgr)
    expect(scrolled.map(line => line.slice(0, line.indexOf('│')).trim()))
      .toEqual(['header', '', 'row 8', 'row 9', 'queue', 'dsh >'])
    expect(scrolled.map(line => line.slice(line.indexOf('│') + 1).trim()))
      .toEqual(['Workspace', 'Sessions', 'Status', '', '', ''])

    workbench.scrollToBottom()
    const bottom = workbench.render(100).map(stripSgr)
    expect(bottom.some(line => line.includes('row 11'))).toBe(true)
  })

  it('replaces only the active transcript', () => {
    const workbench = createWorkbench({ transcript: 'first' })
    workbench.setTranscript(new Text('second', 0, 0))

    const output = workbench.render(80).map(stripSgr).join('\n')
    expect(output).toContain('second')
    expect(output).not.toContain('first')
    expect(output).toContain('Workspace')
    expect(output).toContain('dsh >')
  })

  it('replaces the editor area while an inline dialog is active', () => {
    const workbench = new WorkbenchShellComponent(palette, {
      terminalRows: () => 6,
      header: new Text('header', 0, 0),
      transcript: new Text('chat', 0, 0),
      auxiliary: new Text('', 0, 0),
      dialog: new Text('question\ncontrols', 0, 0),
      input: new Text('dsh >', 0, 0),
      sidebar: new Text('Status', 0, 0),
    })
    const output = workbench.render(90).map(stripSgr).join('\n')

    expect(output).toContain('question')
    expect(output).toContain('controls')
    expect(output).not.toContain('dsh >')
  })

  it('hides the sidebar when the terminal cannot preserve usable main and sidebar widths', () => {
    for (const width of [64, 26, 10]) {
      const lines = createWorkbench({ rows: 3 }).render(width).map(stripSgr)
      expect(lines).toHaveLength(3)
      expect(lines.every(line => !line.includes('│'))).toBe(true)
      expect(lines.every(line => visibleWidth(line) === width)).toBe(true)
    }
  })

  it('renders only the main column below the separator minimum', () => {
    const lines = createWorkbench({ rows: 2, input: 'x' }).render(2)
    expect(lines.some(line => line.includes('│'))).toBe(false)
    expect(lines.slice(-2)).toEqual(['e ', 'x '])
  })
})
