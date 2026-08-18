/**
 * Theme-agnostic ANSI palette and derived pi-tui themes for the terminal front
 * door. The palette is built from the standard 16-color ANSI set plus SGR
 * attributes so every terminal remaps it to its active color scheme.
 * @module @deepseek-ai/dsh-tui/components/theme
 */

import type {
  MarkdownTheme,
  RgbColor,
  SelectListTheme,
  TerminalColorScheme,
} from '@earendil-works/pi-tui'
import type { PresetColor, PresetColorRole, ThemePreset } from './theme-presets.ts'

/**
 * Text carrying exactly one palette color. Branded so the compiler rejects
 * wrapping it in a second color: SGR has no color stack, so an inner span's
 * close reverts to the default foreground rather than the outer color, which
 * silently drops the outer color for the remainder of the line.
 */
export type Colored = string & { readonly __coloredBy: unique symbol }

/**
 * Text a color may still be applied to: a bare string, or one already carrying
 * SGR attributes. Attributes (bold, italic, underline, strike, reverse) occupy
 * independent SGR groups from the foreground color, so they compose in either
 * order without either side clobbering the other.
 */
export type Colorable = string & { readonly __coloredBy?: undefined }

/** Applies one color role; rejects input that already carries a color. */
export type ColorRole = (text: Colorable) => Colored

/**
 * Applies one SGR attribute or the bubble background fill; accepts colored or
 * uncolored text and preserves its color. Attributes (bold, italic, underline,
 * strike, reverse) and the background occupy independent SGR groups from the
 * foreground color, so they compose in either order without either side
 * clobbering the other.
 */
export type AttributeRole = <T extends string>(text: T) => T

/**
 * Theme-agnostic role colors and SGR attribute wrappers.
 *
 * One role per visual meaning: `dim` is the single recessed tone, `accent`
 * emphasizes controls, transcript roles distinguish actors and activity, and
 * `success`/`error` double as a diff's added/removed pair.
 *
 * Colors and attributes are separately typed: `bold(accent(x))` and
 * `accent(bold(x))` both compile, while `accent(error(x))` does not.
 */
export interface Palette {
  accent: ColorRole
  /** DeepSeek brand ink; exact gradient callers may override it on truecolor terminals. */
  brand: ColorRole
  /** The terminal's own default foreground; still a color, so it does not stack. */
  text: ColorRole
  /** The one recessed tone, below `text`: tool-card bodies, chrome, reasoning, footers. */
  dim: ColorRole
  success: ColorRole
  warning: ColorRole
  error: ColorRole
  /** Permission prompts and inline code, CC's permission blue. */
  permission: ColorRole
  /** Plan-mode surfaces, CC's plan teal (reserved until the plan chip lands). */
  plan: ColorRole
  /** User-message gutter marker. */
  user: ColorRole
  /** Assistant-message gutter marker. */
  assistant: ColorRole
  /** Thinking gutter marker, distinct from visible reasoning text. */
  thinking: ColorRole
  /** Running tool marker and title; settled state colors still take precedence. */
  tool: ColorRole
  code: ColorRole
  /** Changed words on a diff's added lines: bold over the line color. */
  diffAddedWord: ColorRole
  /** Changed words on a diff's removed lines: bold over the line color. */
  diffRemovedWord: ColorRole
  bold: AttributeRole
  italic: AttributeRole
  underline: AttributeRole
  strike: AttributeRole
  /** Reverse video for the active selection; swaps the theme's own fg/bg so it reads on any scheme. */
  selected: AttributeRole
  /**
   * Background fill behind the user-message bubble — the palette's one
   * background exception. Derived from the terminal background by
   * {@link createPalette} (slightly lifted on dark schemes, slightly shaded on
   * light ones), never a fixed spec color, so it reads as a whisper of contrast
   * on whatever canvas the terminal already has. A background SGR emits no
   * glyphs, so a transcript drag-select still copies clean text.
   */
  bubble: AttributeRole
}

