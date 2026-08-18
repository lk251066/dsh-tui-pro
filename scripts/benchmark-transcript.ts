import { performance } from 'node:perf_hooks'
import { TranscriptContainer } from '../packages/dsh-tui/src/components/transcript-container.ts'
import {
  StreamingAssistantComponent,
  UserMessageComponent,
} from '../packages/dsh-tui/src/components/transcript.ts'
import { createPalette, markdownTheme } from '../packages/dsh-tui/src/components/theme.ts'

const WIDTH = 100
const REPEATS = 100
const palette = createPalette(false)
const mdTheme = markdownTheme(palette)

function populatedTranscript(turns: number): TranscriptContainer {
  const transcript = new TranscriptContainer()
  for (let turn = 1; turn <= turns; turn += 1) {
    transcript.addChild(new UserMessageComponent(`Question ${String(turn)} about the current implementation.`, palette))
    const answer = new StreamingAssistantComponent({ turn, step: 1 }, false, palette, mdTheme, 30)
    answer.settle([{ type: 'text', text: `Answer ${String(turn)} with **structured** details and one code reference.` }])
    transcript.addChild(answer)
  }
  return transcript
}

function measure(turns: number): { coldMs: number; hotMs: number } {
  const transcript = populatedTranscript(turns)
  const coldStart = performance.now()
  transcript.render(WIDTH)
  const coldMs = performance.now() - coldStart
  const hotStart = performance.now()
  for (let index = 0; index < REPEATS; index += 1) transcript.render(WIDTH)
  return { coldMs, hotMs: (performance.now() - hotStart) / REPEATS }
}

for (const turns of [100, 500, 1_000]) {
  const result = measure(turns)
  console.log(`${String(turns).padStart(4)} turns  cold ${result.coldMs.toFixed(3)} ms  hot ${result.hotMs.toFixed(4)} ms/render`)
}

const streaming = new StreamingAssistantComponent({ turn: 1, step: 1 }, false, palette, mdTheme, 30)
streaming.update({ type: 'block-start', index: 0, blockType: 'text' })
const burstStart = performance.now()
for (let index = 0; index < 2_000; index += 1) {
  streaming.update({ type: 'text-delta', index: 0, text: 'token ' })
}
streaming.render(WIDTH)
console.log(`2000 chunks  coalesced ${String((performance.now() - burstStart).toFixed(3))} ms`)
