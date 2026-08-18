/**
 * The transcript's shared terminal glyphs, in one place (the role Claude Code
 * gives its `constants/figures.ts`): every marker a card or status line draws
 * lives here, so a glyph whose rendering differs across terminals gets its
 * platform branch once instead of per call site.
 * @module @deepseek-ai/dsh-tui/components/figures
 */

/**
 * The marker glyph for a tool card whose result has settled. `⏺` renders level
 * with the card title in macOS terminal fonts but sits visibly above the line
 * on Windows and Linux, so those platforms fall back to `●` (the same branch
 * Claude Code ships).
 * @param platform - The platform to pick the glyph for; defaults to the
 * running process's platform (injectable so tests can pin either branch).
 * @returns The settled-card glyph for `platform`.
 */
export function TOOL_SETTLED(platform: NodeJS.Platform = process.platform): string {
  return platform === 'darwin' ? '⏺' : '●'
}

/** Prefix of a card's first result row (the Claude Code `⎿` continuation). */
export const RESULT_MARKER = '  ⎿ '
/** Indent aligning a card's continuation rows under the marker's text column. */
export const RESULT_CONTINUATION = '    '
/** Directional marker for the user's own message. */
export const USER_GLYPH = '❯'
/** Four-point marker for assistant prose. */
export const ASSISTANT_GLYPH = '✦'
/** Lighter starburst opening a thinking line. */
export const THINKING_GLYPH = '✻'

/**
 * A shortcut hint in the Claude Code form `(ctrl+o to expand)`: the shortcut
 * in its conventional casing (lowercase modifier combos `ctrl+o`, capitalized
 * named keys `Enter`/`Esc`) followed by the action it performs. Callers wrap
 * the hint in their own dimming; this only formats.
 * @param shortcut - The shortcut as conventionally cased, e.g. `ctrl+o`.
 * @param action - What pressing it does, e.g. `expand`.
 * @param options - `parens: false` drops the surrounding parentheses for
 * hints embedded in prose; the default wraps them.
 * @returns The formatted hint.
 */
export function shortcutHint(
  shortcut: string,
  action: string,
  options: { parens?: boolean } = {},
): string {
  const hint = `${shortcut} to ${action}`
  return options.parens === false ? hint : `(${hint})`
}