/** Names of the palette's color roles, in the order `/palette` prints them. */
export const COLOR_ROLES = [
  'text',
  'dim',
  'accent',
  'brand',
  'user',
  'assistant',
  'thinking',
  'tool',
  'code',
  'success',
  'warning',
  'error',
  'permission',
  'plan',
  'diffAddedWord',
  'diffRemovedWord',
] as const

/** One color role's name. */
export type ColorRoleName = typeof COLOR_ROLES[number]

/** Names of the palette's attribute roles, in the order `/palette` prints them. */
export const ATTRIBUTE_ROLES = ['bold', 'italic', 'underline', 'strike', 'selected'] as const

/** One role's SGR parameters and the reason it carries them. */
export interface RoleSpec {
  /** SGR parameters that open the span, without the `ESC [` prefix or `m` suffix. */
  readonly open: string
  /** SGR parameters that close it; MUST reset every group `open` sets. */
  readonly close: string
  /** What the role means, shown by `/palette`. */
  readonly purpose: string
}

/**
 * Every foreground and attribute SGR code the TUI is allowed to emit, keyed by
 * role. This table is the single source for those roles: {@link createPalette}
 * derives the wrappers from it and `/palette` prints it, so a role cannot exist
 * in one and not the other, and no component hand-writes an escape. The one
 * background fill (the user-message `bubble` role) is not here: it is derived
 * from the probed terminal background by {@link bubbleSpec}, since a fixed spec
 * color cannot track the terminal's canvas.
 *
 * Only the standard 16-color set and SGR attributes appear here. Terminals remap
 * those to the user's active theme, so the TUI stays legible on any background;
 * a fixed 24-bit color would not. The startup gradient and exact official mark
 * color are the two deliberate brand exceptions ({@link gradientText},
 * {@link brandText}).
 *
 * @param scheme - Active terminal color scheme; only `code` differs between them.
 * @returns The SGR spec for every color and attribute role.
 */
export function paletteSpec(scheme: TerminalColorScheme): {
  readonly colors: Readonly<Record<typeof COLOR_ROLES[number], RoleSpec>>
  readonly attributes: Readonly<Record<typeof ATTRIBUTE_ROLES[number], RoleSpec>>
} {
  return {
    colors: {
      // The terminal's own foreground, emitted as no escape at all: ordinary body
      // text must inherit whatever the user's theme uses.
      text: { open: '', close: '', purpose: 'Body text, the terminal default foreground' },
      // SGR 2 over an explicit default foreground, closing both groups it sets.
      // The attribute fades relative to whatever the terminal's own foreground is,
      // which is the only way to land *below* `text` on both schemes: ANSI 90
      // (bright black) is a fixed hue that many light themes render heavier than
      // their default foreground, which made every "dim" surface the most
      // prominent text on screen.
      dim: { open: '2;39', close: '22;39', purpose: 'The one recessed tone: tool bodies, chrome, footers' },
      accent: { open: '95', close: '39', purpose: 'The one emphasis color: prompt, borders, and active controls' },
      brand: { open: '34', close: '39', purpose: 'DeepSeek brand art when truecolor is unavailable' },
      user: { open: '36', close: '39', purpose: 'User-message gutter marker' },
      assistant: { open: '94', close: '39', purpose: 'Assistant-message gutter marker' },
      thinking: { open: '95', close: '39', purpose: 'Thinking gutter marker' },
      tool: { open: '36', close: '39', purpose: 'Running tool marker and title' },
      // ANSI 36 (cyan) is difficult to read on a light background — use ANSI 34
      // (blue) which is legible on both light and dark schemes.
      code: scheme === 'light'
        ? { open: '34', close: '39', purpose: 'Inline code and code blocks in prose' }
        : { open: '36', close: '39', purpose: 'Inline code and code blocks in prose' },
      success: { open: '32', close: '39', purpose: 'Succeeded calls, and a diff\'s added lines' },
      warning: { open: '33', close: '39', purpose: 'Pending calls and warnings' },
      error: { open: '31', close: '39', purpose: 'Failures, signals, and a diff\'s removed lines' },
      // Semantic roles mirroring Claude Code's theme: permission's bright blue
      // and plan's white-on-dark teal.
      permission: { open: '94', close: '39', purpose: 'Permission prompts and inline code' },
      plan: { open: '37', close: '39', purpose: 'Plan-mode surfaces' },
      // Word-level diff emphasis: bold over the side's own line color, so the
      // changed words stand out inside an already green/red row while the
      // palette stays foreground-only.
      diffAddedWord: { open: '1;32', close: '22;39', purpose: 'A diff\'s changed words on added lines' },
      diffRemovedWord: { open: '1;31', close: '22;39', purpose: 'A diff\'s changed words on removed lines' },
    },
    attributes: {
      bold: { open: '1', close: '22', purpose: 'Emphasis; composes with any color' },
      italic: { open: '3', close: '23', purpose: 'Reasoning text' },
      underline: { open: '4', close: '24', purpose: 'Underlined Markdown and emphasized controls' },
      strike: { open: '9', close: '29', purpose: 'Struck-through Markdown' },
      selected: { open: '7', close: '27', purpose: 'Reverse video for the active selection' },
    },
  }
}

