import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRegistry from '@deepseek-ai/dsh-tools'
import { pasteClipboardImage } from '../src/chat/image-draft.ts'
import { createTuiTestHarness, disposeTuiTestHarness } from './harness.ts'
import { HeadlessTerminal } from './headless-terminal.ts'

vi.mock('../src/chat/image-draft.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/chat/image-draft.ts')>()
  return { ...actual, pasteClipboardImage: vi.fn(actual.pasteClipboardImage) }
})

const IMAGE_REF = {
  attachmentId: 'image-fixture',
  mediaType: 'image/png',
  bytes: 12,
  width: 2,
  height: 3,
  name: 'clipboard.png',
} as const

async function configureBase(ctx: Context): Promise<void> {
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRegistry)
}

afterEach(() => {
  vi.mocked(pasteClipboardImage).mockReset()
})

describe('TUI media and memory integration', () => {
  it('pastes an image with Alt+V and submits it to a vision-capable model', async () => {
    vi.mocked(pasteClipboardImage).mockImplementationOnce(async (draft) =>
      draft.addStored(IMAGE_REF as never))
    const terminal = new HeadlessTerminal(140, 32)
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      agentOptions: { provider: 'vision', model: 'seeing' },
      catalog: {
        providers: [{ id: 'vision', name: 'Vision' }],
        models: [{ provider: 'vision', id: 'seeing', name: 'Seeing', inputModalities: ['text', 'image'] }],
        resolveModelInfo: () => Promise.resolve({ inputModalities: ['text', 'image'] }),
      },
      configureContext: async (ctx) => {
        await configureBase(ctx)
        ctx.provide('attachments', {} as never)
      },
    })
    try {
      await terminal.waitForFrame(0)
      terminal.send('\x1bv')
      await vi.waitFor(async () => {
        expect(await terminal.snapshot()).toContain('[Image #1]')
      })
      terminal.send('\r')
      await vi.waitFor(() => {
        expect(harness.agent.sentMessages).toHaveLength(1)
      })
      expect(harness.agent.sentMessages[0]?.content).toEqual([
        { type: 'text', text: '[Image #1]' },
        { type: 'image', attachment: IMAGE_REF },
      ])
    } finally {
      await disposeTuiTestHarness(harness)
      await terminal.dispose()
    }
  })

  it('keeps an image draft when the selected model is text-only', async () => {
    vi.mocked(pasteClipboardImage).mockImplementationOnce(async (draft) =>
      draft.addStored(IMAGE_REF as never))
    const terminal = new HeadlessTerminal(140, 32)
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      catalog: {
        providers: [{ id: 'deepseek-official', name: 'DeepSeek' }],
        models: [{
          provider: 'deepseek-official',
          id: 'deepseek-v4-flash',
          name: 'DeepSeek V4 Flash',
          inputModalities: ['text'],
        }],
        resolveModelInfo: () => Promise.resolve({ inputModalities: ['text'] }),
      },
      configureContext: async (ctx) => {
        await configureBase(ctx)
        ctx.provide('attachments', {} as never)
      },
    })
    try {
      await terminal.waitForFrame(0)
      terminal.send('\x1bv')
      await vi.waitFor(async () => {
        expect(await terminal.snapshot()).toContain('[Image #1]')
      })
      terminal.send('\r')
      await vi.waitFor(async () => {
        expect(await terminal.snapshot()).toContain('does not support image input')
      })
      expect(harness.agent.sentMessages).toHaveLength(0)
      expect(await terminal.snapshot()).toContain('[Image #1]')
    } finally {
      await disposeTuiTestHarness(harness)
      await terminal.dispose()
    }
  })

  it('installs and removes memory tools through the session command', async () => {
    let enabled = false
    const disposeMemoryScope = vi.fn()
    const installTools = vi.fn(() => disposeMemoryScope)
    const setEnabled = vi.fn(async (_sessionId: SessionId, value: boolean) => {
      enabled = value
    })
    const terminal = new HeadlessTerminal(140, 32)
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      configureContext: async (ctx) => {
        await configureBase(ctx)
        ctx.provide('memory', {
          isEnabled: () => enabled,
          setEnabled,
          installTools,
        } as never)
      },
    })
    try {
      await terminal.waitForFrame(0)
      terminal.send('/memory on')
      terminal.send('\r')
      await vi.waitFor(() => {
        expect(installTools).toHaveBeenCalledOnce()
      })
      expect(setEnabled).toHaveBeenCalledWith(SessionId('main-session'), true)

      terminal.send('/memory off')
      terminal.send('\r')
      await vi.waitFor(() => {
        expect(disposeMemoryScope).toHaveBeenCalledOnce()
      })
      expect(setEnabled).toHaveBeenLastCalledWith(SessionId('main-session'), false)
    } finally {
      await disposeTuiTestHarness(harness)
      await terminal.dispose()
    }
  })

  it('keeps the memory switch visible in the status row', async () => {
    let enabled = false
    const terminal = new HeadlessTerminal(140, 32)
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      configureContext: async (ctx) => {
        await configureBase(ctx)
        ctx.provide('memory', {
          isEnabled: () => enabled,
          setEnabled: async (_sessionId: SessionId, value: boolean) => {
            enabled = value
          },
          installTools: () => () => {},
        } as never)
      },
    })
    try {
      await terminal.waitForFrame(0)
      expect(await terminal.snapshot()).not.toContain('mem on')

      terminal.send('/memory on')
      terminal.send('\r')
      await vi.waitFor(async () => {
        expect(await terminal.snapshot()).toContain('mem on')
      })

      terminal.send('/memory off')
      terminal.send('\r')
      await vi.waitFor(async () => {
        expect(await terminal.snapshot()).not.toContain('mem on')
      })
    } finally {
      await disposeTuiTestHarness(harness)
      await terminal.dispose()
    }
  })

  it('does not turn compaction lifecycle events into durable memories', async () => {
    const add = vi.fn()
    const terminal = new HeadlessTerminal(140, 32)
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      configureContext: async (ctx) => {
        await configureBase(ctx)
        ctx.provide('memory', {
          add,
          isEnabled: () => true,
          installTools: () => () => {},
        } as never)
      },
    })
    try {
      await terminal.waitForFrame(0)
      harness.session.append('compaction/start', { turn: null })
      harness.session.append('compaction/end', { turn: null })
      await terminal.waitForFrame(1)

      expect(add).not.toHaveBeenCalled()
    } finally {
      await disposeTuiTestHarness(harness)
      await terminal.dispose()
    }
  })

  it('deletes a whole image placeholder with one Backspace and submits without the image', async () => {
    vi.mocked(pasteClipboardImage).mockImplementationOnce(async (draft) =>
      draft.addStored(IMAGE_REF as never))
    const terminal = new HeadlessTerminal(140, 32)
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      agentOptions: { provider: 'vision', model: 'seeing' },
      catalog: {
        providers: [{ id: 'vision', name: 'Vision' }],
        models: [{ provider: 'vision', id: 'seeing', name: 'Seeing', inputModalities: ['text', 'image'] }],
        resolveModelInfo: () => Promise.resolve({ inputModalities: ['text', 'image'] }),
      },
      configureContext: async (ctx) => {
        await configureBase(ctx)
        ctx.provide('attachments', {} as never)
      },
    })
    try {
      await terminal.waitForFrame(0)
      terminal.send('\x1bv')
      await vi.waitFor(async () => {
        expect(await terminal.snapshot()).toContain('[Image #1]')
      })
      terminal.send('\x7f')
      terminal.send('hi')
      terminal.send('\r')
      await vi.waitFor(() => {
        expect(harness.agent.sentMessages).toHaveLength(1)
      })
      expect(harness.agent.sentMessages[0]?.content).toEqual([
        { type: 'text', text: 'hi' },
      ])
    } finally {
      await disposeTuiTestHarness(harness)
      await terminal.dispose()
    }
  })

  it('omits draft images whose placeholder was edited out of the text', async () => {
    vi.mocked(pasteClipboardImage).mockImplementationOnce(async (draft) =>
      draft.addStored(IMAGE_REF as never))
    const terminal = new HeadlessTerminal(140, 32)
    const harness = await createTuiTestHarness(terminal, vi.fn(), {
      agentOptions: { provider: 'vision', model: 'seeing' },
      catalog: {
        providers: [{ id: 'vision', name: 'Vision' }],
        models: [{ provider: 'vision', id: 'seeing', name: 'Seeing', inputModalities: ['text', 'image'] }],
        resolveModelInfo: () => Promise.resolve({ inputModalities: ['text', 'image'] }),
      },
      configureContext: async (ctx) => {
        await configureBase(ctx)
        ctx.provide('attachments', {} as never)
      },
    })
    try {
      await terminal.waitForFrame(0)
      terminal.send('\x1bv')
      await vi.waitFor(async () => {
        expect(await terminal.snapshot()).toContain('[Image #1]')
      })
      // Break the placeholder one character at a time: left of the trailing
      // ']', Backspace deletes '1', leaving '[Image #]'.
      terminal.send('\x1b[D')
      terminal.send('\x7f')
      terminal.send('\r')
      await vi.waitFor(() => {
        expect(harness.agent.sentMessages).toHaveLength(1)
      })
      expect(harness.agent.sentMessages[0]?.content).toEqual([
        { type: 'text', text: '[Image #]' },
      ])
    } finally {
      await disposeTuiTestHarness(harness)
      await terminal.dispose()
    }
  })
})
