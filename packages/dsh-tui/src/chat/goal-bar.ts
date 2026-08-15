/**
 * Goal-dock controller: derives the bar state from the session log via
 * `foldGoal`, refreshes on goal events, and runs Ctrl+G actions through the
 * optional `ctx.goals` service.
 * @module @deepseek-ai/dsh-tui/chat/goal-bar
 */

import type { Agent } from '@deepseek-ai/dsh-agent'
import { foldGoal } from '@deepseek-ai/dsh-goal'
import type { TuiOverlaySession } from '../extension/types.ts'
import { GoalActionsDialog, GoalBarComponent, type GoalAction, type GoalBarState } from '../components/goal-bar.ts'
import type { ChannelNotice, ChatChannelDeps } from './channel.ts'

/** Collaborators the goal dock needs from the chat channel. */
export interface GoalBarDeps extends ChatChannelDeps, ChannelNotice {
  /** The agent whose armed goal the bar shows. */
  agent: Agent
}

/** Goal-dock controller for one chat channel. */
export interface GoalBarController {
  /** The mounted bar component (already parented by the caller). */
  readonly component: GoalBarComponent
  /** Re-derive from the session log (call on every session event). */
  refresh(): void
  /** Open the Ctrl+G action sheet over the armed goal. */
  showActions(): void
  /** Tear down listeners. */
  dispose(): void
}

/** The goals service surface the TUI reads (optional at runtime). */
interface GoalsService {
  pause(agent: Agent, ref: unknown): unknown
  resume(agent: Agent, ref: unknown): unknown
  complete(agent: Agent, ref: unknown): unknown
  clear(agent: Agent, ref: unknown): unknown
}

/**
 * Build the goal dock for one chat channel.
 * @param deps - channel collaborators and the owned agent.
 * @returns the controller; `component` renders nothing until a goal is armed.
 */
export function createGoalBar(deps: GoalBarDeps): GoalBarController {
  const { ctx, agent } = deps
  const component = new GoalBarComponent(deps.palette)
  let overlay: TuiOverlaySession | undefined

  const state = (): GoalBarState | undefined => {
    const folded = foldGoal(agent.session.events)
    const goal = folded.goal
    if (goal === undefined || goal === null) return undefined
    return {
      objective: goal.objective,
      phase: goal.phase,
      ...goal.maxGoalRounds !== undefined ? { maxGoalRounds: goal.maxGoalRounds } : {},
      ...folded.roundsStarted !== undefined ? { roundsStarted: folded.roundsStarted } : {},
    }
  }

  const controller: GoalBarController = {
    component,
    refresh(): void {
      component.update(state())
      deps.requestRender()
    },
    showActions(): void {
      const current = state()
      if (current === undefined) {
        deps.appendNotice('No goal is armed. Set one with /goal <objective>.', 'warning')
        return
      }
      const goals = ctx.get('goals') as GoalsService | undefined
      if (goals === undefined) {
        deps.appendNotice('The goal service is not available in this session.', 'warning')
        return
      }
      void overlay?.close()
      const folded = foldGoal(agent.session.events)
      const ref = folded.lastRef ?? folded.goal
      const toggle: GoalAction = current.phase === 'paused'
        ? { id: 'resume', label: 'Resume automatic rounds' }
        : { id: 'pause', label: 'Pause automatic rounds' }
      const actions: GoalAction[] = [
        toggle,
        { id: 'complete', label: 'Mark complete' },
        { id: 'clear', label: 'Clear the goal' },
      ]
      const session = deps.overlayManager.open({
        create: () => new GoalActionsDialog(
          current.objective,
          actions,
          deps.palette,
          (action) => {
            try {
              if (action.id === 'pause') goals.pause(agent, ref)
              else if (action.id === 'resume') goals.resume(agent, ref)
              else if (action.id === 'complete') goals.complete(agent, ref)
              else goals.clear(agent, ref)
            } catch (error) {
              deps.appendNotice(`Goal action failed: ${String(error)}`, 'error')
            }
          },
          () => { void session.close() },
        ),
        options: { width: 56, anchor: 'center', margin: 1 },
      })
      overlay = session
      void session.closed.then(() => {
        if (overlay === session) overlay = undefined
      })
      deps.requestRender()
    },
    dispose(): void {
      void overlay?.close()
      overlay = undefined
    },
  }
  return controller
}
