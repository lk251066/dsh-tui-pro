/**
 * Durable active-session membership projected from the workspace registry.
 * @module @lk251066/dsh-tui/chat/workspace-sessions
 */

import type { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import { ASSISTANT_SESSION_ID } from './assistant.ts'

/** One project session deliberately retained in the active workspace list. */
export interface ActiveWorkspaceSession {
  readonly sessionId: SessionId
  readonly workspace: Workspace
}

/** Host-side operations over the user's durable active-session list. */
export interface WorkspaceSessions {
  /** Active project sessions in durable workspace and session order. */
  list(): readonly ActiveWorkspaceSession[]
  /** Whether one project session is in the active list. */
  has(sessionId: SessionId): boolean
  /** Add a live or persisted project session to the workspace owning its cwd. */
  add(sessionId: SessionId): Promise<void>
  /** Remove a project session from the active list without deleting its log. */
  remove(sessionId: SessionId): Promise<boolean>
}

/**
 * Build active-session operations over the mounted workspace registry.
 * @param ctx - Context with workspace, live-session, and persistence services.
 * @returns Durable membership operations used by the TUI and assistant tools.
 */
export function createWorkspaceSessions(ctx: Context): WorkspaceSessions {
  const list = (): ActiveWorkspaceSession[] => ctx.workspaceRegistry.list().flatMap(workspace =>
    workspace.sessionIds
      .filter(sessionId => sessionId !== ASSISTANT_SESSION_ID)
      .map(sessionId => ({ sessionId, workspace })))

  const sessionCwd = async (sessionId: SessionId): Promise<string> => {
    const live = ctx.sessions.get(sessionId)
    if (live?.header.cwd !== undefined) return live.header.cwd
    const persistence = ctx.get('sessionPersistence')
    if (persistence === undefined) throw new Error('session persistence is not mounted')
    const header = (await persistence.list()).find(candidate => candidate.id === sessionId)
    if (header === undefined) throw new Error(`session "${sessionId}" is not available`)
    if (header.cwd === undefined) throw new Error(`session "${sessionId}" has no project directory`)
    return header.cwd
  }

  return {
    list,
    has(sessionId): boolean {
      return list().some(candidate => candidate.sessionId === sessionId)
    },
    async add(sessionId): Promise<void> {
      if (sessionId === ASSISTANT_SESSION_ID) return
      const cwd = await sessionCwd(sessionId)
      const workspace = await ctx.workspaceRegistry.resolveByPath(cwd)
        ?? await ctx.workspaceRegistry.create(cwd)
      await workspace.attachSession(sessionId)
    },
    async remove(sessionId): Promise<boolean> {
      if (sessionId === ASSISTANT_SESSION_ID) return false
      const candidate = list().find(item => item.sessionId === sessionId)
      if (candidate === undefined) return false
      await candidate.workspace.detachSession(sessionId)
      return true
    },
  }
}
