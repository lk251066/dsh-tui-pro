/**
 * The startup logo: "DEEPSEEK HARNESS" as five-row block letters (the
 * dsh-cc-tui convention), painted column-by-column through the brand
 * indigo→ice-blue gradient with an optional shimmer highlight that sweeps
 * across after the banner settles. Narrow terminals drop to the DEEPSEEK word
 * alone, then to plain text (handled by the header, not here).
 * @module @deepseek-ai/dsh-tui/components/logo
 */

import { brandColorAt, type Palette } from './theme.ts'

/** Rows of each letter's 5×5 dot matrix; `#` marks a filled cell. */
const D_GLYPH: readonly string[] = ['####.', '#..#.', '#..#.', '#..#.', '####.']
const GLYPHS: Record<string, readonly string[]> = {
  D: D_GLYPH,
  E: ['#####', '#....', '####.', '#....', '#####'],
  P: ['####.', '#..#.', '####.', '#....', '#....'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  K: ['#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  H: ['#..#.', '#..#.', '####.', '#..#.', '#..#.'],
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  R: ['####.', '#..#.', '####.', '#.#..', '#..#.'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
}

/** The glyph for one letter, falling back to `D` for gaps and unknowns. */
const glyphOf = (letter: string | undefined): readonly string[] =>
  GLYPHS[letter ?? 'D'] ?? D_GLYPH

/** Rows in one glyph. */
const GLYPH_ROWS = 5
/** Columns in one glyph. */
const GLYPH_COLS = 5
/** Blank columns between letters. */
const LETTER_GAP = 1
/** Blank columns between words. */
const WORD_GAP = 4

/** The two banner words, in display order. */
const LOGO_WORDS = ['DEEPSEEK', 'HARNESS'] as const

/** Columns one word's letters occupy. */
export function logoWordWidth(word: string): number {
  return word.length * GLYPH_COLS + (word.length - 1) * LETTER_GAP
}

/** Columns the full two-word logo occupies. */
export function logoFullWidth(): number {
  return LOGO_WORDS.reduce((total, word) => total + logoWordWidth(word), 0) + WORD_GAP
}

/** Columns the DEEPSEEK word alone occupies. */
export function logoSingleWordWidth(): number {
  return logoWordWidth(LOGO_WORDS[0] ?? 'D')
}

/** The unpainted block-letter rows for `words` (no leading pad, no colors). */
function logoRows(words: readonly string[]): string[] {
  const rows: string[] = Array.from({ length: GLYPH_ROWS }, () => '')
  for (const word of words) {
    for (let r = 0; r < GLYPH_ROWS; r += 1) rows[r] += ' '.repeat(WORD_GAP)
    for (let i = 0; i < word.length; i += 1) {
      if (i > 0) {
        for (let r = 0; r < GLYPH_ROWS; r += 1) rows[r] += ' '.repeat(LETTER_GAP)
      }
      const glyph = glyphOf(word[i])
      for (let r = 0; r < GLYPH_ROWS; r += 1) {
        rows[r] += (glyph[r] ?? '').replaceAll('#', '█')
      }
    }
  }
  return rows.map(row => row.slice(WORD_GAP))
}

/** The unpainted full-logo rows (both words). */
export function fullLogoRows(): string[] {
  return logoRows(LOGO_WORDS)
}

/** The unpainted DEEPSEEK-word rows. */
export function singleWordLogoRows(): string[] {
  return logoRows([LOGO_WORDS[0]])
}

/** Columns the shimmer highlight spans. */
export const SHIMMER_WIDTH = 12
/** Milliseconds per shimmer animation step (columns advance 2 per step). */
export const SHIMMER_INTERVAL_MS = 45
/** Bright ice-white the shimmer blends each column toward. */
const SHIMMER_RGB = [234, 246, 255] as const

const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t)

/**
 * Paint one block-letter row: each filled column samples the brand gradient
 * at its position; a shimmer window (when active) blends covered columns
 * toward ice white with a soft edge fade. Without truecolor the row takes a
 * single accent tone and the shimmer brightens with bold.
 * @param row - One unpainted block-letter row from {@link fullLogoRows}.
 * @param palette - Active role palette for the non-truecolor fallback.
 * @param gradient - Whether 24-bit color is on.
 * @param shimmerOffset - Left edge of the shimmer window, or `undefined` off.
 * @returns The styled row.
 */
export function paintLogoRow(
  row: string,
  palette: Palette,
  gradient: boolean,
  shimmerOffset: number | undefined,
): string {
  const width = row.length
  if (shimmerOffset === undefined || !gradient) {
    if (!gradient) {
      return shimmerOffset === undefined
        ? palette.accent(row)
        : Array.from(row, (cell, column) =>
          shimmerCovers(shimmerOffset, column) && cell !== ' ' ? palette.bold(palette.accent(cell)) : palette.accent(cell),
        ).join('')
    }
    let painted = ''
    for (let column = 0; column < width; column += 1) {
      const [r, g, b] = brandColorAt(width <= 1 ? 0 : column / (width - 1))
      painted += `\x1b[38;2;${r};${g};${b}m${row[column]}`
    }
    return `${painted}\x1b[39m`
  }
  let painted = ''
  for (let column = 0; column < width; column += 1) {
    let [r, g, b] = brandColorAt(width <= 1 ? 0 : column / (width - 1))
    const inWindow = shimmerCovers(shimmerOffset, column)
    if (inWindow > 0) {
      const [br, bg, bb] = brandColorAt(width <= 1 ? 0 : column / (width - 1))
      r = lerp(br, SHIMMER_RGB[0], inWindow)
      g = lerp(bg, SHIMMER_RGB[1], inWindow)
      b = lerp(bb, SHIMMER_RGB[2], inWindow)
    }
    painted += `\x1b[38;2;${r};${g};${b}m${row[column]}`
  }
  return `${painted}\x1b[39m`
}

/**
 * Shimmer coverage of one column: 0 outside the window, rising to ~0.92 at
 * its center (a soft pulse rather than a hard band).
 */
function shimmerCovers(offset: number, column: number): number {
  const position = (column - offset) / SHIMMER_WIDTH
  if (position < 0 || position > 1) return 0
  return Math.sin(position * Math.PI) * 0.92
}
