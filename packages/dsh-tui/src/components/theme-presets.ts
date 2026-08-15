/**
 * Named color presets for `/theme`. Each preset overrides palette color roles
 * with fixed RGB values painted as 24-bit SGR on truecolor terminals, falling
 * back to a hand-picked standard-ANSI code otherwise; the `deepseek` default
 * keeps the terminal's own 16-color scheme authoritative for every adaptive
 * role, overriding only the fixed CC-derived semantic colors every preset
 * shares (permission, plan, and the reserved diff word tokens).
 * @module @deepseek-ai/dsh-tui/components/theme-presets
 */

import type { ColorRoleName } from './theme.ts'

/**
 * Keys a preset may color: the palette's live roles plus reserved tokens that
 * are defined ahead of their wiring (the diff word-level colors) and stay inert
 * until a palette role exists for them.
 */
export type PresetColorRole = ColorRoleName | 'diffAddedWord' | 'diffRemovedWord'

/** One role's preset color: exact RGB for truecolor, nearest ANSI code otherwise. */
export interface PresetColor {
  /** 24-bit foreground channels, emitted as `38;2;r;g;b` on truecolor terminals. */
  readonly rgb: readonly [number, number, number]
  /** Standard SGR color parameters for terminals without truecolor. */
  readonly ansi16: string
  /** SGR close parameters; defaults to `39` (reset the foreground group only). */
  readonly close?: string
  /** Attribute params composed with the truecolor foreground (the dim's faint). */
  readonly truecolorAttribute?: { readonly open: string; readonly close: string }
}

/** A named theme: overrides for the palette's color roles. */
export interface ThemePreset {
  /** One-line picker description. */
  readonly description: string
  /** Whether the palette assumes a dark terminal background. */
  readonly dark: boolean
  /** Per-role overrides; roles absent keep the adaptive 16-color spec. */
  readonly colors: Partial<Record<PresetColorRole, PresetColor>>
}

/** Relative dim fallback: faint attribute over the default foreground, on any scheme. */
const dimColor = (rgb: readonly [number, number, number]): PresetColor => ({
  rgb,
  ansi16: '2;39',
  close: '22;39',
  truecolorAttribute: { open: '2', close: '22' },
})

/**
 * Semantic roles copied from Claude Code's theme, identical in every preset
 * (the presets are all dark, so the dark values apply): permission's blue and
 * plan's teal.
 */
const permissionColor: PresetColor = { rgb: [87, 105, 247], ansi16: '94' }
const planColor: PresetColor = { rgb: [72, 150, 140], ansi16: '37' }

/** Reserved diff word-level tokens (CC's values), defined but not yet wired to the palette. */
const diffAddedWordColor: PresetColor = { rgb: [56, 166, 96], ansi16: '32' }
const diffRemovedWordColor: PresetColor = { rgb: [179, 89, 107], ansi16: '31' }

/** The semantic roles and reserved diff tokens every preset carries. */
const semanticColors = {
  permission: permissionColor,
  plan: planColor,
  diffAddedWord: diffAddedWordColor,
  diffRemovedWord: diffRemovedWordColor,
} as const

/**
 * The shipped themes, in picker order. `deepseek` is the adaptive default.
 */
export const THEME_PRESETS: Readonly<Record<string, ThemePreset>> = {
  deepseek: {
    description: 'Adaptive DeepSeek — the terminal\'s own 16-color scheme',
    dark: false,
    colors: { ...semanticColors },
  },
  dracula: {
    description: 'Dracula — purple accent on deep night',
    dark: true,
    colors: {
      accent: { rgb: [189, 147, 249], ansi16: '35' },
      brand: { rgb: [189, 147, 249], ansi16: '35' },
      code: { rgb: [139, 233, 253], ansi16: '36' },
      success: { rgb: [80, 250, 123], ansi16: '32' },
      warning: { rgb: [241, 250, 140], ansi16: '33' },
      error: { rgb: [255, 85, 85], ansi16: '31' },
      dim: dimColor([98, 114, 164]),
      ...semanticColors,
    },
  },
  nord: {
    description: 'Nord — frost-blue accent, polar-night tones',
    dark: true,
    colors: {
      accent: { rgb: [136, 192, 208], ansi16: '36' },
      brand: { rgb: [94, 129, 172], ansi16: '34' },
      code: { rgb: [143, 188, 187], ansi16: '36' },
      success: { rgb: [163, 190, 140], ansi16: '32' },
      warning: { rgb: [235, 203, 139], ansi16: '33' },
      error: { rgb: [191, 97, 106], ansi16: '31' },
      dim: dimColor([97, 110, 136]),
      ...semanticColors,
    },
  },
  'catppuccin-mocha': {
    description: 'Catppuccin Mocha — pastel lavender accent',
    dark: true,
    colors: {
      accent: { rgb: [203, 166, 247], ansi16: '35' },
      brand: { rgb: [137, 180, 250], ansi16: '34' },
      code: { rgb: [148, 226, 213], ansi16: '36' },
      success: { rgb: [166, 227, 161], ansi16: '32' },
      warning: { rgb: [249, 226, 175], ansi16: '33' },
      error: { rgb: [243, 139, 168], ansi16: '31' },
      dim: dimColor([147, 153, 178]),
      ...semanticColors,
    },
  },
  daltonism: {
    description: 'Daltonism — green roles shifted to blue',
    dark: true,
    colors: {
      // The adaptive scheme with every green role moved to blue: success (and
      // the diff's added lines through it) plus the reserved added-word token.
      // Warning and error keep the adaptive hues.
      ...semanticColors,
      success: { rgb: [51, 153, 255], ansi16: '38;5;75' },
      diffAddedWord: { rgb: [51, 153, 255], ansi16: '38;5;75' },
    },
  },
}

/** Preset names in picker order. */
export const THEME_PRESET_NAMES: readonly string[] = Object.keys(THEME_PRESETS)