/**
 * Wrap text in an SGR pair, or pass it through when color is disabled.
 * An empty `open` emits nothing, so the `text` role costs no escape.
 */
function ansi(spec: RoleSpec, enabled: boolean): (text: string) => string {
  if (!enabled || spec.open === '') return text => text
  return text => `\x1b[${spec.open}m${text}\x1b[${spec.close}m`
}

/** Options steering {@link createPalette} toward a named theme preset. */
export interface PaletteOptions {
  /** Named preset overriding color roles; absent keeps the adaptive 16-color spec. */
  preset?: ThemePreset
  /** Whether 24-bit SGR may be emitted, painting preset roles as `38;2;r;g;b`. */
  truecolor?: boolean
  /**
   * The terminal's probed background (OSC 11), used as the bubble mix base when
   * known; absent falls back to the preset's assumed canvas, then the scheme.
   */
  background?: RgbColor
}

/** White fraction mixed into a dark terminal background for the bubble fill. */
const BUBBLE_DARK_LIFT = 0.08
/** Black fraction mixed into a light terminal background for the bubble fill. */
const BUBBLE_LIGHT_SHADE = 0.04

/**
 * The user-message bubble's background spec, derived from the terminal's canvas
 * rather than a fixed color: a dark background lifted ~8% toward white, a
 * light one shaded ~4% toward black, so the bubble reads as a whisper of
 * contrast on any scheme (codex's user-bubble treatment). The mix base is the
 * probed terminal background when known, else the preset's assumed canvas, else
 * the scheme's black/white pole; the base's own luma picks the mix direction.
 * Without truecolor the fill degrades to the nearest ANSI background (bright
 * black on dark, white on light).
 *
 * @param scheme - Active terminal color scheme; selects the fallback base.
 * @param options - Preset/truecolor/background options shared with the palette.
 * @returns The SGR spec for the bubble background fill.
 */
export function bubbleSpec(scheme: TerminalColorScheme, options: PaletteOptions = {}): RoleSpec {
  const presetBackground = options.preset?.background
  const base: RgbColor = options.background
    ?? (presetBackground === undefined
      ? undefined
      : { r: presetBackground[0], g: presetBackground[1], b: presetBackground[2] })
    ?? (scheme === 'dark' ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 })
  // Rec. 601 luma against the midpoint between the two ANSI fallback fills.
  const dark = 0.299 * base.r + 0.587 * base.g + 0.114 * base.b < 128
  if (options.truecolor !== true) return { open: dark ? '100' : '47', close: '49', purpose: 'User-message bubble fill' }
  const mix = (channel: number): number => dark
    ? Math.round(channel + (255 - channel) * BUBBLE_DARK_LIFT)
    : Math.round(channel * (1 - BUBBLE_LIGHT_SHADE))
  return {
    open: `48;2;${mix(base.r)};${mix(base.g)};${mix(base.b)}`,
    close: '49',
    purpose: 'User-message bubble fill',
  }
}

