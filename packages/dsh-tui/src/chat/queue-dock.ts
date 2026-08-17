/**
 * Queue-dock controller: mirrors the agent's inbox lanes into the dock, drives
 * the `/queue` sheet, and carries the edit-in-flight target so a submitted
 * edit REPLACES its queued message instead of enqueuing a new one.
 * @module @deepseek-ai/dsh-tui/chat/queue-dock
 */

import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage, type ContentBlock, type MessageId, type UserMessage } from '@deepseek-ai/dsh-llm'
import { contentText } from '../components/content.ts'
import { QueueDialog, QueueDockComponent, type QueueEntry } from '../components/queue-dock.ts'
import type { ChannelNotice, ChatChannelDeps } from './channel.ts'

/** Collaborators the queue dock needs from the chat channel. */
export interface QueueDockDeps extends ChatChannelDeps, ChannelNotice {
  /** The agent whose inbox the dock mirrors. */
  agent: Agent
  /** Load a message body into the editor for editing (the caller owns the editor). */
  loadIntoEditor(text: string): void
  /**
   * Show an operation receipt in the transient notice slot; absent falls back
   * to the persistent transcript notice.
   */
  showTransientNotice?(message: string): void
}

/** Queue-dock controller for one chat channel. */
export interface QueueDockController {
  /** The mounted dock component (already parented by the caller). */
  readonly component: QueueDockComponent
  /** Re-derive from the inbox (call on inbox events). */
  refresh(): void
  /** Open the `/queue` management sheet. */
  showSheet(): void
  /** How many messages currently wait in the inbox lanes. */
  pendingCount(): number
  /**
   * Pop the newest queued message back into the editor for editing (empty-input
   * ↑): arms the same submit-replaces-queued-message target the sheet's edit
   * path uses. The message stays queued until the edit is submitted.
   * @returns whether a queued message was armed and loaded.
   */
  armLatestForEdit(): boolean
  /**
   * Load one still-pending submission for editing. The next submit replaces
   * that exact inbox item in place.
   * @param messageId - Pending message identity recorded at submission time.
   * @returns whether the message was still pending and was loaded.
   */
  armForEdit(messageId: MessageId): boolean
  /**
   * A pending edit target: when set, the next submit replaces this queued
   * message rather than dispatching a new turn; cleared after one submit.
   */
  takeEditTarget(): UserMessage | undefined
  /** Whether an inbox edit is armed (suppresses the ordinary submit path). */
  hasEditTarget(): boolean
  /** Stop treating the editor draft as an in-place queue edit. */
  cancelEditTarget(): void
  /** Tear down state. */
  dispose(): void
}

/**
 * Build the queue dock for one chat channel.
 * @param deps - channel collaborators, the owned agent, and the editor loader.
 * @returns the controller.
 */
export function createQueueDock(deps: QueueDockDeps): QueueDockController {
  const { agent } = deps
  const component = new QueueDockComponent(deps.palette)
  let editTarget: UserMessage | undefined

  const entryOf = (message: UserMessage, lane: 'step' | 'turn'): QueueEntry => ({
    id: message.id,
    preview: contentText(message.content).split('\n').find(line => line.trim() !== '') ?? '',
    lane,
  })

  /** Live inbox lanes, or `undefined` for agents without the inbox projection. */
  const inboxLanes = (): { readonly nextStep: readonly UserMessage[]; readonly nextTurn: readonly UserMessage[] } | undefined =>
    (agent as {
      inbox?: { readonly nextStep: readonly UserMessage[]; readonly nextTurn: readonly UserMessage[] }
    }).inbox

  const entries = (): QueueEntry[] => {
    // Test/embedder agents may not carry the inbox projection; an absent
    // inbox renders an empty dock rather than throwing on every refresh.
    const inbox = inboxLanes()
    if (inbox === undefined) return []
    return [
      ...inbox.nextStep.map(message => entryOf(message, 'step')),
      ...inbox.nextTurn.map(message => entryOf(message, 'turn')),
    ]
  }

  const armForEdit = (messageId: MessageId): boolean => {
    const inbox = inboxLanes()
    if (inbox === undefined) return false
    const message = [...inbox.nextStep, ...inbox.nextTurn]
      .find(candidate => candidate.id === messageId)
    if (message === undefined) return false
    editTarget = message
    deps.loadIntoEditor(contentText(message.content))
    return true
  }

  return {
    component,
    refresh(): void {
      component.update(entries())
      deps.requestRender()
    },
    showSheet(): void {
      const current = entries()
      const session = deps.overlayManager.open({
        create: () => new QueueDialog(
          current,
          deps.palette,
          (entry) => {
            const message = [...agent.inbox.nextStep, ...agent.inbox.nextTurn]
              .find(candidate => candidate.id === entry.id)
            if (message === undefined) {
              deps.appendNotice('That queued message is no longer pending.', 'warning')
              return
            }
            editTarget = message
            deps.loadIntoEditor(contentText(message.content))
          },
          (entry) => {
            try {
              agent.inbox.remove(entry.id as MessageId)
              // A removal receipt is pure operation feedback: transient when the
              // channel offers the notice slot, persistent otherwise.
              if (deps.showTransientNotice !== undefined) deps.showTransientNotice('Queued message removed.')
              else deps.appendNotice('Queued message removed.')
            } catch (error) {
              deps.appendNotice(`Failed to remove the queued message: ${String(error)}`, 'error')
            }
          },
          () => { void session.close() },
        ),
        options: { width: 76, maxHeight: 16 },
      }, 'inline')
      deps.requestRender()
    },
    pendingCount(): number {
      const inbox = inboxLanes()
      return inbox === undefined ? 0 : inbox.nextStep.length + inbox.nextTurn.length
    },
    armLatestForEdit(): boolean {
      const inbox = inboxLanes()
      if (inbox === undefined) return false
      // The imminent step lane first: its tail is the newest message joining
      // the running step, else the newest message waiting for the next turn.
      const message = inbox.nextStep[inbox.nextStep.length - 1]
        ?? inbox.nextTurn[inbox.nextTurn.length - 1]
      if (message === undefined) return false
      editTarget = message
      deps.loadIntoEditor(contentText(message.content))
      return true
    },
    armForEdit,
    takeEditTarget(): UserMessage | undefined {
      const target = editTarget
      editTarget = undefined
      return target
    },
    hasEditTarget(): boolean {
      return editTarget !== undefined
    },
    cancelEditTarget(): void {
      editTarget = undefined
    },
    dispose(): void {
      editTarget = undefined
    },
  }
}

/** Build the replacement for an edited queued message: fresh identity, same source. */
export function replaceQueuedMessage(message: UserMessage, content: readonly ContentBlock[]): UserMessage {
  return createUserMessage({ content: [...content], source: message.source })
}
