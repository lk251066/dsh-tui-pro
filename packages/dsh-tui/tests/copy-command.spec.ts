import { describe, expect, it, vi } from 'vitest'
import { HeadlessTerminal } from './headless-terminal.ts'

const copyText = vi.hoisted(() => vi.fn(async () => 'system' as const))

vi.mock('../src/clipboard.ts', () => ({ copyText }))

import {
  appendAssistant,
  createTuiTestHarness,
  disposeTuiTestHarness,
} from './harness.ts'

describe('/copy', () => {
  it('copies the latest assistant text from the active session', async () => {
    const terminal = new HeadlessTerminal(100, 24)
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      omitInitialLifecycle: true,
      omitWelcome: true,
      beforeMount(session) {
        appendAssistant(session, [{ type: 'text', text: 'older reply' }])
        appendAssistant(session, [
          { type: 'text', text: 'latest ' },
          { type: 'text', text: 'reply' },
        ])
      },
    })
    try {
      terminal.send('/copy')
      terminal.send('\r')

      await vi.waitFor(() => {
        expect(copyText).toHaveBeenCalledWith('latest reply', expect.anything())
      })
      expect(harness.agent.sentMessages).toEqual([])
    } finally {
      await disposeTuiTestHarness(harness)
    }
  })
})
