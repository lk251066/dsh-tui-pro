/**
 * Persistent session sidebar state shared by every live session.
 * @module @deepseek-ai/dsh-tui/chat/session-layout
 */

import { SessionId } from '@deepseek-ai/dsh-session'
import type { Component } from '@earendil-works/pi-tui'
import { SessionListComponent, type SessionListItem } from '../components/session-list.ts'
import type { Palette } from '../components/theme.ts'
import { displayText } from '../components/text.ts'
import {
  WorkspaceSidebarComponent,
  type WorkspaceSidebarState,
} from '../components/workspace-sidebar.ts'
import type { ChannelRegistry } from './channel-registry.ts'
import type { TuiSessionSlot } from '../index.ts'

/** Controls the persistent live-session sidebar. */
export interface SessionLayoutController {
  /** The focusable live-session navigator. */
  readonly sessionList: SessionListComponent
  /** The full persistent workspace, session, and status pane. */
  readonly sidebar: WorkspaceSidebarComponent
  /** Rebuild the sidebar rows from current registry state for the next render. */
  refresh(): void
  /** Update active-session operational values without rebuilding navigation. */
  updateStatus(state: WorkspaceSidebarState): void
}

/** Collaborators required by the persistent session layout. */
export interface SessionLayoutDeps {
  readonly palette: Palette
  readonly registry: ChannelRegistry<TuiSessionSlot>
  /** Current terminal height, used to bound the sidebar rows. */
  terminalRows(): number
  /** Current wall-clock time used for session activity labels. */
  now(): number
  /** Live active-agent activity rendered in the sidebar. */
  activity: Component
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
  if (titleEvent?.type === 'session/title') return displayText(titleEvent.data.title)
  return displayText(String(slot.sessionId))
}

function workspaceOf(slot: TuiSessionSlot): string {
  const cwd = displayText(slot.agent.session.header.cwd ?? '(unknown)')
  const normalized = cwd.replaceAll('\\', '/').replace(/\/$/u, '')
  return normalized.slice(normalized.lastIndexOf('/') + 1) || cwd
}

function itemOf(slot: TuiSessionSlot, activeId: SessionId, now: number): SessionListItem {
  const events = slot.agent.session.events
  const lastActivityAt = events.at(-1)?.time ?? slot.agent.session.header.createdAt
  return {
    id: String(slot.sessionId),
    title: titleOf(slot),
    workspace: workspaceOf(slot),
    status: slot.agent.status,
    lastActivityAgo: formatAge(Math.max(0, now - lastActivityAt)),
    isActive: slot.sessionId === activeId,
  }
}

/**
 * Create the persistent live-session sidebar.
 * @param deps - Registry, focus, terminal-size, and repaint collaborators.
 * @returns The layout controller mounted by the TUI host.
 */
export function createSessionLayout(deps: SessionLayoutDeps): SessionLayoutController {
  const sessionList = new SessionListComponent(deps.palette, {
    // Workspace and status sections retain their rows; sessions consume the
    // remaining viewport and scroll around the selected item.
    maxRows: () => Math.max(3, deps.terminalRows() - 19),
    onActivate: (sessionId) => {
      deps.registry.switchTo(SessionId(sessionId))
    },
    onExit: deps.focusEditor,
    onChange: deps.requestRender,
  })
  const sidebar = new WorkspaceSidebarComponent(deps.palette, sessionList, {
    terminalRows: deps.terminalRows,
    activity: deps.activity,
  })

  const refresh = (): void => {
    const activeId = deps.registry.activeId()
    const now = deps.now()
    const items = deps.registry.slots()
      .slice()
      .sort((left, right) =>
        left.agent.session.header.createdAt - right.agent.session.header.createdAt)
      .map(slot => itemOf(slot, activeId, now))
    sessionList.setItems(items, sessionList.focused ? undefined : String(activeId))
  }

  return {
    sessionList,
    sidebar,
    refresh,
    updateStatus(state): void {
      sidebar.update(state)
    },
  }
}
