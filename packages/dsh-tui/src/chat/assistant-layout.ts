/**
 * Assistant hub split-view layout: left pane shows session list, right pane
 * shows assistant chat. Only active when the assistant session is mounted.
 * @module @deepseek-ai/dsh-tui/chat/assistant-layout
 */

import { SessionId } from '@deepseek-ai/dsh-session'
import { SessionListComponent } from '../components/session-list.ts'
import { SplitLayoutComponent } from '../components/split-layout.ts'
import type { Palette } from '../components/theme.ts'
import type { ChannelRegistry } from './channel-registry.ts'
import type { TuiSessionSlot } from '../index.ts'
import { ASSISTANT_SESSION_ID } from './assistant.ts'

export interface AssistantLayoutController {
  /** The split-view container (replaces single chat in UI tree). */
  readonly splitLayout: SplitLayoutComponent
  /** The left pane session list component. */
  readonly sessionList: SessionListComponent
  /** Refresh the session list from current registry state. */
  refresh(): void
  /** Navigate list: select next session (down arrow). */
  selectNext(): void
  /** Navigate list: select previous session (up arrow). */
  selectPrevious(): void
  /** Switch to the currently selected session in the list. */
  switchToSelected(): void
  /** Whether the split-view is currently active (assistant mounted). */
  isActive(): boolean
}

export interface AssistantLayoutDeps {
  readonly palette: Palette
  readonly registry: ChannelRegistry<TuiSessionSlot>
  /** Terminal height for list sizing. */
  terminalRows: () => number
  /** Request full UI repaint. */
  requestRender(): void
}

/**
 * Create the assistant hub's split-view layout controller. The layout is only
 * active when the assistant session is mounted; other sessions use the
 * traditional full-width chat.
 */
export function createAssistantLayout(deps: AssistantLayoutDeps): AssistantLayoutController {
  const { palette, registry, terminalRows, requestRender } = deps

  const splitLayout = new SplitLayoutComponent(palette)
  const sessionList = new SessionListComponent(palette, terminalRows())

  // Right pane will be set by the host when mounting the assistant
  // (it's the assistant's SessionChannel.chat container)

  const refresh = (): void => {
    const slots = registry.slots()
    const activeSlot = registry.active()

    const items = slots.map((slot) => {
      const agent = slot.agent
      const events = agent.session.events
      const lastEvent = events[events.length - 1]
      const lastActivityAt = lastEvent?.time ?? Date.now()
      const ageMs = Date.now() - lastActivityAt

      // Get title from session/title event
      const titleEvent = [...events].reverse().find(e => e.type === 'session/title')
      const title = (titleEvent && 'data' in titleEvent && typeof titleEvent.data === 'object' && titleEvent.data && 'title' in titleEvent.data)
        ? String((titleEvent.data as { title: unknown }).title)
        : String(slot.sessionId)

      // Get cwd from session header
      const cwd = agent.session.header.cwd ?? '(unknown)'

      // Format age
      const formatAge = (ms: number): string => {
        if (ms < 60_000) return 'just now'
        if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`
        if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h ago`
        return `${Math.floor(ms / 86400_000)}d ago`
      }

      return {
        id: String(slot.sessionId),
        title,
        cwd,
        status: agent.status,
        lastActivityAgo: formatAge(ageMs),
        isActive: slot.sessionId === activeSlot.sessionId,
      }
    })

    sessionList.setItems(items)
    requestRender()
  }

  const selectNext = (): void => {
    sessionList.selectNext()
    requestRender()
  }

  const selectPrevious = (): void => {
    sessionList.selectPrevious()
    requestRender()
  }

  const switchToSelected = (): void => {
    const selectedId = sessionList.getSelectedSessionId()
    if (selectedId === undefined) return
    // Don't switch if already on the selected session
    if (selectedId === String(registry.active().sessionId)) return
    registry.switchTo(SessionId(selectedId))
  }

  const isActive = (): boolean => {
    return registry.active().sessionId === ASSISTANT_SESSION_ID
  }

  return {
    splitLayout,
    sessionList,
    refresh,
    selectNext,
    selectPrevious,
    switchToSelected,
    isActive,
  }
}
