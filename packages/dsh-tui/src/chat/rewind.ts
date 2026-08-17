/**
 * Non-destructive current-session rewind: choose a completed user turn,
 * branch immediately before it, and restore its prompt for editing.
 * @module @lk251066/dsh-tui/chat/rewind
 */

import { randomUUID } from 'node:crypto'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { errorChain } from '@deepseek-ai/dsh-llm'
import { SessionId, type SessionEvent } from '@deepseek-ai/dsh-session'
import { contentText } from '../components/content.ts'
import { RewindDialog, type RewindPoint } from '../components/rewind-dialog.ts'
import type { ChannelNotice, ChatChannelDeps } from './channel.ts'

/** Collaborators required by the current-session rewind controller. */
export interface RewindControllerDeps extends ChatChannelDeps, ChannelNotice {
  readonly agent: Agent
  /** Add and open the branch, then restore the selected prompt into its editor. */
  activate(agent: Agent, prompt: string): Promise<void>
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
              if (!deps.isDisposed()) await deps.activate(handle.agent, point.prompt)
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
