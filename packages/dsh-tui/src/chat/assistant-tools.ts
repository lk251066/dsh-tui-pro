/**
 * Assistant-scoped tools for the user's durable workspace sessions.
 * @module @lk251066/dsh-tui/chat/assistant-tools
 */

import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import {
  isAppendSurfaceEvent,
  SessionId,
  type SessionEvent,
  type SessionId as SessionIdType,
} from '@deepseek-ai/dsh-session'
import { createUserMessage, type ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
import type { ChannelRegistry } from './channel-registry.ts'
import type { TuiSessionSlot } from '../index.ts'
import { ASSISTANT_SESSION_ID } from './assistant.ts'
import type { WorkspaceSessions } from './workspace-sessions.ts'

/** Central TUI ownership transfer for an agent created by a session workflow. */
export type AdoptOwnedAgent = (
  handle: AgentHandle,
  options?: { readonly activate?: boolean; readonly ensureWorkspace?: boolean },
) => Promise<void>

function formatAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function titleOf(agent: Agent, fallback: string): string {
  const title = [...agent.session.events].reverse().find(event => event.type === 'session/title')
  return title?.type === 'session/title' ? title.data.title : fallback
}

const DEFAULT_CONVERSATION_PAGE_SIZE = 20
const MAX_CONVERSATION_PAGE_SIZE = 100

interface ConversationMessage {
  readonly role: 'user' | 'assistant'
  readonly text: string
}

function conversationText(content: readonly ContentBlock[]): string {
  return content.flatMap((block) => {
    if (block.type === 'text') return [block.text]
    if (block.type === 'image') return ['[Image]']
    return []
  }).join('\n').trim()
}

/** Project the durable visible dialogue without model reasoning or tool traffic. */
function projectConversation(events: readonly SessionEvent[]): ConversationMessage[] {
  const messages: ConversationMessage[] = []
  for (const event of events) {
    if (!isAppendSurfaceEvent(event)) continue
    if (event.type === 'user/message' && event.data.source.kind === 'user') {
      const text = conversationText(event.data.content)
      if (text !== '') messages.push({ role: 'user', text })
    } else if (event.type === 'assistant/message') {
      const text = conversationText(event.data.message.content)
      if (text !== '') messages.push({ role: 'assistant', text })
    }
  }
  return messages
}

function positivePageValue(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved <= 0) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return resolved
}

function pageEnd(value: number | undefined, fallback: number): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new Error('before must be a non-negative integer.')
  }
  return resolved
}

