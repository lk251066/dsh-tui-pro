/**
 * Clipboard delivery for local terminals and remote terminal transports.
 * @module @lk251066/dsh-tui/clipboard
 */

import { spawn } from 'node:child_process'
import clipboard from 'clipboardy'
import type { Terminal } from '@earendil-works/pi-tui'

/** Clipboard path used for a completed write. */
export type ClipboardMethod = 'system' | 'tmux' | 'terminal'

/** Injectable environment used by clipboard strategy tests. */
export interface ClipboardOptions {
  readonly env?: NodeJS.ProcessEnv
  readonly writeSystem?: (text: string) => Promise<void>
  readonly writeTmux?: (text: string) => Promise<void>
}

function writeOsc52(text: string, terminal: Pick<Terminal, 'write'>): void {
  terminal.write(`\x1b]52;c;${Buffer.from(text, 'utf8').toString('base64')}\x07`)
}

function writeTmuxBuffer(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('tmux', ['load-buffer', '-w', '-'], {
      stdio: ['pipe', 'ignore', 'pipe'],
      windowsHide: true,
    })
    let settled = false
    const succeed = (): void => {
      if (settled) return
      settled = true
      resolve()
    }
    const fail = (error: unknown): void => {
      if (settled) return
      settled = true
      reject(error)
    }
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', fail)
    child.stdin.once('error', fail)
    child.once('close', (code) => {
      if (code === 0) succeed()
      else fail(new Error(stderr.trim() || `tmux exited with code ${String(code)}`))
    })
    child.stdin.end(text)
  })
}

/**
 * Copy text to the user's clipboard, preferring the local system outside remote sessions.
 * @param text - Plain text to copy.
 * @param terminal - Active terminal used for OSC 52 fallback.
 * @param options - Injectable environment and writers.
 * @returns The clipboard path that accepted the text.
 */
export async function copyText(
  text: string,
  terminal: Pick<Terminal, 'write'>,
  options: ClipboardOptions = {},
): Promise<ClipboardMethod> {
  if (text === '') throw new Error('Cannot copy empty text.')
  const env = options.env ?? process.env
  const system = options.writeSystem ?? (value => clipboard.write(value))
  const tmux = options.writeTmux ?? writeTmuxBuffer

  if (env.TMUX !== undefined) {
    try {
      await tmux(text)
      return 'tmux'
    } catch (tmuxError: unknown) {
      try {
        writeOsc52(text, terminal)
        return 'terminal'
      } catch (terminalError: unknown) {
        throw new AggregateError([tmuxError, terminalError], 'Clipboard write failed.')
      }
    }
  }

  if (env.SSH_CONNECTION !== undefined || env.SSH_TTY !== undefined) {
    writeOsc52(text, terminal)
    return 'terminal'
  }

  try {
    await system(text)
    return 'system'
  } catch (systemError: unknown) {
    try {
      writeOsc52(text, terminal)
      return 'terminal'
    } catch (terminalError: unknown) {
      throw new AggregateError([systemError, terminalError], 'Clipboard write failed.')
    }
  }
}
