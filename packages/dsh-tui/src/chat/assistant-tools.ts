/**
 * Assistant-specific tools for session monitoring and coordination.
 * These tools are installed only in the assistant agent's scope.
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ChannelRegistry } from './channel-registry.ts'
import type { TuiSessionSlot } from '../index.ts'
import { ASSISTANT_SESSION_ID } from './assistant.ts'

function formatAge(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function installAssistantTools(
  agentCtx: Context,
  registry: ChannelRegistry<TuiSessionSlot>,
): void {
  agentCtx.inject(['tools', 'systemPrompt'], (toolCtx) => {
    toolCtx.systemPrompt.section({
      name: 'tool:assistant-control',
      order: 102,
      text: 'You can monitor and coordinate other sessions: use list_sessions to see all active sessions and their status, and send_message_to_session to relay information or requests to them.',
    })

    toolCtx.tools.register(defineTool({
      name: 'list_sessions',
      description: 'List all active sessions in this workspace with their current status, last activity, and metadata. Use this to monitor other sessions or check which sessions are available.',
      parameters: {
        include_self: {
          type: 'boolean',
          description: 'Whether to include the assistant session itself in the results. Defaults to false.',
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
                  status: { type: 'string', enum: ['idle', 'running'], required: true },
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
          text: `Found ${value.total} session${value.total === 1 ? '' : 's'}:\n` +
            value.sessions.map(s => `- ${s.id}: ${s.title} (${s.status}, ${s.lastActivityAgo})`).join('\n'),
        }],
      },
      async execute(args, _exec) {
        const includeSelf = args.include_self ?? false
        const slots = registry.slots()
        const now = Date.now()

        const sessions = slots
          .filter(slot => includeSelf || slot.sessionId !== ASSISTANT_SESSION_ID)
          .map((slot) => {
            const agent = slot.agent
            const events = agent.session.events
            const lastEvent = events[events.length - 1]
            const lastActivityAt = lastEvent?.time ?? Date.now()
            const ageMs = now - lastActivityAt

            // 从最后的 session/title 事件读取 title，或回退到 sessionId
            const titleEvent = [...events].reverse().find(e => e.type === 'session/title')
            const title = (titleEvent && 'data' in titleEvent && typeof titleEvent.data === 'object' && titleEvent.data && 'title' in titleEvent.data)
              ? String((titleEvent.data as { title: unknown }).title)
              : String(slot.sessionId)

            // cwd 直接从 session.header 读取
            const cwd = agent.session.header.cwd ?? '(unknown)'

            return {
              id: String(slot.sessionId),
              title,
              cwd,
              status: agent.status,
              lastActivityAt,
              lastActivityAgo: formatAge(ageMs),
            }
          })
          .sort((a, b) => b.lastActivityAt - a.lastActivityAt)

        return { sessions, total: sessions.length }
      },
    }))

    toolCtx.tools.register(defineTool({
      name: 'send_message_to_session',
      description: 'Send a message to another active session by its session id. The message becomes the next turn for that session: if it is currently working, the message waits until its current turn finishes. Use this to relay information, provide updates, or coordinate work across sessions.',
      parameters: {
        session_id: {
          type: 'string',
          required: true,
          description: 'The session id of the target session (from list_sessions).',
        },
        content: {
          type: 'string',
          required: true,
          description: 'The message content to send to the target session.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            delivered: { type: 'boolean', required: true },
            messageId: { type: 'string', required: true },
            targetSession: { type: 'string', required: true },
          },
        },
        render: (args, _value) => [{
          type: 'text',
          text: `Message delivered to session ${args.session_id}`,
        }],
      },
      async execute(args, exec) {
        const targetId = SessionId(args.session_id)
        const targetSlot = registry.get(targetId)

        if (targetSlot === undefined) {
          throw new Error(`Session "${args.session_id}" not found. Use list_sessions to see available sessions.`)
        }

        const message = createUserMessage({
          content: [{ type: 'text', text: args.content }],
          source: {
            kind: 'user',
            form: 'relay',
            senderSessionId: exec.agent?.id ?? ASSISTANT_SESSION_ID,
          },
        })

        targetSlot.agent.followup(message)

        return {
          delivered: true,
          messageId: message.id,
          targetSession: args.session_id,
        }
      },
    }))
  })
}