/**
 * Theme-agnostic palette derived from {@link paletteSpec}. Body `text` stays the
 * terminal's default foreground so it reads on light and dark backgrounds alike;
 * grouping uses foreground-only bold and reverse video rather than per-line
 * role prefixes, so a transcript drag-select copies message text without stray
 * glyphs. The one background exception is the user-message
 * `bubble` fill ({@link bubbleSpec}): a background SGR emits no glyphs either,
 * so the copied text stays clean while the user's own messages stand apart.
 *
 * @param enabled - Whether ANSI is emitted at all.
 * @param scheme - Active terminal color scheme; adjusts the code role.
 * @param options - Optional named-preset overrides (`/theme`) and the probed
 * terminal background the bubble fill derives from.
 * @returns The role palette for the given scheme.
 */
export function createPalette(
  enabled: boolean,
  scheme: TerminalColorScheme = 'dark',
  options: PaletteOptions = {},
): Palette {
  const spec = resolveSpec(scheme, options)
  const roles = {} as Record<string, unknown>
  for (const name of COLOR_ROLES) roles[name] = ansi(spec.colors[name], enabled)
  for (const name of ATTRIBUTE_ROLES) roles[name] = ansi(spec.attributes[name], enabled)
  roles.bubble = ansi(bubbleSpec(scheme, options), enabled)
  return roles as unknown as Palette
}

/**
 * The role spec for one scheme with optional preset overrides applied — the
 * single resolution path shared by {@link createPalette} and `/palette`.
 */
function resolveSpec(scheme: TerminalColorScheme, options: PaletteOptions): ReturnType<typeof paletteSpec> {
  const base = paletteSpec(scheme)
  const { preset, truecolor } = options
  if (preset === undefined) return base
  const colors = { ...base.colors } as Record<ColorRoleName, RoleSpec>
  for (const [role, color] of Object.entries(preset.colors) as [PresetColorRole, PresetColor][]) {
    const attribute = color.truecolorAttribute
    colors[role] = {
      open: truecolor === true
        ? `${attribute === undefined ? '' : `${attribute.open};`}38;2;${color.rgb[0]};${color.rgb[1]};${color.rgb[2]}`
        : color.ansi16,
      // The default closes only the foreground group; attribute-bearing roles
      // (the dim's faint) reset both groups so the attribute never bleeds.
      close: color.close ?? (attribute === undefined ? '39' : `${attribute.close};39`),
      purpose: `${base.colors[role].purpose} (themed)`,
    }
  }
  return { ...base, colors }
}

/**
 * DeepSeek brand gradient stops (indigo → light blue) taken from the
 * deepseek.com logo, painted across the startup banner's product name on
 * truecolor terminals. Fixed brand identity, deliberately outside the
 * theme-adaptive {@link Palette}.
 */
const BRAND_GRADIENT = [
  [77, 107, 254], // #4D6BFE
  [57, 130, 255], // #3982FF
  [36, 152, 255], // #2498FF
] as const

/** Official DeepSeek icon ink from the shipped 24x24 SVG. */
const DEEPSEEK_BRAND_RGB = BRAND_GRADIENT[0]

/**
 * Paint trusted static DeepSeek brand art with the official `#4D6BFE` ink.
 * @param text - Static brand text or raster cells.
 * @returns text wrapped in the official truecolor foreground and a foreground reset.
 */