/** Install the assistant's direct workspace-session operations. */
export function installAssistantTools(
  agentCtx: Context,
  registry: ChannelRegistry<TuiSessionSlot>,
  workspaceSessions: WorkspaceSessions,
  adoptOwnedAgent: AdoptOwnedAgent,
  assistantCwd: string,
): void {
  agentCtx.inject(['tools'], (toolCtx) => {
    const ensureLive = async (sessionId: SessionIdType, activate: boolean): Promise<Agent> => {
      if (!workspaceSessions.has(sessionId)) {
        throw new Error(`Session "${sessionId}" is not in the active workspace list.`)
      }
      const current = registry.get(sessionId)
      if (current !== undefined) {
        if (activate) registry.switchTo(sessionId)
        return current.agent
      }
      const existing = agentCtx.agents.get(sessionId)
      if (existing !== undefined) {
        registry.adopt(existing, activate)
        return existing
      }
      const handle = await agentCtx.agents.resume({ resumeSessionId: sessionId })
      await adoptOwnedAgent(handle, { activate })
      return handle.agent
    }

    toolCtx.tools.register(defineTool({
      name: 'list_sessions',
      description: 'List the user-maintained active workspace sessions, including stopped sessions.',
      parameters: {
        include_self: {
          type: 'boolean',
          description: 'Whether to include the personal assistant session. Defaults to false.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sessions: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string', required: true },
                  title: { type: 'string', required: true },
                  cwd: { type: 'string', required: true },
                  status: { type: 'string', enum: ['idle', 'running', 'stopped'], required: true },
                  active: { type: 'boolean', required: true },
                  lastActivityAt: { type: 'integer', required: true },
                  lastActivityAgo: { type: 'string', required: true },
                },
              },
            },
            total: { type: 'integer', required: true },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `Found ${value.total} active workspace session${value.total === 1 ? '' : 's'}:\n`
            + value.sessions.map(session => `- ${session.id}: ${session.title} (${session.status})`).join('\n'),
        }],
      },
      async execute(args) {
        const now = Date.now()
        const sessions = workspaceSessions.list().map(({ sessionId, workspace }) => {
          const slot = registry.get(sessionId)
          const agent = slot?.agent ?? agentCtx.agents.get(sessionId)
          const lastActivityAt = agent?.session.events.at(-1)?.time ?? Date.parse(workspace.updatedAt)
          return {
            id: String(sessionId),
            title: agent === undefined ? String(sessionId) : titleOf(agent, String(sessionId)),
            cwd: agent?.session.header.cwd ?? workspace.path,
            status: agent?.status ?? 'stopped' as const,
            active: true,
            lastActivityAt,
            lastActivityAgo: formatAge(Math.max(0, now - lastActivityAt)),
          }
        })
        if (args.include_self ?? false) {
          const self = agentCtx.agents.get(ASSISTANT_SESSION_ID)
          if (self !== undefined) {
            const lastActivityAt = self.session.events.at(-1)?.time ?? Date.now()
            sessions.unshift({
              id: String(ASSISTANT_SESSION_ID),
              title: titleOf(self, 'Assistant'),
              cwd: self.session.header.cwd ?? '(unknown)',
              status: self.status,
              active: true,
              lastActivityAt,
              lastActivityAgo: formatAge(Math.max(0, now - lastActivityAt)),
            })
          }
        }
        return { sessions, total: sessions.length }
      },
    }))

    toolCtx.tools.register(defineTool({
      name: 'create_workspace_session',
      description: 'Create a new active project session in the current directory or a supplied directory.',
      parameters: { path: { type: 'string', description: 'Existing project directory; defaults to the current directory.' } },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sessionId: { type: 'string', required: true },
            cwd: { type: 'string', required: true },
          },
        },
        render: (_args, value) => [{ type: 'text', text: `Created active session ${value.sessionId} in ${value.cwd}.` }],
      },
      async execute(args) {
        const cwd = resolve(assistantCwd, args.path?.trim() || '.')
        if (!(await stat(cwd)).isDirectory()) throw new Error(`Not a project directory: ${cwd}`)
        const sessionId = SessionId(`session-${randomUUID()}`)
        const handle = await agentCtx.agents.create({ sessionId, seed: [], meta: { cwd } })
        await adoptOwnedAgent(handle, { activate: false })
        return { sessionId: String(sessionId), cwd }
      },
    }))

    toolCtx.tools.register(defineTool({
      name: 'add_session_to_workspace',
      description: 'Add an existing historical project session to the active workspace list without changing its log.',
      parameters: { session_id: { type: 'string', required: true, description: 'Historical project session id.' } },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { added: { type: 'boolean', required: true }, sessionId: { type: 'string', required: true } } },
        render: (_args, value) => [{ type: 'text', text: `${value.added ? 'Added' : 'Already active'} session ${value.sessionId}.` }],
      },
      async execute(args) {
        const sessionId = SessionId(args.session_id)
        const already = workspaceSessions.has(sessionId)
        if (!already) await workspaceSessions.add(sessionId)
        return { added: !already, sessionId: String(sessionId) }
      },
    }))

    toolCtx.tools.register(defineTool({
      name: 'remove_session_from_workspace',
      description: 'Remove a project session from the active workspace list without deleting its history.',
      parameters: { session_id: { type: 'string', required: true, description: 'Active project session id.' } },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { removed: { type: 'boolean', required: true }, sessionId: { type: 'string', required: true } } },
        render: (_args, value) => [{ type: 'text', text: `${value.removed ? 'Removed' : 'Was not active'} session ${value.sessionId}. History was retained.` }],
      },
      async execute(args) {
        const sessionId = SessionId(args.session_id)
        return { removed: await workspaceSessions.remove(sessionId), sessionId: String(sessionId) }
      },
    }))

    toolCtx.tools.register(defineTool({
      name: 'switch_session',
      description: 'Open an active workspace session and make it the terminal session.',
      parameters: { session_id: { type: 'string', required: true, description: 'Active project session id.' } },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { switched: { type: 'boolean', required: true }, sessionId: { type: 'string', required: true } } },
        render: (_args, value) => [{ type: 'text', text: `Switched to session ${value.sessionId}.` }],
      },
      async execute(args) {
        const sessionId = SessionId(args.session_id)
        await ensureLive(sessionId, true)
        return { switched: true, sessionId: String(sessionId) }
      },
    }))

    toolCtx.tools.register(defineTool({
      name: 'send_message_to_session',
      description: 'Send a follow-up message to an active workspace session.',
      parameters: {
        session_id: { type: 'string', required: true, description: 'Active project session id.' },
        content: { type: 'string', required: true, description: 'Message content.' },
      },
      output: {
        schema: { type: 'object', additionalProperties: false, properties: { delivered: { type: 'boolean', required: true }, messageId: { type: 'string', required: true }, targetSession: { type: 'string', required: true } } },
        render: (args) => [{ type: 'text', text: `Message delivered to session ${args.session_id}.` }],
      },
      async execute(args, exec) {
        const targetId = SessionId(args.session_id)
        const target = await ensureLive(targetId, false)
        const message = createUserMessage({
          content: [{ type: 'text', text: args.content }],
          source: { kind: 'user', form: 'relay', senderSessionId: exec.agent?.id ?? ASSISTANT_SESSION_ID },
        })
        target.followup(message)
        return { delivered: true, messageId: message.id, targetSession: args.session_id }
      },
    }))

    toolCtx.tools.register(defineTool({
      name: 'read_session_conversation',
      description: 'Read user messages and completed assistant replies from an active project session. Reasoning, tools, diffs, system context, and unfinished streaming output are excluded. The newest page is returned by default; pass nextBefore from one result as before to read the preceding page.',
      parameters: {
        session_id: { type: 'string', required: true, description: 'Active project session id.' },
        before: { type: 'integer', description: 'Exclusive message index ending this page; omit for the newest page.' },
        limit: { type: 'integer', description: `Messages per page; defaults to ${DEFAULT_CONVERSATION_PAGE_SIZE} and cannot exceed ${MAX_CONVERSATION_PAGE_SIZE}.` },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sessionId: { type: 'string', required: true },
            messages: {
              type: 'array',
              required: true,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  role: { type: 'string', enum: ['user', 'assistant'], required: true },
                  text: { type: 'string', required: true },
                },
              },
            },
            total: { type: 'integer', required: true },
            start: { type: 'integer', required: true },
            end: { type: 'integer', required: true },
            hasEarlier: { type: 'boolean', required: true },
            nextBefore: { type: 'integer' },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `Read ${value.messages.length} of ${value.total} visible messages from session ${value.sessionId}.`,
        }],
      },
      async execute(args) {
        const sessionId = SessionId(args.session_id)
        if (!workspaceSessions.has(sessionId)) {
          throw new Error(`Session "${sessionId}" is not in the active workspace list.`)
        }
        const limit = positivePageValue(args.limit, DEFAULT_CONVERSATION_PAGE_SIZE, 'limit')
        if (limit > MAX_CONVERSATION_PAGE_SIZE) {
          throw new Error(`limit cannot exceed ${MAX_CONVERSATION_PAGE_SIZE}.`)
        }
        const query = toolCtx.get('sessionQuery', false) as {
          readSession(id: SessionIdType): Promise<SessionLogSnapshot>
        } | undefined
        if (query === undefined) throw new Error('Session history is not available.')
        const snapshot = await query.readSession(sessionId)
        if (!workspaceSessions.has(sessionId)) {
          throw new Error(`Session "${sessionId}" is no longer in the active workspace list.`)
        }
        const conversation = projectConversation(snapshot.events)
        const end = Math.min(
          pageEnd(args.before, conversation.length),
          conversation.length,
        )
        const start = Math.max(0, end - limit)
        return {
          sessionId: String(sessionId),
          messages: conversation.slice(start, end),
          total: conversation.length,
          start,
          end,
          hasEarlier: start > 0,
          ...start > 0 ? { nextBefore: start } : {},
        }
      },
    }))
  })
}
