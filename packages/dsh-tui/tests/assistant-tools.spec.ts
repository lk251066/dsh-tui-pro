import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import { CallId, createMessage, createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRegistry from '@deepseek-ai/dsh-tools'
import { installAssistantTools } from '../src/chat/assistant-tools.ts'
import type { ChannelRegistry } from '../src/chat/channel-registry.ts'
import type { WorkspaceSessions } from '../src/chat/workspace-sessions.ts'
import type { TuiSessionSlot } from '../src/index.ts'

function agent(ctx: Context, id: ReturnType<typeof SessionId>, cwd: string): Agent {
  const session = ctx.sessions.create(id, { meta: { cwd } })
  return {
    id,
    options: {},
    session,
    status: 'idle',
    ctx,
    followup: vi.fn((_message: UserMessage) => undefined),
    steer: vi.fn(() => ({ outcome: Promise.resolve({ status: 'rejected' as const }) })),
    inject: vi.fn(),
    send: vi.fn(),
    updateInbox: vi.fn(() => 'not-found'),
    reserveTurnAdmission: vi.fn(() => undefined),
    cancel: vi.fn(),
    whenIdle: vi.fn(() => Promise.resolve()),
  } as unknown as Agent
}

describe('assistant tools', () => {
  it('executes list, create, add, remove, switch, and send operations', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRegistry)
    const cwd = process.cwd()
    const targetId = SessionId('active-target')
    const target = agent(ctx, targetId, cwd)
    ctx.agents.register(target)
    target.session.append('user/message', createUserMessage({
      source: { kind: 'user' },
      content: [{ type: 'text', text: 'first question' }],
    }), { surfaceOp: 'append' })
    target.session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        source: { kind: 'model', provider: 'test', model: 'test' },
        content: [
          { type: 'reasoning', text: 'private reasoning' },
          { type: 'text', text: 'first answer' },
          { type: 'tool-call', id: CallId('hidden-call'), name: 'hidden_tool', arguments: '{}' },
        ],
      }),
    }, { surfaceOp: 'append' })
    target.session.append('user/message', createUserMessage({
      source: { kind: 'plugin', plugin: 'hidden-context' },
      content: [{ type: 'text', text: 'hidden context' }],
    }), { surfaceOp: 'append' })
    target.session.append('assistant/chunk', {
      turn: 2,
      step: 1,
      chunk: { type: 'text-delta', index: 0, text: 'unfinished output' },
    })
    target.session.append('user/message', createUserMessage({
      source: { kind: 'user' },
      content: [{ type: 'image', attachment: { attachmentId: 'image-1' as never, mediaType: 'image/png', bytes: 1 } }],
    }), { surfaceOp: 'append' })
    target.session.append('assistant/message', {
      turn: 2,
      step: 1,
      message: createMessage({
        role: 'assistant',
        source: { kind: 'model', provider: 'test', model: 'test' },
        content: [{ type: 'text', text: 'second answer' }],
      }),
    }, { surfaceOp: 'append' })
    const active = new Set([targetId])
    const readSession = vi.fn(async (sessionId: ReturnType<typeof SessionId>) => {
      if (sessionId !== targetId) throw new Error('session not found')
      return { session: structuredClone(target.session.header), events: structuredClone([...target.session.events]) }
    })
    ctx.provide('sessionQuery', { readSession } as never)
    const workspace = {
      id: 'workspace-1', path: cwd, title: 'project',
      createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
      sessionIds: [targetId],
    }
    const workspaceSessions: WorkspaceSessions = {
      list: () => [...active].map(sessionId => ({ sessionId, workspace: workspace as never })),
      has: sessionId => active.has(sessionId),
      add: vi.fn(async sessionId => { active.add(sessionId) }),
      remove: vi.fn(async sessionId => active.delete(sessionId)),
    }
    const slot = { sessionId: targetId, agent: target }
    const registry = {
      get: vi.fn(sessionId => sessionId === targetId ? slot : undefined),
      adopt: vi.fn(),
      switchTo: vi.fn(),
    } as unknown as ChannelRegistry<TuiSessionSlot>
    ctx.agents.setFactory({
      async createAgent(_owner, options) {
        const created = agent(ctx, options.sessionId, options.meta?.cwd ?? cwd)
        ctx.agents.register(created)
        return { agent: created, dispose: async () => {} }
      },
      async resume() {
        throw new Error('resume is not used by this test')
      },
    })

    installAssistantTools(ctx, registry, workspaceSessions, async (handle, options) => {
      if (!workspaceSessions.has(handle.agent.session.id)) {
        await workspaceSessions.add(handle.agent.session.id)
      }
      registry.adopt(handle.agent, options?.activate)
    })
    await vi.waitFor(() => {
      expect(ctx.tools.schemas().map(schema => schema.name).sort()).toEqual([
        'add_session_to_workspace',
        'create_workspace_session',
        'list_sessions',
        'read_session_conversation',
        'remove_session_from_workspace',
        'send_message_to_session',
        'switch_session',
      ])
    })
    let call = 0
    const execute = (name: string, args: unknown) => ctx.tools.execute({
      callId: CallId(`assistant-tool-${++call}`),
      name,
      arguments: args,
      signal: new AbortController().signal,
    })

    const listed = await execute('list_sessions', {})
    expect(listed.isError).toBe(false)
    expect(listed.value).toMatchObject({ total: 1, sessions: [expect.objectContaining({ id: targetId })] })

    const newestConversation = await execute('read_session_conversation', { session_id: targetId, limit: 2 })
    expect(newestConversation.isError).toBe(false)
    expect(newestConversation.value).toEqual({
      sessionId: targetId,
      messages: [
        { role: 'user', text: '[Image]' },
        { role: 'assistant', text: 'second answer' },
      ],
      total: 4,
      start: 2,
      end: 4,
      hasEarlier: true,
      nextBefore: 2,
    })
    const earlierConversation = await execute('read_session_conversation', {
      session_id: targetId,
      before: 2,
      limit: 2,
    })
    expect(earlierConversation.value).toEqual({
      sessionId: targetId,
      messages: [
        { role: 'user', text: 'first question' },
        { role: 'assistant', text: 'first answer' },
      ],
      total: 4,
      start: 0,
      end: 2,
      hasEarlier: false,
    })

    readSession.mockImplementationOnce(async (sessionId) => {
      if (sessionId !== targetId) throw new Error('session not found')
      active.delete(targetId)
      return { session: structuredClone(target.session.header), events: structuredClone([...target.session.events]) }
    })
    expect((await execute('read_session_conversation', { session_id: targetId })).isError).toBe(true)
    active.add(targetId)

    const historicalId = SessionId('historical-session')
    expect((await execute('add_session_to_workspace', { session_id: historicalId })).value)
      .toEqual({ added: true, sessionId: historicalId })
    expect(active.has(historicalId)).toBe(true)

    expect((await execute('remove_session_from_workspace', { session_id: historicalId })).value)
      .toEqual({ removed: true, sessionId: historicalId })
    expect(active.has(historicalId)).toBe(false)
    expect((await execute('read_session_conversation', { session_id: historicalId })).isError).toBe(true)

    expect((await execute('switch_session', { session_id: targetId })).isError).toBe(false)
    expect(registry.switchTo).toHaveBeenCalledWith(targetId)

    expect((await execute('send_message_to_session', { session_id: targetId, content: 'continue' })).isError)
      .toBe(false)
    expect(target.followup).toHaveBeenCalledWith(expect.objectContaining({ content: [{ type: 'text', text: 'continue' }] }))

    const created = await execute('create_workspace_session', { path: cwd })
    expect(created.isError).toBe(false)
    expect(created.value).toMatchObject({ cwd })
    expect(workspaceSessions.add).toHaveBeenCalledWith(SessionId(String((created.value as { sessionId: string }).sessionId)))
    expect(registry.adopt).toHaveBeenCalledWith(expect.anything(), false)

    await ctx.fiber.dispose()
  })
})
