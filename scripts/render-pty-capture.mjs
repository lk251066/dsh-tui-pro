import { readFile, writeFile } from 'node:fs/promises'
import xtermHeadless from '@xterm/headless'

const { Terminal } = xtermHeadless

const [capturePath, outputPath] = process.argv.slice(2)
if (capturePath === undefined || outputPath === undefined) {
  throw new Error('usage: render-pty-capture.mjs <capture> <output>')
}

const terminal = new Terminal({
  allowProposedApi: true,
  cols: 140,
  rows: 32,
  scrollback: 2_000,
})
// Stop at the last completed synchronized frame. Shutdown deliberately moves
// below the rendered content before restoring the normal buffer, which may
// scroll the alternate screen but is not part of the live workbench frame.
const capture = (await readFile(capturePath)).toString('utf8')
const leaveAlternate = capture.lastIndexOf('\x1b[?1049l')
const frameEndSequence = '\x1b[?2026l'
const frameEnd = capture.lastIndexOf(frameEndSequence, leaveAlternate)
const replay = frameEnd < 0 ? capture : capture.slice(0, frameEnd + frameEndSequence.length)
await new Promise(resolve => terminal.write(replay, resolve))

const buffer = terminal.buffer.active
const lines = Array.from({ length: buffer.length }, (_, index) =>
  buffer.getLine(index)?.translateToString(true) ?? '')
await writeFile(outputPath, `${lines.join('\n')}\n`)
