/**
 * Persistent two-column session layout: a live-session navigator on the left
 * and the active session's chat on the right.
 * @module @deepseek-ai/dsh-tui/chat/session-layout
 */

import { SessionId } from '@deepseek-ai/dsh-session'
import { SessionListComponent, type SessionListItem } from '../components/session-list.ts'
import { SplitLayoutComponent } from '../components/split-layout.ts'
import type { Palette } from '../components/theme.ts'
import type { ChannelRegistry } from './channel-registry.ts'
import type { TuiSessionSlot } from '../index.ts'

/** Controls the persistent live-session sidebar and split container. */
export interface SessionLayoutController {
  /** The two-column container mounted for every active session. */
  readonly splitLayout: SplitLayoutComponent
  /** The focusable live-session navigator. */
  readonly sessionList: SessionListComponent
  /** Rebuild the sidebar rows from current registry state. */
  refresh(): void
}

/** Collaborators required by the persistent session layout. */
export interface SessionLayoutDeps {
  readonly palette: Palette
  readonly registry: ChannelRegistry<TuiSessionSlot>
  /** Current terminal height, used to bound the sidebar rows. */
  terminalRows(): number
  /** Return keyboard focus to the chat editor. */
  focusEditor(): void
  /** Request a full repaint after navigation or registry changes. */
  requestRender(): void
}

function formatAge(ageMs: number): string {
  if (ageMs < 60_000) return 'now'
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m`
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h`
  return `${Math.floor(ageMs / 86_400_000)}d`
}

function titleOf(slot: TuiSessionSlot): string {
  const titleEvent = slot.agent.session.events.findLast(event => event.type === 'session/title')
  if (titleEvent?.type === 'session/title') return titleEvent.data.title
  return String(slot.sessionId)
}

function itemOf(slot: TuiSessionSlot, activeId: SessionId, now: number): SessionListItem {
  const events = slot.agent.session.events
  const lastActivityAt = events.at(-1)?.time ?? slot.agent.session.header.createdAt
  return {
    id: String(slot.sessionId),
    title: titleOf(slot),
    cwd: slot.agent.session.header.cwd ?? '(unknown)',
    status: slot.agent.status,
    lastActivityAgo: formatAge(Math.max(0, now - lastActivityAt)),
    isActive: slot.sessionId === activeId,
  }
}

/**
 * Create the persistent two-column session layout.
 * @param deps - Registry, focus, terminal-size, and repaint collaborators.
 * @returns The layout controller mounted by the TUI host.
 */
export function createSessionLayout(deps: SessionLayoutDeps): SessionLayoutController {
  const splitLayout = new SplitLayoutComponent(deps.palette)
  const sessionList = new SessionListComponent(deps.palette, {
    maxRows: () => Math.max(4, deps.terminalRows() - 8),
    onActivate: (sessionId) => {
      deps.registry.switchTo(SessionId(sessionId))
    },
    onExit: deps.focusEditor,
    onChange: deps.requestRender,
  })

  const refresh = (): void => {
    const activeId = deps.registry.activeId()
    const now = Date.now()
    const items = deps.registry.slots()
      .slice()
      .sort((left, right) =>
        left.agent.session.header.createdAt - right.agent.session.header.createdAt)
      .map(slot => itemOf(slot, activeId, now))
    sessionList.setItems(items, sessionList.focused ? undefined : String(activeId))
    deps.requestRender()
  }

  return { splitLayout, sessionList, refresh }
}
