import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { installAssistantTools } from '../src/chat/assistant-tools.ts'
import type { ChannelRegistry } from '../src/chat/channel-registry.ts'
import type { TuiSessionSlot } from '../src/index.ts'

describe('assistant-tools', () => {
  it('installs tools without throwing', () => {
    const ctx = new Context()

    const mockRegistry = {
      slots: vi.fn(() => []),
      get: vi.fn(() => undefined),
    } as unknown as ChannelRegistry<TuiSessionSlot>

    // Should not throw - inject waits for services
    expect(() => {
      installAssistantTools(ctx, mockRegistry)
    }).not.toThrow()
  })

  it('requires tools and systemPrompt services via inject', () => {
    const ctx = new Context()

    const mockRegistry = {
      slots: vi.fn(() => []),
    } as unknown as ChannelRegistry<TuiSessionSlot>

    installAssistantTools(ctx, mockRegistry)

    // Tools won't be registered until services are available
    // This just verifies the function returns without error
    expect(mockRegistry.slots).not.toHaveBeenCalled()
  })
})
