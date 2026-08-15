import { Container, Text, visibleWidth } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'
import { SplitLayoutComponent } from '../src/components/split-layout.ts'
import { createPalette } from '../src/components/theme.ts'

const palette = createPalette({ truecolor: false, colorName: 'blue' })

function createSplit(left: string, right: string): SplitLayoutComponent {
  const split = new SplitLayoutComponent(palette)
  const leftPane = new Container()
  leftPane.addChild(new Text(left, 0, 0))
  const rightPane = new Container()
  rightPane.addChild(new Text(right, 0, 0))
  split.setLeftPane(leftPane)
  split.setRightPane(rightPane)
  return split
}

describe('SplitLayoutComponent', () => {
  it('renders both panes with a fixed 40-column sidebar on wide terminals', () => {
    const lines = createSplit('left', 'right').render(120)

    expect(lines[0]).toContain('left')
    expect(lines[0]).toContain('right')
    expect(lines[0]?.indexOf('│')).toBeGreaterThan(40)
    expect(visibleWidth(lines[0] ?? '')).toBe(120)
  })

  it('shrinks the sidebar only to preserve the chat minimum width', () => {
    const line = createSplit('left', 'right').render(72)[0] ?? ''
    const plain = line.replace(/\x1b\[[0-9;]*m/gu, '')

    expect(plain.indexOf('│')).toBe(31)
    expect(visibleWidth(line)).toBe(72)
  })

  it('uses visible width when colored content contains ANSI escapes', () => {
    const line = createSplit(palette.accent('selected'), palette.error('failure')).render(80)[0] ?? ''
    const plain = line.replace(/\x1b\[[0-9;]*m/gu, '')

    expect(plain.indexOf('│')).toBe(39)
    expect(plain.slice(40).trimEnd()).toBe('failure')
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

  it('renders nothing until both panes are configured', () => {
    expect(new SplitLayoutComponent(palette).render(80)).toEqual([])
  })
})
