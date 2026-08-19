import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import gifenc from 'gifenc'
import { PNG } from 'pngjs'

const OUTPUT_DIR = resolve('.test-results/readme')
const OUTPUT_PATH = resolve('packages/dsh-tui/assets/session-workbench.gif')
const FRAMES = [
  { path: resolve(OUTPUT_DIR, 'demo-01-project.png'), delay: 1_400 },
  { path: resolve(OUTPUT_DIR, 'demo-02-switcher.png'), delay: 1_500 },
  { path: resolve(OUTPUT_DIR, 'demo-03-docs.png'), delay: 1_800 },
  { path: resolve(OUTPUT_DIR, 'demo-04-project.png'), delay: 1_500 },
] as const

const encoder = gifenc.GIFEncoder()
let expectedWidth: number | undefined
let expectedHeight: number | undefined

for (const [index, frame] of FRAMES.entries()) {
  const png = PNG.sync.read(await readFile(frame.path))
  expectedWidth ??= png.width
  expectedHeight ??= png.height
  if (png.width !== expectedWidth || png.height !== expectedHeight) {
    throw new Error(`README demo frame ${frame.path} has inconsistent dimensions`)
  }
  const pixels = new Uint8Array(png.data)
  const palette = gifenc.quantize(pixels, 128)
  encoder.writeFrame(gifenc.applyPalette(pixels, palette), png.width, png.height, {
    palette,
    delay: frame.delay,
    repeat: index === 0 ? 0 : undefined,
  })
}

encoder.finish()
await writeFile(OUTPUT_PATH, encoder.bytes())
process.stdout.write(`${OUTPUT_PATH}\n`)