export function brandText(text: string): string {
  const [r, g, b] = DEEPSEEK_BRAND_RGB
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`
}

/**
 * Sample {@link BRAND_GRADIENT} at fraction `t` via piecewise-linear
 * interpolation across its stops.
 *
 * @param t - Position along the gradient; clamped to [0, 1].
 * @returns The interpolated `[r, g, b]` channels, each rounded to 0–255.
 */
export function brandColorAt(t: number): readonly [number, number, number] {
  const span = Math.min(Math.max(t, 0), 1) * (BRAND_GRADIENT.length - 1)
  const index = Math.min(Math.floor(span), BRAND_GRADIENT.length - 2)
  const local = span - index
  // `index` is clamped to a valid adjacent pair, so both lookups are in-bounds.
  const from = BRAND_GRADIENT[index] as readonly [number, number, number]
  const to = BRAND_GRADIENT[index + 1] as readonly [number, number, number]
  return [
    Math.round(from[0] + (to[0] - from[0]) * local),
    Math.round(from[1] + (to[1] - from[1]) * local),
    Math.round(from[2] + (to[2] - from[2]) * local),
  ]
}

/**
 * Paint `text` left-to-right in the DeepSeek brand gradient with per-character
 * 24-bit foreground codes, resetting to the default foreground at the end.
 * Foreground-only, so it stays legible on any terminal background; the caller
 * gates it on truecolor support and wraps it in bold.
 *
 * @param text - Text to colorize; sampled once per character.
 * @returns `text` wrapped in truecolor SGR foreground codes.
 */
export function gradientText(text: string): string {
  const glyphs = Array.from(text)
  const last = Math.max(1, glyphs.length - 1)
  let painted = ''
  for (let index = 0; index < glyphs.length; index += 1) {
    const [r, g, b] = brandColorAt(index / last)
    painted += `\x1b[38;2;${r};${g};${b}m${glyphs[index]}`
  }
  return `${painted}\x1b[39m`
}

/**
 * Derive the pi-tui Markdown theme from a role palette.
 * @param palette - Active role palette.
 * @param highlightCode - Optional syntax highlighter for fenced code blocks;
 * absent renders every code row through the single `codeBlock` role.
 * @returns The Markdown theme wired to palette roles.
 */
export function markdownTheme(palette: Palette, highlightCode?: (code: string, lang?: string) => string[]): MarkdownTheme {
  return {
    // Claude Code's heading form: bold (plus underline on h1), never colored.
    // pi-tui's Markdown renderer applies that bold itself around this callback,
    // which only contributes color — so the identity keeps headings uncolored.
    // The theme callback carries no heading level, so h1's extra underline is
    // the renderer's own and cannot be themed per level from here.
    heading: text => text,
    link: text => palette.accent(text),
    // pi-tui requires this URL slot but its current Markdown renderer does not invoke it.
    /* v8 ignore next */
    linkUrl: text => palette.dim(text),
    // Inline code takes the blue emphasis family (CC paints it permission
    // blue); blocks keep the dedicated code role under the syntax highlighter.
    code: text => palette.accent(text),
    codeBlock: text => palette.code(text),
    ...(highlightCode !== undefined ? { highlightCode } : {}),
    // Every code-block row carries the thinking bar's dim `▎` left edge, so a
    // block stays delimited even where the code tone sits close to body text.
    // pi-tui prepends `codeBlockIndent` to each code line (the SGR pair closes
    // before the line's own colors, so nothing nests) and presents both fence
    // rows through `codeBlockBorder`: the opening fence keeps its language
    // label next to the bar, the otherwise-empty close draws the bar alone.
    codeBlockIndent: `${palette.dim('▎')} `,
    codeBlockBorder: (text) => {
      const language = text.slice(3)
      return language === '' ? palette.dim('▎') : palette.dim(`▎ ${language}`)
    },
    // CC quotes: italic body at normal brightness, dim `▎` bar. pi-tui hardcodes
    // the `│ ` border string but routes it through this callback, so the bar
    // glyph is swapped here rather than in the renderer.
    quote: text => palette.italic(text),
    quoteBorder: text => palette.dim(text.replace('│', '▎')),
    hr: text => palette.dim(text),
    listBullet: text => palette.accent(text),
    bold: text => palette.bold(text),
    italic: text => palette.italic(text),
    // Strikethrough renders as plain text: models write `~` for approximations
    // far more often than they mean to strike. pi-tui offers no parse toggle
    // (its Markdown options only preserve list markers and backslash escapes),
    // so the theme callback passes the content through unstruck.
    strikethrough: text => text,
    underline: text => palette.underline(text),
  }
}

/**
 * Derive the pi-tui select-list theme from a role palette.
 * @param palette - Active role palette.
 * @returns The select-list theme wired to palette roles.
 */
export function selectTheme(palette: Palette): SelectListTheme {
  return {
    selectedPrefix: palette.accent,
    selectedText: palette.accent,
    description: palette.dim,
    scrollInfo: palette.dim,
    noMatch: palette.warning,
  }
}

/**
 * Derive the reverse-video dialog select-list theme from a role palette.
 * @param palette - Active role palette.
 * @returns The dialog select-list theme with a reverse-video selection.
 */
export function dialogSelectTheme(palette: Palette): SelectListTheme {
  return {
    ...selectTheme(palette),
    selectedText: text => palette.selected(palette.accent(text)),
  }
}

/** Sample text every `/palette` row renders, long enough to judge a tone against its neighbours. */
const PALETTE_SAMPLE = 'The quick brown fox 0123'

/**
 * Render every palette role as a labelled sample row, each painted by the role
 * it names, so a reader compares the actual tones their terminal produces rather
 * than reading SGR numbers. Colors print first and attributes second because the
 * two groups compose in that order; every row shows its SGR pair so a mismatch
 * between the table and the screen is visible.
 *
 * @param palette - Active role palette, used to paint each sample.
 * @param scheme - Active color scheme, reported in the heading and selecting the spec.
 * @param colorEnabled - Whether ANSI is emitted; reported so an unstyled listing is not confusing.
 * @param options - The same preset options the palette was built with, so the
 * printed SGR pairs match the live roles.
 * @returns The rendered rows, without a trailing blank.
 */
export function renderPalette(
  palette: Palette,
  scheme: TerminalColorScheme,
  colorEnabled: boolean,
  options: PaletteOptions = {},
): string[] {
  const spec = resolveSpec(scheme, options)
  const width = Math.max(...[...COLOR_ROLES, ...ATTRIBUTE_ROLES].map(name => name.length))
  // Two rows per role: the painted sample beside its name and SGR pair, then the
  // purpose indented under it. Splitting the purpose onto its own row keeps every
  // sample on one visual line at the narrow widths a side-by-side pane gives.
  const head = (name: string, role: RoleSpec, sample: string): string => {
    const pair = role.open === '' ? 'no escape' : `ESC[${role.open}m ESC[${role.close}m`
    return `  ${sample}  ${palette.dim(`${name.padEnd(width)} ${pair}`)}`
  }
  const purpose = (role: RoleSpec): string => `  ${palette.dim(`    ${role.purpose}`)}`
  const rows = [
    palette.bold(palette.accent('Palette')),
    palette.dim(`${scheme} scheme · color ${colorEnabled ? 'on' : 'off'}`),
    '',
    palette.dim('Colors — exactly one per span; they never nest inside each other.'),
  ]
  for (const name of COLOR_ROLES) {
    rows.push(head(name, spec.colors[name], palette[name](PALETTE_SAMPLE)), purpose(spec.colors[name]))
  }
  rows.push('', palette.dim('Attributes — compose with any color, in either order.'))
  for (const name of ATTRIBUTE_ROLES) {
    rows.push(head(name, spec.attributes[name], palette[name](PALETTE_SAMPLE)), purpose(spec.attributes[name]))
  }
  return rows
}
