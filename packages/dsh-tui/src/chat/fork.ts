/**
 * Session fork: branch the conversation at a completed-turn boundary into a
 * fresh session (the terminal counterpart of the web per-message Branch
 * action). The boundary algorithm mirrors the web host's fork: the last
 * `turn/end` at-or-before the anchor, extended through trailing out-of-band
 * events until the next `turn/start`.
 * @module @deepseek-ai/dsh-tui/chat/fork
 */

import { randomUUID } from 'node:crypto'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { errorChain } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import type { ChannelNotice, ChatChannelDeps } from './channel.ts'

/**
 * The seed boundary for a fork: the event index ONE PAST the last `turn/end`
 * at or before `atSeq` (or the last `turn/end` overall), extended through any
 * trailing out-of-band events (approval audit pairs, titles) until the next
 * `turn/start`.
 * @param events - The session log in order.
 * @param atSeq - Optional event-seq anchor (fork at this message's turn);
 * the log's last completed turn when omitted.
 * @returns The exclusive cut index, or `undefined` when no completed turn exists.
 */
export function forkCut(events: readonly SessionEvent[], atSeq?: number): number | undefined {
  let last = -1
  for (let index = 0; index < events.length; index += 1) {
    if (events[index]?.type === 'turn/end' && (atSeq === undefined || index <= atSeq)) last = index
  }
  if (last < 0) return undefined
  let cut = last + 1
  // Trailing out-of-band events after the boundary (approval audit pairs,
  // titles) stay in the seed — everything up to the next `turn/start`.
  while (cut < events.length && events[cut]?.type !== 'turn/start') cut += 1
  return cut
}

/** Collaborators the fork command needs from the chat channel. */
export interface ForkDeps extends ChatChannelDeps, ChannelNotice {
  /** The agent whose session forks. */
  agent: Agent
  /** Hand off into the forked session when a resume host is mounted. */
  handoffResume?: (sessionId: SessionId, cwd: string) => void
}

/**
 * Fork the agent's session at its last completed turn (or fail with a notice),
 * then hand off into the child when the runtime supports it.
 * @param deps - channel collaborators and the resume-handoff boundary.
 */
export async function forkSession(deps: ForkDeps): Promise<void> {
  const { agent } = deps
  if (agent.status !== 'idle') {
    deps.appendNotice('/fork requires an idle agent (status: ' + agent.status + ').', 'warning')
    return
  }
  const events = agent.session.events
  const cut = forkCut(events)
  if (cut === undefined) {
    deps.appendNotice('No completed turn to fork from yet.', 'warning')
    return
  }
  const cwd = agent.session.header.cwd ?? process.cwd()
  const sessionId = SessionId(`session-${randomUUID()}`)
  try {
    await deps.ctx.agents.create({
      sessionId,
      seed: events.slice(0, cut),
      meta: { cwd, parentSession: agent.session.id, seedLength: cut },
    })
  } catch (error) {
    deps.appendNotice(`Fork failed: ${errorChain(error)}`, 'error')
    return
  }
  if (deps.isDisposed()) return
  deps.appendNotice(`Forked into ${displayTextId(sessionId)} at ${cut} events.`)
  // Hand off like /sessions when a host is mounted; otherwise the fork waits in history.
  if (deps.handoffResume !== undefined) deps.handoffResume(sessionId, cwd)
  else deps.appendNotice('Open it later from /sessions.')
}

/** Short, terminal-safe id echo for notices. */
function displayTextId(id: SessionId): string {
  const text = String(id)
  return text.length > 24 ? `${text.slice(0, 12)}…${text.slice(-6)}` : text
}
