/**
 * The Claude-Code-style whimsical spinner verbs ("✻ Caramelizing…"): one playful
 * present-progressive word picked per turn for the working status line while the
 * model streams between tool calls. Stored capitalized and bare — the caller
 * appends the ellipsis — so they read naturally wherever a label is composed.
 * @module @deepseek-ai/dsh-tui/chat/spinner-verbs
 */

/**
 * ~50 playful English gerunds in Claude Code's voice, each a single capitalized
 * word without punctuation. Family-friendly by design: the spinner is on screen
 * in every session, so nothing risqué or demeaning ships here.
 */
export const SPINNER_VERBS: readonly string[] = [
  'Actioning',
  'Brewing',
  'Calculating',
  'Caramelizing',
  'Channelling',
  'Coalescing',
  'Cogitating',
  'Computing',
  'Conjuring',
  'Contemplating',
  'Crafting',
  'Crunching',
  'Deciphering',
  'Deliberating',
  'Determining',
  'Divining',
  'Elucidating',
  'Envisioning',
  'Finagling',
  'Forging',
  'Generating',
  'Hatching',
  'Herding',
  'Hustling',
  'Ideating',
  'Inferring',
  'Manifesting',
  'Marinating',
  'Moseying',
  'Mulling',
  'Mustering',
  'Musing',
  'Noodling',
  'Percolating',
  'Pondering',
  'Processing',
  'Puttering',
  'Reticulating',
  'Ruminating',
  'Scheming',
  'Schlepping',
  'Shucking',
  'Simmering',
  'Smooshing',
  'Spinning',
  'Stewing',
  'Sussing',
  'Transmuting',
  'Vibing',
  'Wriggling',
]

/**
 * Deterministically pick this turn's spinner verb from any numeric seed (a turn
 * index, a timestamp, anything stable within the turn): the same seed always
 * yields the same verb, so renders stay stable and tests can pin expectations.
 * Negative seeds fold onto their absolute value.
 *
 * @param seed - Any number; only its magnitude modulo the verb count matters.
 * @returns The verb for that seed, one of {@link SPINNER_VERBS}.
 */
export function pickSpinnerVerb(seed: number): string {
  return SPINNER_VERBS[Math.abs(seed) % SPINNER_VERBS.length] as string
}
