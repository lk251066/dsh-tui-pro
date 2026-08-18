import { describe, expect, it } from 'vitest'
import { LiveTokenRate } from '../src/chat/live-token-rate.ts'

describe('live token rate', () => {
  it('stays absent before current-step output begins', () => {
    const rate = new LiveTokenRate()
    rate.begin()
    expect(rate.rate(1_000)).toBeUndefined()
  })

  it('reports the current step from streamed output and elapsed time', () => {
    const rate = new LiveTokenRate()
    rate.begin()
    rate.record('1234567890abcdef', 1_000)
    expect(rate.rate(2_000)).toBe(4)
  })

  it('uses only the latest two seconds and reaches zero after output stalls', () => {
    const rate = new LiveTokenRate()
    rate.begin()
    rate.record('12345678', 0)
    rate.record('1234567890abcdef', 1_500)
    expect(rate.rate(2_500)).toBe(2)
    expect(rate.rate(3_501)).toBe(0)
  })

  it('clears the previous step on begin and disappears on end', () => {
    const rate = new LiveTokenRate()
    rate.record('1234567890abcdef', 0)
    expect(rate.rate(1_000)).toBe(4)
    rate.begin()
    expect(rate.rate(1_500)).toBeUndefined()
    rate.record('12345678', 2_000)
    rate.end()
    expect(rate.rate(3_000)).toBeUndefined()
  })
})
