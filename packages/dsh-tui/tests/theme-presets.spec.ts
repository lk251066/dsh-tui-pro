import { describe, expect, it } from 'vitest'
import { createPalette, renderPalette } from '../src/components/theme.ts'
import { THEME_PRESETS, THEME_PRESET_NAMES } from '../src/components/theme-presets.ts'

describe('theme presets', () => {
  it('ships the adaptive default, three dark themes, and the color-blind theme', () => {
    expect(THEME_PRESET_NAMES).toEqual(['deepseek', 'dracula', 'nord', 'catppuccin-mocha', 'daltonism'])
    // The adaptive default keeps every adaptive role terminal-owned; its only
    // overrides are the CC-derived semantic colors every preset shares.
    expect(THEME_PRESETS.deepseek?.colors).toEqual({
      permission: { rgb: [87, 105, 247], ansi16: '94' },
      plan: { rgb: [72, 150, 140], ansi16: '37' },
      diffAddedWord: { rgb: [56, 166, 96], ansi16: '32' },
      diffRemovedWord: { rgb: [179, 89, 107], ansi16: '31' },
    })
    for (const name of ['dracula', 'nord', 'catppuccin-mocha', 'daltonism']) {
      const preset = THEME_PRESETS[name]
      expect(preset?.dark).toBe(true)
      expect(Object.keys(preset?.colors ?? {}).length).toBeGreaterThan(0)
    }
  })

  it('carries the CC semantic permission and plan roles in every preset', () => {
    for (const name of THEME_PRESET_NAMES) {
      const colors = THEME_PRESETS[name]?.colors ?? {}
      expect(colors.permission, name).toEqual({ rgb: [87, 105, 247], ansi16: '94' })
      expect(colors.plan, name).toEqual({ rgb: [72, 150, 140], ansi16: '37' })
    }
    // The reserved diff word-level tokens are defined but not yet palette roles.
    expect(THEME_PRESETS.dracula?.colors.diffAddedWord).toEqual({ rgb: [56, 166, 96], ansi16: '32' })
    expect(THEME_PRESETS.dracula?.colors.diffRemovedWord).toEqual({ rgb: [179, 89, 107], ansi16: '31' })
  })

  it('wires permission and plan through the palette', () => {
    const themed = createPalette(true, 'dark', { preset: THEME_PRESETS.dracula, truecolor: true })
    expect(themed.permission('x')).toBe('\x1b[38;2;87;105;247mx\x1b[39m')
    expect(themed.plan('x')).toBe('\x1b[38;2;72;150;140mx\x1b[39m')
    const fallback = createPalette(true, 'dark', { preset: THEME_PRESETS.dracula, truecolor: false })
    expect(fallback.permission('x')).toBe('\x1b[94mx\x1b[39m')
    expect(fallback.plan('x')).toBe('\x1b[37mx\x1b[39m')
    // The adaptive default keeps the same ANSI codes from the base spec.
    const adaptive = createPalette(true, 'dark')
    expect(adaptive.permission('x')).toBe('\x1b[94mx\x1b[39m')
    expect(adaptive.plan('x')).toBe('\x1b[37mx\x1b[39m')
  })

  it('paints preset roles as 24-bit SGR on truecolor terminals', () => {
    const dracula = THEME_PRESETS.dracula
    expect(dracula).toBeDefined()
    const palette = createPalette(true, 'dark', { preset: dracula, truecolor: true })
    // Dracula accent #bd93f9 → 189;147;249.
    expect(palette.accent('x')).toBe('\x1b[38;2;189;147;249mx\x1b[39m')
    // Roles the preset leaves out keep the adaptive spec (dim's fallback ansi16
    // keeps the SGR-2 relative treatment even though its rgb exists for truecolor).
    expect(palette.text('x')).toBe('x')
  })

  it('falls back to the preset ANSI-16 codes without truecolor', () => {
    const nord = THEME_PRESETS.nord
    expect(nord).toBeDefined()
    const palette = createPalette(true, 'dark', { preset: nord, truecolor: false })
    // Nord accent #88c0d0 → ANSI 36.
    expect(palette.accent('x')).toBe('\x1b[36mx\x1b[39m')
    // The relative dim stays adaptive rather than a fixed hue.
    expect(palette.dim('x')).toBe('\x1b[2;39mx\x1b[22;39m')
  })

  it('daltonism shifts the green roles to blue and leaves the rest adaptive', () => {
    const daltonism = THEME_PRESETS.daltonism
    expect(daltonism?.colors.success).toEqual({ rgb: [51, 153, 255], ansi16: '38;5;75' })
    expect(daltonism?.colors.diffAddedWord).toEqual({ rgb: [51, 153, 255], ansi16: '38;5;75' })
    expect(daltonism?.colors.diffRemovedWord).toEqual({ rgb: [179, 89, 107], ansi16: '31' })
    // Warning stays adaptive; success paints blue in both color modes.
    expect(daltonism?.colors.warning).toBeUndefined()
    expect(daltonism?.colors.error).toBeUndefined()
    const truecolor = createPalette(true, 'dark', { preset: daltonism, truecolor: true })
    expect(truecolor.success('x')).toBe('\x1b[38;2;51;153;255mx\x1b[39m')
    expect(truecolor.warning('x')).toBe('\x1b[33mx\x1b[39m')
    const fallback = createPalette(true, 'dark', { preset: daltonism, truecolor: false })
    expect(fallback.success('x')).toBe('\x1b[38;5;75mx\x1b[39m')
    expect(fallback.warning('x')).toBe('\x1b[33mx\x1b[39m')
  })

  it('colors with a preset disabled emits no escapes', () => {
    const palette = createPalette(false, 'dark', { preset: THEME_PRESETS.dracula, truecolor: true })
    expect(palette.accent('x')).toBe('x')
  })

  it('/palette prints the themed SGR pairs, not the adaptive defaults', () => {
    const palette = createPalette(true, 'dark', { preset: THEME_PRESETS.dracula, truecolor: true })
    const rows = renderPalette(palette, 'dark', true, { preset: THEME_PRESETS.dracula, truecolor: true }).join('\n')
    expect(rows).toContain('38;2;189;147;249')
  })
})
