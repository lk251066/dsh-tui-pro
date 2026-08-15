import { describe, expect, it } from 'vitest'
import { Container, Text } from '@earendil-works/pi-tui'
import { SplitLayoutComponent } from '../src/components/split-layout.ts'
import { createPalette } from '../src/components/theme.ts'

describe('SplitLayoutComponent', () => {
  const palette = createPalette({ truecolor: false, colorName: 'blue' })

  it('renders two panes side-by-side', () => {
    const split = new SplitLayoutComponent(palette)

    const leftPane = new Container()
    leftPane.addChild(new Text('Left content', 0, 0))

    const rightPane = new Container()
    rightPane.addChild(new Text('Right content', 0, 0))

    split.setLeftPane(leftPane)
    split.setRightPane(rightPane)

    const lines = split.render(80)

    // Should have separator character
    expect(lines.some(line => line.includes('│'))).toBe(true)

    // Both panes' content should appear
    const text = lines.join('\n')
    expect(text).toContain('Left content')
    expect(text).toContain('Right content')
  })

  it('allocates left pane width within bounds', () => {
    const split = new SplitLayoutComponent(palette, {
      minLeftWidth: 20,
      maxLeftWidthRatio: 0.3,
    })

    const leftPane = new Container()
    leftPane.addChild(new Text('L', 0, 0))

    const rightPane = new Container()
    rightPane.addChild(new Text('R', 0, 0))

    split.setLeftPane(leftPane)
    split.setRightPane(rightPane)

    const lines = split.render(100)

    // Left pane should be ~30% of 100 = 30 cols
    // Line format: <30 cols left><separator><rest right>
    const firstLine = lines[0] || ''
    const separatorPos = firstLine.indexOf('│')

    // Should be around 30 (allowing some padding)
    expect(separatorPos).toBeGreaterThanOrEqual(15)
    expect(separatorPos).toBeLessThanOrEqual(50)
  })

  it('respects minimum left width', () => {
    const split = new SplitLayoutComponent(palette)

    const leftPane = new Container()
    leftPane.addChild(new Text('L', 0, 0))

    const rightPane = new Container()
    rightPane.addChild(new Text('R', 0, 0))

    split.setLeftPane(leftPane)
    split.setRightPane(rightPane)

    // Narrow terminal: left should still get 25 cols minimum (hardcoded)
    const lines = split.render(60)
    const firstLine = lines[0] || ''
    const separatorPos = firstLine.indexOf('│')

    expect(separatorPos).toBeGreaterThanOrEqual(25)
  })

  it('pads short panes to equal height', () => {
    const split = new SplitLayoutComponent(palette)

    const leftPane = new Container()
    leftPane.addChild(new Text('L1', 0, 0))
    leftPane.addChild(new Text('L2', 0, 0))

    const rightPane = new Container()
    rightPane.addChild(new Text('R1', 0, 0))
    rightPane.addChild(new Text('R2', 0, 0))
    rightPane.addChild(new Text('R3', 0, 0))
    rightPane.addChild(new Text('R4', 0, 0))

    split.setLeftPane(leftPane)
    split.setRightPane(rightPane)

    const lines = split.render(80)

    // Should have at least 4 lines (right pane's height)
    expect(lines.length).toBeGreaterThanOrEqual(4)

    // All lines should have the separator
    expect(lines.every(line => line.includes('│'))).toBe(true)
  })

  it('shows placeholder when panes not configured', () => {
    const split = new SplitLayoutComponent(palette)

    const lines = split.render(80)

    expect(lines[0]).toContain('split layout not configured')
  })

  it('reserves minimum right pane width', () => {
    const split = new SplitLayoutComponent(palette)

    const leftPane = new Container()
    leftPane.addChild(new Text('L', 0, 0))

    const rightPane = new Container()
    rightPane.addChild(new Text('R', 0, 0))

    split.setLeftPane(leftPane)
    split.setRightPane(rightPane)

    const lines = split.render(100)
    const firstLine = lines[0] || ''
    const separatorPos = firstLine.indexOf('│')
    const rightWidth = 100 - separatorPos - 1

    // Component caps left at width - 40, so right gets at least 40 cols
    // With maxLeftWidthRatio = 0.35, left = floor(100 * 0.35) = 35
    // Right = 100 - 35 - 1 = 64 cols
    expect(rightWidth).toBeGreaterThanOrEqual(40)
  })
})
