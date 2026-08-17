/**
 * Current-session rewind with replacement semantics: choose a completed user
 * turn, branch immediately before it, swap the branch in for the current
 * session in the active set, and restore its prompt for editing. The source
 * log stays on disk (append-only), so `/sessions` can recover it.
 * @module @lk251066/dsh-tui/chat/rewind
 */

import { randomUUID } from 'node:crypto'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import { errorChain } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import { contentText } from '../components/content.ts'
import { RewindDialog, type RewindPoint } from '../components/rewind-dialog.ts'
import type { ChannelNotice, ChatChannelDeps } from './channel.ts'

/** Fixed personal-assistant identity; rewinding it would discard its scoped capabilities. */
const ASSISTANT_SESSION_ID = SessionId('assistant')

/** Collaborators required by the current-session rewind controller. */
export interface RewindControllerDeps extends ChatChannelDeps, ChannelNotice {
  readonly agent: Agent
  /**
   * Consume and open the branch, then restore the selected prompt into its editor.
   * The branch REPLACES the source session in the active set: the host removes
   * `source` from the workspace list and the live-slot registry and disposes
   * its agent when it owns the handle; the source log stays on disk for
   * `/sessions`. `handle` owns the branch agent for later replacement or
   * rollback.
   */
  activate(handle: AgentHandle, prompt: string, source: SessionId): Promise<void>
}

/** Current-session rewind operations used by the double-Escape input route. */
export interface RewindController {
  /** Open the completed-turn picker, or explain why no rewind point exists. */
  show(): void
}

/**
 * Derive rewind points newest-first from completed top-level user turns.
 * @param events - Current session log.
 * @returns One point per completed direct user turn.
 */
export function rewindPoints(events: readonly SessionEvent[]): RewindPoint[] {
  const points: RewindPoint[] = []
  let start = -1
  let turn: number | undefined
  let prompt: string | undefined
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (event?.type === 'turn/start') {
      start = index
      turn = event.data.turn
      prompt = undefined
      continue
    }
    if (
      event?.type === 'user/message'
      && event.data.source.kind === 'user'
      && start >= 0
      && prompt === undefined
    ) {
      prompt = contentText(event.data.content).trim()
      continue
    }
    if (event?.type === 'turn/end' && start >= 0 && turn === event.data.turn) {
      if (prompt !== undefined) points.push({ turn, cut: start, prompt })
      start = -1
      turn = undefined
      prompt = undefined
    }
  }
  return points.reverse()
}

/** Build the double-Escape rewind controller for the mounted chat channel. */
export function createRewindController(deps: RewindControllerDeps): RewindController {
  return {
    show(): void {
      if (deps.agent.status !== 'idle') return
      if (deps.agent.session.id === ASSISTANT_SESSION_ID) {
        deps.appendNotice('The assistant conversation cannot be rewound. Use /fork to create a project branch.', 'warning')
        return
      }
      const points = rewindPoints(deps.agent.session.events)
      if (points.length === 0) {
        deps.appendNotice('No completed user turn is available to rewind.', 'warning')
        return
      }
      const session = deps.overlayManager.open({
        create: () => new RewindDialog(
          points,
          deps.resolved.maxResumeOptions,
          deps.palette,
          (point) => {
            void session.close()
            const branch = async (): Promise<void> => {
              const source = deps.agent.session
              const sessionId = SessionId(`session-${randomUUID()}`)
              const handle = await deps.ctx.agents.create({
                sessionId,
                seed: source.events.slice(0, point.cut),
                meta: {
                  cwd: source.header.cwd ?? process.cwd(),
                  parentSession: source.id,
                  seedLength: point.cut,
                },
              })
              await deps.activate(handle, point.prompt, source.id)
            }
            void branch().catch((error: unknown) => {
              if (!deps.isDisposed()) deps.appendNotice(`Rewind failed: ${errorChain(error)}`, 'error')
            })
          },
          () => { void session.close() },
        ),
        options: {
          width: deps.resolved.questionDialogWidth,
          maxHeight: '100%',
        },
      }, 'main')
      deps.requestRender()
    },
  }
}
