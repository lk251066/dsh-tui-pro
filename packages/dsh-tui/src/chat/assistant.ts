/**
 * The personal-assistant session (R2-3): a fixed-id live session under the
 * shared chrome with its own persona and, when the memory plugin is mounted,
 * the assistant-scoped memory tools and recalled-memories prompt section. The
 * session persists like any other: the next process resumes the same
 * conversation, and `setup` re-installs the persona either way.
 * @module @deepseek-ai/dsh-tui/chat/assistant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { errorChain } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import { PERSONA_ORDER, PERSONA_SECTION } from '@deepseek-ai/dsh-system-prompt'
import type { TuiSessionSlot } from '../index.ts'
import type { ChannelRegistry } from './channel-registry.ts'
import { installAssistantTools } from './assistant-tools.ts'
import { optionalMemory } from './memories.ts'

/** The assistant's fixed session id — stable across processes by design. */
export const ASSISTANT_SESSION_ID = SessionId('assistant')

/**
 * The assistant's persona, shadowing the deployment persona for this one
 * session (the same-section replacement the system-prompt registry defines).
 * Plain text: the strict `{{variable}}` interpolation rejects unknown names.
 */
export const ASSISTANT_PERSONA = [
  '你是这个用户的个人助手,由 {{model}} 模型驱动。',
  '你可以监控和协助其他会话:用 list_sessions 查看所有活跃会话的状态,用 send_message_to_session 给指定会话发送消息。',
  '当用户要求"监控某会话"或"盯着XX会话"时,定期调用 list_sessions 检查状态,发现问题主动汇报或协助。',
  '回答简洁。技术或编程请求照常处理,可以使用常规工具;但不要默认进入大型编码流程,先弄清用户想要什么。',
].join('')

/** Assistant persona used only when a compatible memory service installs its tools. */
export const ASSISTANT_PERSONA_WITH_MEMORY = [
  '你是这个用户的个人助手,由 {{model}} 模型驱动。',
  '你有跨对话的持久记忆:回答任何关于用户偏好、背景或过往约定的问题之前,先用 memory_search 检索;',
  '当用户陈述值得长期记住的事实或偏好时,主动调用 memory_save 保存——一条记忆只写一件独立的事,已列出的不重复保存。',
  '你可以监控和协助其他会话:用 list_sessions 查看所有活跃会话的状态,用 send_message_to_session 给指定会话发送消息。',
  '当用户要求"监控某会话"或"盯着XX会话"时,定期调用 list_sessions 检查状态,发现问题主动汇报或协助。',
  '回答简洁。技术或编程请求照常处理,可以使用常规工具;但不要默认进入大型编码流程,先弄清用户想要什么。',
].join('')

/**
 * Install the assistant's scoped world on one (unpublished) agent context: the
 * persona shadow plus, when the memory service is mounted, its tools and the
 * auto-recalled memories section, plus the assistant-specific session control tools.
 * @param agentCtx - the agent scope `setup` receives.
 * @param registry - the multi-session registry for session control tools.
 */
export function setupAssistant(agentCtx: Context, registry: ChannelRegistry<TuiSessionSlot>): void {
  agentCtx.inject(['systemPrompt', 'tools'], (promptCtx: Context) => {
    const memory = optionalMemory(promptCtx)
    promptCtx.systemPrompt.section({
      name: PERSONA_SECTION,
      order: PERSONA_ORDER,
      text: memory === undefined ? ASSISTANT_PERSONA : ASSISTANT_PERSONA_WITH_MEMORY,
    })
    // Optional by design: without the memory plugin the assistant is still a
    // persona-shifted session, never a broken one.
    memory?.installTools(promptCtx)
    // Install assistant-specific session control tools
    installAssistantTools(promptCtx, registry)
  })
}

/** Collaborators the assistant controller needs from the host chrome. */
export interface AssistantControllerDeps {
  readonly ctx: Context
  /** The multi-session registry the assistant slot adopts into. */
  readonly registry: ChannelRegistry<TuiSessionSlot>
  /** Workspace recorded on a freshly created assistant session. */
  readonly cwd: string
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
export function createAssistantController(deps: AssistantControllerDeps): { open(): void } {
  const { ctx, registry } = deps
  let opening: Promise<void> | undefined

  /** Whether a persisted assistant artifact exists (header-only listing). */
  const persisted = async (): Promise<boolean> => {
    const persistence = ctx.get('sessionPersistence')
    if (persistence === undefined) return false
    try {
      const headers = await persistence.list()
      return headers.some(header => header.id === ASSISTANT_SESSION_ID)
    } catch {
      // An unreadable store falls back to the create path; a stale artifact
      // name-collision there reports as an error notice.
      return false
    }
  }

  const adopt = (agent: Agent, receipt: string): void => {
    registry.adopt(agent)
    deps.showTransientNotice(receipt)
  }

  const open = async (): Promise<void> => {
    const slot = registry.get(ASSISTANT_SESSION_ID)
    if (slot !== undefined) {
      registry.switchTo(ASSISTANT_SESSION_ID)
      return
    }
    const live = ctx.agents.get(ASSISTANT_SESSION_ID)
    if (live !== undefined) {
      adopt(live, 'Assistant session re-adopted.')
      return
    }
    if (await persisted()) {
      try {
        const handle = await ctx.agents.resume({
          resumeSessionId: ASSISTANT_SESSION_ID,
          setup: agentCtx => setupAssistant(agentCtx, registry),
        })
        if (deps.isDisposed()) return
        adopt(handle.agent, 'Assistant session resumed.')
        return
      } catch (error) {
        // A delete racing the preflight is the one recoverable case; every
        // other failure (corruption, double resume) reports.
        if (!String(errorChain(error)).includes('not found')) {
          if (!deps.isDisposed()) deps.appendNotice(`Assistant failed: ${errorChain(error)}`, 'error')
          return
        }
      }
    }
    try {
      const handle = await ctx.agents.create({
        sessionId: ASSISTANT_SESSION_ID,
        seed: [],
        meta: { cwd: deps.cwd },
        setup: agentCtx => setupAssistant(agentCtx, registry),
      })
      if (deps.isDisposed()) return
      adopt(handle.agent, 'Assistant session created.')
    } catch (error) {
      if (!deps.isDisposed()) deps.appendNotice(`Assistant failed: ${errorChain(error)}`, 'error')
    }
  }

  return {
    open(): void {
      opening ??= open().finally(() => { opening = undefined })
    },
  }
}
