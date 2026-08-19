/**
 * The personal-assistant session (R2-3): a fixed-id live session under the
 * shared chrome with session-management tools. The session persists like any
 * other, so the next process resumes the same conversation.
 * @module @deepseek-ai/dsh-tui/chat/assistant
 */

import type { Context } from '@deepseek-ai/cordis'
import { mkdir } from 'node:fs/promises'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import { errorChain } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { TuiSessionSlot } from '../index.ts'
import type { ChannelRegistry } from './channel-registry.ts'
import { installAssistantTools, type AdoptOwnedAgent } from './assistant-tools.ts'
import type { WorkspaceSessions } from './workspace-sessions.ts'

const installedAssistantScopes = new WeakMap<Context, WeakSet<object>>()

/** Tool-argument rule installed only in the fixed assistant's model context. */
export const ASSISTANT_TOOL_PERMISSION_GUIDANCE = [
  'For shell and filesystem tools, omit sandbox_permissions during a normal call.',
  'Use it only to retry the exact operation after a sandbox denial, request the narrowest wider mode,',
  'and include one sentence in justification explaining why that wider access is required.',
].join(' ')

/** The assistant's fixed session id — stable across processes by design. */
export const ASSISTANT_SESSION_ID = SessionId('assistant')

/**
 * Install the assistant's session-control tools on one agent context.
 * @param agentCtx - the agent scope `setup` receives.
 * @param registry - the multi-session registry for session control tools.
 */
export function setupAssistant(
  agentCtx: Context,
  registry: ChannelRegistry<TuiSessionSlot>,
  workspaceSessions: WorkspaceSessions,
  adoptOwnedAgent: AdoptOwnedAgent,
  assistantCwd: string,
): void {
  const registries = installedAssistantScopes.get(agentCtx) ?? new WeakSet<object>()
  if (registries.has(registry)) return
  registries.add(registry)
  installedAssistantScopes.set(agentCtx, registries)
  agentCtx.inject(['systemPrompt'], (promptCtx: Context) => {
    promptCtx.systemPrompt.section({
      name: 'ui:assistant-tool-permissions',
      order: 102,
      text: ASSISTANT_TOOL_PERMISSION_GUIDANCE,
    })
  })
  agentCtx.inject(['tools'], (promptCtx: Context) => {
    installAssistantTools(promptCtx, registry, workspaceSessions, adoptOwnedAgent, assistantCwd)
  })
}

/** Collaborators the assistant controller needs from the host chrome. */
export interface AssistantControllerDeps {
  readonly ctx: Context
  /** The multi-session registry the assistant slot adopts into. */
  readonly registry: ChannelRegistry<TuiSessionSlot>
  /** Durable project sessions the assistant tools may manage. */
  readonly workspaceSessions: WorkspaceSessions
  /** Consume handles created or resumed by assistant workflows. */
  readonly adoptOwnedAgent: AdoptOwnedAgent
  /** Permanent directory assigned to a newly created fixed assistant. */
  readonly assistantCwd: string
  /** Durable transcript notice. */
  appendNotice(message: string, kind?: 'info' | 'warning' | 'error'): void
  /** Transient operation receipt. */
  showTransientNotice(message: string): void
  /** Whether the TUI is gone (async continuation guard). */
  isDisposed(): boolean
}

/**
 * Open-or-switch the assistant session. Three fast-to-slow branches: a live
 * registry slot switches; a live-but-evicted agent re-adopts; otherwise the
 * persisted log resumes (this process or an earlier one) or the session is
 * created fresh — `setup` rides either path.
 * @param deps - channel collaborators and the registry.
 * @returns the controller wired to the `/assistant` command.
 */
export function createAssistantController(deps: AssistantControllerDeps): { open(): Promise<boolean> } {
  const { ctx, registry } = deps
  let opening: Promise<boolean> | undefined

  /** Persisted assistant cwd when its artifact exists (header-only listing). */
  const persisted = async (): Promise<{ cwd: string | undefined } | undefined> => {
    const persistence = ctx.get('sessionPersistence')
    if (persistence === undefined) return undefined
    try {
      const headers = await persistence.list()
      const header = headers.find(candidate => candidate.id === ASSISTANT_SESSION_ID)
      return header === undefined ? undefined : { cwd: header.cwd }
    } catch {
      // An unreadable store falls back to the create path; a stale artifact
      // name-collision there reports as an error notice.
      return undefined
    }
  }

  const adopt = (agent: Agent, receipt: string): void => {
    registry.adopt(agent)
    deps.showTransientNotice(receipt)
  }

  const adoptHandle = async (handle: AgentHandle, receipt: string): Promise<void> => {
    await deps.adoptOwnedAgent(handle, { ensureWorkspace: false })
    deps.showTransientNotice(receipt)
  }

  const open = async (): Promise<boolean> => {
    const slot = registry.get(ASSISTANT_SESSION_ID)
    if (slot !== undefined) {
      registry.switchTo(ASSISTANT_SESSION_ID)
      return true
    }
    const live = ctx.agents.get(ASSISTANT_SESSION_ID)
    if (live !== undefined) {
      adopt(live, 'Assistant session re-adopted.')
      return true
    }
    const stored = await persisted()
    if (stored !== undefined) {
      const assistantCwd = stored.cwd ?? deps.assistantCwd
      try {
        const handle = await ctx.agents.resume({
          resumeSessionId: ASSISTANT_SESSION_ID,
          setup: agentCtx => setupAssistant(agentCtx, registry, deps.workspaceSessions, deps.adoptOwnedAgent, assistantCwd),
        })
        await adoptHandle(handle, 'Assistant session resumed.')
        return true
      } catch (error) {
        // A delete racing the preflight is the one recoverable case; every
        // other failure (corruption, double resume) reports.
        if (!String(errorChain(error)).includes('not found')) {
          if (!deps.isDisposed()) deps.appendNotice(`Assistant failed: ${errorChain(error)}`, 'error')
          return false
        }
      }
    }
    try {
      await mkdir(deps.assistantCwd, { recursive: true })
      const handle = await ctx.agents.create({
        sessionId: ASSISTANT_SESSION_ID,
        seed: [],
        meta: { cwd: deps.assistantCwd },
        setup: agentCtx => setupAssistant(agentCtx, registry, deps.workspaceSessions, deps.adoptOwnedAgent, deps.assistantCwd),
      })
      await adoptHandle(handle, 'Assistant session created.')
      return true
    } catch (error) {
      if (!deps.isDisposed()) deps.appendNotice(`Assistant failed: ${errorChain(error)}`, 'error')
      return false
    }
  }

  return {
    open(): Promise<boolean> {
      opening ??= open().finally(() => { opening = undefined })
      return opening
    },
  }
}
