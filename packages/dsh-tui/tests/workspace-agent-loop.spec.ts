import { describe, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import { apply, inject, TUI_WORKSPACE_STARTUP_KEY } from '../src/workspace-agent-loop.ts'

function config(cwd: string): never {
  return {
    agents: [{ id: 'main', cwd, provider: 'deepseek-official', model: 'deepseek-chat' }],
  } as never
}

function fixture(sessionIds: ReturnType<typeof SessionId>[]) {
  const cwd = process.cwd()
  const attachSession = vi.fn(async () => {})
  const detachSession = vi.fn(async (sessionId: ReturnType<typeof SessionId>) => {
    const index = sessionIds.indexOf(sessionId)
    if (index >= 0) sessionIds.splice(index, 1)
  })
  const workspace = {
    id: 'workspace-1',
    path: cwd,
    title: 'project',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    sessionIds,
    attachSession,
    detachSession,
  }
  const provide = vi.fn()
  const resume = vi.fn(async ({ resumeSessionId }) => ({
    agent: { session: { id: resumeSessionId, header: { cwd } } },
  }))
  const create = vi.fn(async ({ sessionId }) => ({
    agent: { session: { id: sessionId, header: { cwd } } },
  }))
  const ctx = {
    workspaceRegistry: {
      list: () => [workspace],
      resolveByPath: vi.fn(async () => workspace),
      create: vi.fn(async () => workspace),
    },
    get: vi.fn(() => undefined),
    plugin: vi.fn(async () => {}),
    agents: { resume, create },
    provide,
  }
  return { cwd, workspace, attachSession, detachSession, resume, create, provide, ctx }
}

describe('workspace agent loop', () => {
  it('declares every Cordis service it reads directly', () => {
    expect(inject).toEqual(['workspaceRegistry', 'agents'])
  })

  it('resumes the first manually ordered active session for the current directory', async () => {
    const active = SessionId('active-project-session')
    const setup = fixture([active])

    await apply(setup.ctx as never, config(setup.cwd))

    expect(setup.resume).toHaveBeenCalledWith(expect.objectContaining({ resumeSessionId: active }))
    expect(setup.create).not.toHaveBeenCalled()
    expect(setup.attachSession).not.toHaveBeenCalled()
    expect(setup.provide).toHaveBeenCalledWith(TUI_WORKSPACE_STARTUP_KEY, {
      sessionId: active,
      cwd: setup.cwd,
    })
  })

  it('creates and attaches a fresh session when the directory has no active membership', async () => {
    const setup = fixture([])

    await apply(setup.ctx as never, config(setup.cwd))

    expect(setup.resume).not.toHaveBeenCalled()
    expect(setup.create).toHaveBeenCalledOnce()
    const createdId = setup.create.mock.calls[0]![0].sessionId
    expect(String(createdId)).toMatch(/^session-/u)
    expect(setup.attachSession).toHaveBeenCalledWith(createdId)
    expect(setup.provide).toHaveBeenCalledWith(TUI_WORKSPACE_STARTUP_KEY, {
      sessionId: createdId,
      cwd: setup.cwd,
    })
  })

  it('removes an assistant id left by an older workspace index before selection', async () => {
    const setup = fixture([SessionId('assistant')])

    await apply(setup.ctx as never, config(setup.cwd))

    expect(setup.detachSession).toHaveBeenCalledWith(SessionId('assistant'))
    expect(setup.create).toHaveBeenCalledOnce()
  })
})
