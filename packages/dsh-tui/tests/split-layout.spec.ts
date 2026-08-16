import { Container, Text, visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'
import { SplitLayoutComponent } from '../src/components/split-layout.ts'
import { createPalette } from '../src/components/theme.ts'

const palette = createPalette({ truecolor: false, colorName: 'blue' })
const sgrPattern = new RegExp(`${String.fromCodePoint(27)}\\[[0-9;]*m`, 'gu')

function stripSgr(text: string): string {
  return text.replaceAll(sgrPattern, '')
}

function createSplit(left: string, right: string, preferredLeftWidth?: number): SplitLayoutComponent {
  const split = new SplitLayoutComponent(palette, { preferredLeftWidth })
  const leftPane = new Container()
  leftPane.addChild(new Text(left, 0, 0))
  const rightPane = new Container()
  rightPane.addChild(new Text(right, 0, 0))
  split.setLeftPane(leftPane)
  split.setRightPane(rightPane)
  return split
}

describe('SplitLayoutComponent', () => {
  it('renders both panes with a fixed 32-column sidebar on wide terminals', () => {
    const lines = createSplit('left', 'right').render(120)
    const plain = stripSgr(lines[0] ?? '')

    expect(lines[0]).toContain('left')
    expect(lines[0]).toContain('right')
    expect(plain.indexOf('│')).toBe(32)
    expect(visibleWidth(lines[0] ?? '')).toBe(120)
  })

  it('shrinks the sidebar only to preserve the chat minimum width', () => {
    const line = createSplit('left', 'right').render(72)[0] ?? ''
    const plain = stripSgr(line)

    expect(plain.indexOf('│')).toBe(31)
    expect(visibleWidth(line)).toBe(72)
  })

  it('uses visible width when colored content contains ANSI escapes', () => {
    const line = createSplit(palette.accent('selected'), palette.error('failure')).render(80)[0] ?? ''
    const plain = stripSgr(line)

    expect(plain.indexOf('│')).toBe(32)
    expect(plain.slice(33).trimEnd()).toBe('failure')
    expect(visibleWidth(line)).toBe(80)
  })

  it('pads shorter panes so every rendered row keeps the separator', () => {
    const split = new SplitLayoutComponent(palette)
    const left = new Container()
    left.addChild(new Text('one', 0, 0))
    const right = new Container()
    right.addChild(new Text('one\ntwo\nthree', 0, 0))
    split.setLeftPane(left)
    split.setRightPane(right)

    const lines = split.render(100)
    expect(lines.length).toBe(3)
    expect(lines.every(line => line.includes('│'))).toBe(true)
  })

  it('uses a configured sidebar width on wide terminals', () => {
    const line = createSplit('left', 'right', 36).render(120)[0] ?? ''
    const plain = stripSgr(line)

    expect(plain.indexOf('│')).toBe(36)
    expect(visibleWidth(line)).toBe(120)
  })

  it('keeps the sidebar present when the terminal cannot fit both pane minimums', () => {
    for (const [width, separatorColumn] of [[64, 24], [26, 24], [10, 8]] as const) {
      const line = createSplit('left', 'right').render(width)[0] ?? ''
      const plain = stripSgr(line)

      expect(plain.indexOf('│')).toBe(separatorColumn)
      expect(visibleWidth(line)).toBe(width)
      expect(plain.slice(separatorColumn + 1)).toContain('r')
    }
  })

  it('aligns a shorter sidebar with the bottom of a growing transcript', () => {
    const split = new SplitLayoutComponent(palette)
    const left = new Container()
    left.addChild(new Text('left one\nleft two', 0, 0))
    const right = new Container()
    right.addChild(new Text('right one\nright two\nright three\nright four', 0, 0))
    split.setLeftPane(left)
    split.setRightPane(right)

    const plain = split.render(100).map(stripSgr)
    expect(plain[0]?.slice(0, 32).trim()).toBe('')
    expect(plain[1]?.slice(0, 32).trim()).toBe('')
    expect(plain[2]?.slice(0, 32).trim()).toBe('left one')
    expect(plain[3]?.slice(0, 32).trim()).toBe('left two')
  })

  it('renders nothing until both panes are configured', () => {
    expect(new SplitLayoutComponent(palette).render(80)).toEqual([])
  })
})
