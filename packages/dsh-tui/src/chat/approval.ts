/**
 * Tool-approval sub-machine for the interactive chat channel. Claims the
 * `approval/request` waterfall for THIS channel's agent and answers it with a
 * keyboard overlay — the terminal counterpart of the web ApprovalPanel, and the
 * difference between a tool call that runs and one that fails closed with
 * "no approval channel available".
 *
 * Every claimed request resolves on ALL paths (choice, Esc, abort, overlay
 * error, shutdown): a hung overlay would hang the tool call behind it. Requests
 * from this agent and its live runtime descendants share the queue; unrelated
 * agents fall through to `next()` unchanged.
 * @module @deepseek-ai/dsh-tui/chat/approval
 */

import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage, type CallId } from '@deepseek-ai/dsh-llm'
import type { ApprovalOutcome, ApprovalRequest } from '@deepseek-ai/dsh-user-approval'
import type { TuiOverlaySession } from '../extension/types.ts'
import { ApprovalDialog, type ApprovalChoice } from '../components/dialogs.ts'
import type { ChannelNotice, ChatChannelDeps } from './channel.ts'

/** Collaborators the approval answerer needs from the chat channel. */
export interface ApprovalAnswererDeps extends ChatChannelDeps, ChannelNotice {
  /** The one agent whose asks this terminal answers. */
  agent: Agent
  /** Current row budget after reserving the editor. */
  questionMaxHeight(): number
  /** The pending tool call's one-line label, when its card is on screen. */
  pendingCallLabel(callId: CallId | undefined): string | undefined
}

/** Tool-approval controller for one chat channel. */
export interface ApprovalAnswerer {
  /** Settle the active and all queued asks `'cancelled'` (shutdown). */
  drain(): void
  /** Remove the waterfall listener. */
  unregister(): void
}

/**
 * Build the approval answerer for one chat channel.
 * @param deps - channel collaborators, the owned agent, and the overlay host.
 * @returns the controller used at shutdown to drain and unregister.
 */
export function createApprovalAnswerer(deps: ApprovalAnswererDeps): ApprovalAnswerer {
  const { ctx, agent, resolved, palette, overlayManager } = deps

  /** One claimed ask and how to settle it. */
  interface PendingApproval {
    request: ApprovalRequest
    resolve: (outcome: ApprovalOutcome) => void
    onAbort: () => void
    overlay: TuiOverlaySession | undefined
  }

  const queue: PendingApproval[] = []
  let active: PendingApproval | undefined

  /**
   * Tools granted for this TUI's lifetime — Claude Code's "allow all edits
   * during this session" memory: in-process only, per tool, never persisted.
   * The approval service still logs its own audit pair for allowed asks, so a
   * set-membership answer only resolves, it does not re-record.
   */
  const sessionAllowedTools = new Set<string>()

  const detach = (pending: PendingApproval): void => {
    pending.request.signal?.removeEventListener('abort', pending.onAbort)
  }

  /** Settle one ask, retiring it from the active slot if it holds it. */
  const settle = (pending: PendingApproval, outcome: ApprovalOutcome): void => {
    if (active === pending) active = undefined
    void pending.overlay?.close()
    pending.overlay = undefined
    detach(pending)
    pending.resolve(outcome)
  }

  /**
   * Deliver the approval footnote into the agent's pending input — the same
   * channel the editor uses (steer while running, followup while idle), so the
   * model reads `(approval feedback for <tool>): <text>` at its next step
   * boundary alongside the tool result it just earned.
   */
  const deliverFeedback = (target: Agent, toolName: string, feedback: string): void => {
    try {
      const message = createUserMessage({
        content: [{ type: 'text', text: `(approval feedback for ${toolName}): ${feedback}` }],
        source: { kind: 'user' },
      })
      if (target.status === 'running') target.steer(message)
      else target.followup(message)
    } catch (error) {
      deps.appendNotice(`Failed to deliver approval feedback: ${String(error)}`, 'error')
    }
  }

  const showNext = (): void => {
    if (active !== undefined || deps.isDisposed()) return
    const pending = queue.shift()
    if (pending === undefined) return
    active = pending
    const request = pending.request
    const callLabel = request.agent === agent
      ? deps.pendingCallLabel(request.callId)
      : `Subagent ${request.agent.session.id}`
    const session = overlayManager.open({
      ...request.signal === undefined ? {} : { signal: request.signal },
      create: () => new ApprovalDialog(
        request.toolName,
        request.reason,
        callLabel,
        palette,
        (choice: ApprovalChoice, feedback?: string) => {
          if (choice === 'allow-session') sessionAllowedTools.add(request.toolName)
          settle(pending, choice === 'reject' ? 'rejected' : 'allowed-once')
          if (feedback !== undefined) deliverFeedback(request.agent, request.toolName, feedback)
          showNext()
        },
        () => { /* settled by the choice handler */ },
      ),
      options: {
        width: Math.min(resolved.questionDialogWidth, 100),
        maxHeight: deps.questionMaxHeight(),
      },
    }, 'inline')
    pending.overlay = session
    void session.closed.then((result) => {
      if (pending.overlay !== session) return
      pending.overlay = undefined
      // An overlay that died without a choice (owner disposed, render error)
      // fails closed; abort and shutdown settle through their own paths.
      if (result.reason !== 'error') return
      settle(pending, 'cancelled')
    })
    deps.requestRender()
  }

  /** Whether one live agent is this root or a runtime descendant of it. */
  const belongsToRoot = (candidate: Agent): boolean => {
    if (candidate === agent) return true
    const live = ctx.agents.list()
    const seen = new Set<Agent>([agent])
    const pending = [agent]
    while (pending.length > 0) {
      const parent = pending.shift()
      /* v8 ignore next -- pending only receives concrete agents. */
      if (parent === undefined) break
      for (const child of live) {
        if (seen.has(child) || !ctx.agents.isOwnedBy(child.id, parent)) continue
        if (child === candidate) return true
        seen.add(child)
        pending.push(child)
      }
    }
    return false
  }

  const removeListener = ctx.on('approval/request', (request: ApprovalRequest, next) => {
    if (!belongsToRoot(request.agent)) return next()
    // A session grant answers without a prompt: the tool was allowed for this
    // TUI's lifetime, so the ask resolves allowed-once immediately.
    if (sessionAllowedTools.has(request.toolName)) {
      return Promise.resolve<ApprovalOutcome>('allowed-once')
    }
    return new Promise<ApprovalOutcome>((resolveOutcome) => {
      const pending: PendingApproval = {
        request,
        resolve: resolveOutcome,
        onAbort: () => {
          if (active === pending) {
            settle(pending, 'cancelled')
            showNext()
            return
          }
          const index = queue.indexOf(pending)
          if (index >= 0) {
            queue.splice(index, 1)
            settle(pending, 'cancelled')
          }
        },
        overlay: undefined,
      }
      // One listener covers the ask through its whole life: queued or showing.
      request.signal?.addEventListener('abort', pending.onAbort, { once: true })
      queue.push(pending)
      showNext()
    })
  })

  return {
    drain(): void {
      if (active !== undefined) settle(active, 'cancelled')
      for (const pending of queue.splice(0)) settle(pending, 'cancelled')
    },
    unregister: removeListener,
  }
}
