import { Text, visibleWidth, type Component } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'
import { TranscriptContainer } from '../src/components/transcript-container.ts'
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
  readonly transcriptComponent?: Component
  readonly auxiliary?: string
  readonly main?: string
  readonly input?: string
  readonly sidebar?: string
  readonly sidebarWidth?: number
  readonly sidebarSessionAt?: (row: number, width: number) => string | undefined
} = {}): WorkbenchShellComponent {
  return new WorkbenchShellComponent(palette, {
    terminalRows: () => options.rows ?? 8,
    preferredSidebarWidth: options.sidebarWidth,
    header: new Text(options.header ?? 'header', 0, 0),
    transcript: options.transcriptComponent ?? new Text(options.transcript ?? 'chat', 0, 0),
    auxiliary: new Text(options.auxiliary ?? 'queue', 0, 0),
    main: new Text(options.main ?? '', 0, 0),
    dialog: new Text('', 0, 0),
    input: new Text(options.input ?? 'dsh >', 0, 0),
    sidebar: new Text(options.sidebar ?? 'Workspace\nSessions\nStatus', 0, 0),
    sidebarSessionAt: options.sidebarSessionAt,
  })
}

describe('WorkbenchShellComponent', () => {
  it('fills the terminal with an outer frame and keeps the sidebar on the right', () => {
    const lines = createWorkbench().render(100)
    const plain = lines.map(stripSgr)

    expect(lines).toHaveLength(8)
    expect(plain[0]).toBe(`┌${'─'.repeat(98)}┐`)
    expect(plain[7]).toBe(`└${'─'.repeat(98)}┘`)
    expect(plain.slice(1, -1).every(line => line.startsWith('│') && line.endsWith('│'))).toBe(true)
    expect(plain[1]?.indexOf('│', 1)).toBe(66)
    expect(plain[1]?.slice(67)).toContain('Workspace')
    expect(plain.every(line => visibleWidth(line) === 100)).toBe(true)
  })

  it('fixes the input area to the bottom of the main column', () => {
    const plain = createWorkbench({ rows: 6 }).render(90).map(stripSgr)
    const separator = plain[1]?.indexOf('│', 1) ?? -1

    expect(plain[4]?.slice(1, separator).trim()).toBe('dsh >')
    expect(plain[4]?.slice(separator + 1, -1).trim()).toBe('')
  })

  it('clips long transcripts to the internal viewport while keeping shared chrome fixed', () => {
    const transcript = Array.from({ length: 12 }, (_, index) => `row ${String(index)}`).join('\n')
    const plain = createWorkbench({ rows: 8, transcript }).render(100).map(stripSgr)
    const content = plain.slice(1, -1)
    const main = content.map(line => line.slice(1, line.indexOf('│', 1)).trim())
    const sidebar = content.map(line => line.slice(line.indexOf('│', 1) + 1, -1).trim())

    expect(plain).toHaveLength(8)
    expect(main).toEqual([
      'header',
      'row 9',
      'row 10',
      'row 11',
      'queue',
      'dsh >',
    ])
    expect(sidebar).toEqual(['Workspace', 'Sessions', 'Status', '', '', ''])
  })

  it('scrolls the transcript without moving the header, input, or sidebar', () => {
    const transcript = Array.from({ length: 12 }, (_, index) => `row ${String(index)}`).join('\n')
    const workbench = createWorkbench({ rows: 8, transcript })

    workbench.scrollPageUp(100)
    const scrolled = workbench.render(100).map(stripSgr)
    const content = scrolled.slice(1, -1)
    expect(content.map(line => line.slice(1, line.indexOf('│', 1)).trim()))
      .toEqual(['header', 'row 6', 'row 7', 'row 8', 'queue', 'dsh >'])
    expect(content.map(line => line.slice(line.indexOf('│', 1) + 1, -1).trim()))
      .toEqual(['Workspace', 'Sessions', 'Status', '', '', ''])

    workbench.scrollToBottom()
    const bottom = workbench.render(100).map(stripSgr)
    expect(bottom.some(line => line.includes('row 11'))).toBe(true)
  })

  it('scrolls by individual rows for mouse-wheel input', () => {
    const transcript = Array.from({ length: 12 }, (_, index) => `row ${String(index)}`).join('\n')
    const workbench = createWorkbench({ rows: 8, transcript })

    workbench.scrollByRows(100, 1)
    const older = workbench.render(100).map(stripSgr).join('\n')
    expect(older).toContain('row 10')
    expect(older).not.toContain('row 11')

    workbench.scrollByRows(100, -1)
    expect(workbench.render(100).map(stripSgr).join('\n')).toContain('row 11')
  })

  it('selects transcript text by mouse drag while preserving the fixed workbench', () => {
    const workbench = createWorkbench({ rows: 9, transcript: 'alpha\nbeta', auxiliary: 'queue', input: 'dsh >' })

    expect(workbench.handleMouse({
      kind: 'press', button: 'left', column: 2, row: 3,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)).toEqual({ consumed: true })
    expect(workbench.handleMouse({
      kind: 'move', button: 'left', column: 6, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)).toEqual({ consumed: true })
    expect(workbench.render(100).join('\n')).toContain('\x1b[7m')
    expect(workbench.handleMouse({
      kind: 'release', button: 'none', column: 6, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)).toEqual({ consumed: true, copiedText: 'alpha\nbeta' })

    const plain = workbench.render(100).map(stripSgr)
    expect(plain[0]).toBe(`┌${'─'.repeat(98)}┐`)
    expect(plain.some(line => line.includes('Workspace'))).toBe(true)
    expect(plain.some(line => line.includes('dsh >'))).toBe(true)
  })

  it('gives an established conversation every row above the fixed input area', () => {
    const transcript = Array.from({ length: 12 }, (_, index) => `row ${String(index)}`).join('\n')
    const plain = createWorkbench({ rows: 8, header: '', transcript }).render(100).map(stripSgr)
    const content = plain.slice(1, -1)
    const main = content.map(line => line.slice(1, line.indexOf('│', 1)).trim())

    expect(main).toEqual([
      'row 8',
      'row 9',
      'row 10',
      'row 11',
      'queue',
      'dsh >',
    ])
  })

  it('includes the character cells at both ends of forward and reverse drags', () => {
    const forward = createWorkbench({ rows: 8, transcript: 'alpha' })
    forward.handleMouse({
      kind: 'press', button: 'left', column: 2, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)
    forward.handleMouse({
      kind: 'move', button: 'left', column: 6, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)
    expect(forward.handleMouse({
      kind: 'release', button: 'none', column: 6, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)).toEqual({ consumed: true, copiedText: 'alpha' })

    const reverse = createWorkbench({ rows: 8, transcript: 'alpha' })
    reverse.handleMouse({
      kind: 'press', button: 'left', column: 6, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)
    reverse.handleMouse({
      kind: 'move', button: 'left', column: 2, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)
    expect(reverse.handleMouse({
      kind: 'release', button: 'none', column: 2, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)).toEqual({ consumed: true, copiedText: 'alpha' })
  })

  it('clears cell-based selection when a resize reflows the transcript', () => {
    const workbench = createWorkbench({ rows: 8, transcript: 'alpha beta gamma' })
    workbench.render(100)
    workbench.handleMouse({
      kind: 'press', button: 'left', column: 2, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)
    workbench.handleMouse({
      kind: 'move', button: 'left', column: 6, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)
    expect(workbench.render(100).join('\n')).toContain('\x1b[7m')

    expect(workbench.render(80).join('\n')).not.toContain('\x1b[7m')
  })

  it('resolves a sidebar click without starting a transcript selection', () => {
    const workbench = createWorkbench({ sidebarSessionAt: row => row === 0 ? 'assistant' : undefined })

    expect(workbench.handleMouse({
      kind: 'press', button: 'left', column: 68, row: 2,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)).toEqual({ consumed: true, sessionId: 'assistant' })
  })

  it('ignores non-left presses for transcript and sidebar actions', () => {
    const workbench = createWorkbench({ sidebarSessionAt: row => row === 0 ? 'assistant' : undefined })
    expect(workbench.handleMouse({
      kind: 'press', button: 'right', column: 2, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)).toEqual({ consumed: false })
    expect(workbench.handleMouse({
      kind: 'press', button: 'middle', column: 68, row: 2,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)).toEqual({ consumed: false })
  })

  it('routes a transcript click to the disclosure block under that row', () => {
    class Disclosure implements Component {
      expanded = false
      invalidate(): void {}
      render(): string[] { return this.expanded ? ['▼ Details', 'full body'] : ['▶ Details'] }
      clickTranscriptRow(row: number): boolean {
        if (row !== 0) return false
        this.expanded = !this.expanded
        return true
      }
    }
    const disclosure = new Disclosure()
    const transcript = new TranscriptContainer()
    transcript.addChild(disclosure)
    const workbench = createWorkbench({ rows: 9, transcriptComponent: transcript })

    workbench.handleMouse({
      kind: 'press', button: 'left', column: 3, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)
    expect(workbench.handleMouse({
      kind: 'release', button: 'none', column: 3, row: 4,
      shift: false, alt: false, ctrl: false, wheelRows: 0,
    }, 100)).toEqual({ consumed: true })

    expect(disclosure.expanded).toBe(true)
    expect(workbench.render(100).map(stripSgr).join('\n')).toContain('▼ Details')
    expect(workbench.render(100).map(stripSgr).join('\n')).toContain('full body')
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
      main: new Text('', 0, 0),
      dialog: new Text('question\ncontrols', 0, 0),
      input: new Text('dsh >', 0, 0),
      sidebar: new Text('Status', 0, 0),
    })
    const output = workbench.render(90).map(stripSgr).join('\n')

    expect(output).toContain('question')
    expect(output).toContain('controls')
    expect(output).not.toContain('dsh >')
  })

  it('lets a main-area browser replace chat while the sidebar and outer frame stay fixed', () => {
    const lines = createWorkbench({ rows: 8, main: 'Sessions\nsearch\nitem 1\nitem 2' }).render(100).map(stripSgr)
    const content = lines.slice(1, -1)
    const main = content.map(line => line.slice(1, line.indexOf('│', 1)).trim())
    const sidebar = content.map(line => line.slice(line.indexOf('│', 1) + 1, -1).trim())

    expect(main).toEqual(['Sessions', 'search', 'item 1', 'item 2', '', ''])
    expect(main).not.toContain('header')
    expect(main).not.toContain('dsh >')
    expect(sidebar).toEqual(['Workspace', 'Sessions', 'Status', '', '', ''])
    expect(lines[0]).toBe(`┌${'─'.repeat(98)}┐`)
    expect(lines[7]).toBe(`└${'─'.repeat(98)}┘`)
  })

  it('hides the sidebar when the terminal cannot preserve usable main and sidebar widths', () => {
    for (const width of [64, 26, 10]) {
      const lines = createWorkbench({ rows: 3 }).render(width).map(stripSgr)
      expect(lines).toHaveLength(3)
      expect(lines[0]).toBe(`┌${'─'.repeat(width - 2)}┐`)
      expect(lines[2]).toBe(`└${'─'.repeat(width - 2)}┘`)
      expect(lines[1]?.startsWith('│')).toBe(true)
      expect(lines[1]?.endsWith('│')).toBe(true)
      expect(lines.every(line => visibleWidth(line) === width)).toBe(true)
    }
  })

  it('keeps the outer frame at the smallest supported terminal width', () => {
    const lines = createWorkbench({ rows: 2, input: 'x' }).render(2).map(stripSgr)
    expect(lines).toEqual(['┌┐', '└┘'])
  })
})
