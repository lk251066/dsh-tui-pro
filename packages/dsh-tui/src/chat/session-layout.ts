/**
 * Persistent session sidebar state shared by every live session.
 * @module @deepseek-ai/dsh-tui/chat/session-layout
 */

import { SessionId } from '@deepseek-ai/dsh-session'
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

function itemOf(
  slot: TuiSessionSlot,
  activeId: SessionId,
  now: number,
  persistedTitles: ReadonlyMap<SessionId, string>,
  workspace?: string,
): SessionListItem {
  const events = slot.agent.session.events
  const lastActivityAt = events.at(-1)?.time ?? slot.agent.session.header.createdAt
  const item = {
    id: String(slot.sessionId),
    title: titleOf(slot) ?? persistedTitles.get(slot.sessionId) ?? displayText(String(slot.sessionId)),
    status: slot.agent.status,
    lastActivityAgo: formatAge(Math.max(0, now - lastActivityAt)),
    isActive: slot.sessionId === activeId,
  }
  return workspace === undefined
    ? { ...item, kind: 'assistant' }
    : { ...item, kind: 'project', workspace: displayText(workspace) }
}

/**
 * Create the persistent live-session sidebar.
 * @param deps - Registry, focus, terminal-size, and repaint collaborators.
 * @returns The layout controller mounted by the TUI host.
 */
export function createSessionLayout(deps: SessionLayoutDeps): SessionLayoutController {
  const persistedTitles = new Map<SessionId, string>()
  const sessionList = new SessionListComponent(deps.palette, {
    // The assistant and status sections retain their rows; projects consume
    // the remaining viewport and scroll around the selected item.
    maxRows: () => Math.max(7, deps.terminalRows() - 6),
  })
  const sidebar = new WorkspaceSidebarComponent(deps.palette, sessionList, {
    terminalRows: deps.terminalRows,
  })

  const refresh = (): void => {
    const activeId = deps.registry.activeId()
    const now = deps.now()
    const workspaces = deps.workspaceSessions.list()
    const retainedTitles = new Set<SessionId>([
      ASSISTANT_SESSION_ID,
      ...workspaces.map(workspace => workspace.sessionId),
    ])
    for (const sessionId of persistedTitles.keys()) {
      if (!retainedTitles.has(sessionId)) persistedTitles.delete(sessionId)
    }
    const assistantSlot = deps.registry.get(ASSISTANT_SESSION_ID)
    const assistant = assistantSlot === undefined
      ? stoppedItem(ASSISTANT_SESSION_ID, activeId, persistedTitles.get(ASSISTANT_SESSION_ID) ?? 'Assistant')
      : rememberTitle(persistedTitles, assistantSlot, itemOf(assistantSlot, activeId, now, persistedTitles))
    const projects = workspaces.map(({ sessionId, workspace }) => {
      const slot = deps.registry.get(sessionId)
      return slot === undefined
        ? stoppedItem(sessionId, activeId, persistedTitles.get(sessionId), workspace.title)
        : rememberTitle(persistedTitles, slot, itemOf(slot, activeId, now, persistedTitles, workspace.title))
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
  activeId: SessionId,
  title?: string,
  workspace?: string,
): SessionListItem {
  const item = {
    id: String(sessionId),
    title: title ?? displayText(String(sessionId)),
    status: 'stopped' as const,
    lastActivityAgo: '',
    isActive: sessionId === activeId,
  }
  return workspace === undefined
    ? { ...item, kind: 'assistant' }
    : { ...item, kind: 'project', workspace: displayText(workspace) }
}
