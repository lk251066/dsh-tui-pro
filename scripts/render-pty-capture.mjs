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
const capture = await readFile(capturePath)
await new Promise(resolve => terminal.write(capture, resolve))

const buffer = terminal.buffer.active
const lines = Array.from({ length: buffer.length }, (_, index) =>
  buffer.getLine(index)?.translateToString(true) ?? '')
await writeFile(outputPath, `${lines.join('\n')}\n`)
