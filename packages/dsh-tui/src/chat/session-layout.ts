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
import { ASSISTANT_SESSION_ID } from './assistant.ts'
import type { WorkspaceSessions } from './workspace-sessions.ts'

/** Controls the persistent live-session sidebar. */
export interface SessionLayoutController {
  /** The focusable live-session navigator. */
  readonly sessionList: SessionListComponent
  /** The full persistent workspace, session, and status pane. */
  readonly sidebar: WorkspaceSidebarComponent
  /** Rebuild the sidebar rows from current registry state for the next render. */
  refresh(): void
  /** Merge titles read from persisted stopped sessions, then rebuild the rows. */
  setPersistedTitles(titles: ReadonlyMap<SessionId, string>): void
  /** Update active-session operational values without rebuilding navigation. */
  updateStatus(state: WorkspaceSidebarState): void
}

/** Collaborators required by the persistent session layout. */
export interface SessionLayoutDeps {
  readonly palette: Palette
  readonly registry: ChannelRegistry<TuiSessionSlot>
  readonly workspaceSessions: WorkspaceSessions
  /** Current terminal height, used to bound the sidebar rows. */
  terminalRows(): number
  /** Current wall-clock time used for session activity labels. */
  now(): number
  /** Live active-agent activity rendered in the sidebar. */
  activity: Component
}

function formatAge(ageMs: number): string {
  if (ageMs < 60_000) return 'now'
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m`
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h`
  return `${Math.floor(ageMs / 86_400_000)}d`
}

function titleOf(slot: TuiSessionSlot): string | undefined {
  const titleEvent = slot.agent.session.events.findLast(event => event.type === 'session/title')
  if (titleEvent?.type === 'session/title') return displayText(titleEvent.data.title)
  return undefined
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
    title: titleOf(slot) ?? displayText(String(slot.sessionId)),
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
  const persistedTitles = new Map<SessionId, string>()
  const sessionList = new SessionListComponent(deps.palette, {
    // Workspace and status sections retain their rows; sessions consume the
    // remaining viewport and scroll around the selected item.
    maxRows: () => Math.max(3, deps.terminalRows() - 19),
  })
  const sidebar = new WorkspaceSidebarComponent(deps.palette, sessionList, {
    terminalRows: deps.terminalRows,
    activity: deps.activity,
  })

  const refresh = (): void => {
    const activeId = deps.registry.activeId()
    const now = deps.now()
    const assistantSlot = deps.registry.get(ASSISTANT_SESSION_ID)
    const assistant = assistantSlot === undefined
      ? stoppedItem(ASSISTANT_SESSION_ID, 'personal', activeId, persistedTitles.get(ASSISTANT_SESSION_ID) ?? 'Assistant')
      : rememberTitle(persistedTitles, assistantSlot, itemOf(assistantSlot, activeId, now))
    const projects = deps.workspaceSessions.list().map(({ sessionId, workspace }) => {
      const slot = deps.registry.get(sessionId)
      return slot === undefined
        ? stoppedItem(sessionId, workspace.title, activeId, persistedTitles.get(sessionId))
        : rememberTitle(persistedTitles, slot, itemOf(slot, activeId, now))
    })
    sessionList.setItems([assistant, ...projects])
  }

  return {
    sessionList,
    sidebar,
    refresh,
    setPersistedTitles(titles): void {
      for (const [sessionId, title] of titles) persistedTitles.set(sessionId, displayText(title))
      refresh()
    },
    updateStatus(state): void {
      sidebar.update(state)
    },
  }
}

function rememberTitle(
  titles: Map<SessionId, string>,
  slot: TuiSessionSlot,
  item: SessionListItem,
): SessionListItem {
  const title = titleOf(slot)
  if (title !== undefined) titles.set(slot.sessionId, title)
  return item
}

function stoppedItem(
  sessionId: SessionId,
  workspace: string,
  activeId: SessionId,
  title?: string,
): SessionListItem {
  return {
    id: String(sessionId),
    title: title ?? displayText(String(sessionId)),
    workspace: displayText(workspace),
    status: 'stopped',
    lastActivityAgo: '',
    isActive: sessionId === activeId,
  }
}
