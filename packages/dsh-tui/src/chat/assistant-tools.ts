/**
 * Assistant-scoped tools for the user's durable workspace sessions.
 * @module @lk251066/dsh-tui/chat/assistant-tools
 */

import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import { SessionId, type SessionId as SessionIdType } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
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

/** Install the assistant's direct workspace-session operations. */
export function installAssistantTools(
  agentCtx: Context,
  registry: ChannelRegistry<TuiSessionSlot>,
  workspaceSessions: WorkspaceSessions,
  adoptOwnedAgent: AdoptOwnedAgent,
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
        const cwd = resolve(process.cwd(), args.path?.trim() || '.')
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
  })
}
