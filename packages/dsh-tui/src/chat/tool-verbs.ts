/**
 * Claude-Code-style card titles: a present-progressive verb phrase while a
 * call runs (`⠋ Reading src/foo.ts`) and a settled label with its duration
 * (`⏺ Read src/foo.ts · 0.4s`). Derived purely from the tool-presented views
 * the transcript already computes, so every tool gets a readable header
 * without per-tool special cases here.
 * @module @deepseek-ai/dsh-tui/chat/tool-verbs
 */

import { truncateToWidth } from '@earendil-works/pi-tui'

/** Leading title verbs rewritten into their progressive form while running. */
const PROGRESSIVE_VERBS: Readonly<Record<string, string>> = {
  read: 'Reading',
  write: 'Writing',
  edit: 'Editing',
  create: 'Creating',
  delete: 'Deleting',
  grep: 'Searching',
  glob: 'Finding',
  search: 'Searching',
  fetch: 'Fetching',
  update: 'Updating',
  list: 'Listing',
  run: 'Running',
  send: 'Sending',
  ask: 'Asking',
  load: 'Loading',
  delegate: 'Delegating',
}

/** Longest command echoed into a terminal-card header. */
const MAX_COMMAND_COLUMNS = 48

/** First word of `text` lowercased, when it is a plain ASCII word. */
function leadingWord(text: string): string | undefined {
  const match = /^[A-Za-z][a-z]*(?=\s)/u.exec(text)
  return match === null ? undefined : match[0].toLowerCase()
}

/** `bash` → `Bash`, `str_replace_editor` → `Str_replace_editor` (header casing). */
function capitalized(name: string): string {
  return name.slice(0, 1).toUpperCase() + name.slice(1)
}

/** Truncate a command to header width, terminal-control-safe by the caller. */
function shortCommand(command: string): string {
  return truncateToWidth(command, MAX_COMMAND_COLUMNS, '…')
}

/**
 * The title-bearing slice of call and result views the verb functions read:
 * a card tag plus the presenter's (possibly result-replaced) title.
 */
export interface VerbView {
  card: string
  title?: string
  description?: string
}

/** The terminal card's model-authored description, when non-empty. */
function terminalDescription(view: VerbView): string | undefined {
  const description = view.description
  return description !== undefined && description !== '' ? description : undefined
}

/** A view title with `''` collapsed to the capitalized tool name. */
function titled(name: string, view: VerbView): string {
  return view.title === undefined || view.title === '' ? capitalized(name) : view.title
}

/**
 * Rewrite a view title's leading verb into its progressive form
 * (`Read src/foo.ts` → `Reading src/foo.ts`); unknown leading words pass through.
 */
export function progressiveTitle(name: string, view: VerbView): string {
  if (view.card === 'terminal') {
    // The command itself renders in the body as `$ <cmd>` while pending, so the
    // header carries the model's description, or the command only when absent.
    const description = terminalDescription(view)
    if (description !== undefined) return description
    return `Running ${shortCommand(titled(name, view))}`
  }
  const title = titled(name, view)
  const word = leadingWord(title)
  if (word !== undefined) {
    const progressive = PROGRESSIVE_VERBS[word]
    if (progressive !== undefined) return `${progressive}${title.slice(word.length)}`
  }
  return title
}

/**
 * The settled-state label: the presenter's own title (terminal cards headline
 * the description or the command, Claude-Code `Bash(git status)` style).
 */
export function settledTitle(name: string, view: VerbView): string {
  if (view.card === 'terminal') {
    const description = terminalDescription(view)
    if (description !== undefined) return description
    return `${capitalized(name)}(${shortCommand(titled(name, view))})`
  }
  return titled(name, view)
}
