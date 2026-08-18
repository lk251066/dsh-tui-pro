import type { Component } from '@earendil-works/pi-tui'
import { describe, expect, it } from 'vitest'
import { TranscriptContainer } from '../src/components/transcript-container.ts'

class CountingComponent implements Component {
  renders = 0

  constructor(private readonly text: string) {}

  render(width: number): string[] {
    this.renders += 1
    return [`${this.text}:${String(width)}`]
  }
}

describe('TranscriptContainer render cache', () => {
  it('keeps steady-state scrolling independent of transcript length', () => {
    const transcript = new TranscriptContainer()
    const children = Array.from({ length: 1_000 }, (_, index) => new CountingComponent(String(index)))
    for (const child of children) transcript.addChild(child)

    const first = transcript.render(80)
    const second = transcript.render(80)

    expect(second).toBe(first)
    expect(children.every(child => child.renders === 1)).toBe(true)
  })

  it('renders only an appended tail component at a stable width', () => {
    const transcript = new TranscriptContainer()
    const first = new CountingComponent('first')
    const second = new CountingComponent('second')
    transcript.addChild(first)
    transcript.render(80)

    transcript.addChild(second)
    expect(transcript.render(80)).toEqual(['first:80', 'second:80'])
    expect(first.renders).toBe(1)
    expect(second.renders).toBe(1)
  })

  it('re-renders the changed component and its suffix without touching the prefix', () => {
    const transcript = new TranscriptContainer()
    const children = Array.from({ length: 6 }, (_, index) => new CountingComponent(String(index)))
    for (const child of children) transcript.addChild(child)
    transcript.render(80)

    transcript.markDirty(children[4])
    transcript.render(80)

    expect(children.map(child => child.renders)).toEqual([1, 1, 1, 1, 2, 2])
  })

  it('reflows every component when terminal width changes', () => {
    const transcript = new TranscriptContainer()
    const children = Array.from({ length: 4 }, (_, index) => new CountingComponent(String(index)))
    for (const child of children) transcript.addChild(child)
    transcript.render(80)

    expect(transcript.render(100)).toEqual(['0:100', '1:100', '2:100', '3:100'])
    expect(children.every(child => child.renders === 2)).toBe(true)
  })

  it('drops cached rows when the final or only child is removed', () => {
    const transcript = new TranscriptContainer()
    const first = new CountingComponent('first')
    const second = new CountingComponent('second')
    transcript.addChild(first)
    transcript.addChild(second)
    transcript.render(80)

    transcript.removeChild(second)
    expect(transcript.render(80)).toEqual(['first:80'])
    expect(first.renders).toBe(1)

    transcript.removeChild(first)
    expect(transcript.render(80)).toEqual([])
  })
})
