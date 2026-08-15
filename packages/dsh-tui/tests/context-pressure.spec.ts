import { describe, expect, it } from 'vitest'
import { contextPressureLevel, contextPressureThresholds } from '../src/chat/context-pressure.ts'

describe('context pressure', () => {
  it('exposes the shared 60/85 thresholds', () => {
    expect(contextPressureThresholds).toEqual({ warning: 60, critical: 85 })
  })

  it('classifies the band boundaries', () => {
    expect(contextPressureLevel(0)).toBe('ok')
    expect(contextPressureLevel(59.9)).toBe('ok')
    expect(contextPressureLevel(60)).toBe('warning')
    expect(contextPressureLevel(84.9)).toBe('warning')
    expect(contextPressureLevel(85)).toBe('critical')
    expect(contextPressureLevel(100)).toBe('critical')
  })

  it('clamps out-of-range percentages to the edge bands', () => {
    expect(contextPressureLevel(-20)).toBe('ok')
    expect(contextPressureLevel(-0.1)).toBe('ok')
    expect(contextPressureLevel(100.1)).toBe('critical')
    expect(contextPressureLevel(250)).toBe('critical')
  })
})
