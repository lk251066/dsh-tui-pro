/**
 * Workspace-aware agent-loop launcher for the bundled terminal profile.
 * @module @lk251066/dsh-tui/workspace-agent-loop
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import AgentLoop, {
  CONFIGURED_AGENT_IDENTITIES_KEY,
  type Config as AgentLoopConfig,
} from '@deepseek-ai/dsh-agent-loop'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-workspace'

/** Exact project session selected before the terminal front door mounts. */
export interface TuiWorkspaceStartup {
  readonly sessionId: SessionId
  readonly cwd: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Workspace-selected project session for this terminal process. */
    tuiWorkspaceStartup: TuiWorkspaceStartup
  }
}

/** Context key supplied after the selected session is live and durably attached. */
export const TUI_WORKSPACE_STARTUP_KEY = 'tuiWorkspaceStartup'

/** Cordis plugin name. */
export const name = 'workspace-agent-loop'

/** Workspace state and agent lifecycle services must be ready before selection. */
export const inject = ['workspaceRegistry', 'agents']

/** The wrapper accepts the upstream agent-loop configuration unchanged. */
export const Config: typeof AgentLoop.Config = AgentLoop.Config

/**
 * Start exactly one project agent chosen from the current directory's durable
 * workspace membership, creating and attaching one when that membership is empty.
 * @param ctx - Plugin context with the workspace registry and agent services.
 * @param config - Upstream route configuration for the terminal's main agent.
 */
export async function apply(ctx: Context, config: AgentLoopConfig): Promise<void> {
  if (config.agents.length !== 1) {
    throw new Error(`workspace-agent-loop requires exactly one configured agent, got ${config.agents.length}`)
  }
  const configured = config.agents[0]
  if (configured === undefined) throw new Error('workspace-agent-loop requires one configured agent')
  const { id: label, sessionId: _sessionId, resumeSessionId: _resumeSessionId, cwd: configuredCwd, ...agentOptions } = configured
  const cwd = configuredCwd ?? process.cwd()

  // The personal assistant is a fixed special session, never a project
  // workspace member even when an older release indexed its cwd at bootstrap.
  for (const workspace of ctx.workspaceRegistry.list()) {
    if (workspace.sessionIds.includes(SessionId('assistant'))) {
      await workspace.detachSession(SessionId('assistant'))
    }
  }

  const workspace = await ctx.workspaceRegistry.resolveByPath(cwd)
    ?? await ctx.workspaceRegistry.create(cwd)
  const launcherIdentity = ctx.get(CONFIGURED_AGENT_IDENTITIES_KEY)?.[label]
  const selected = launcherIdentity?.id ?? workspace.sessionIds[0] ?? SessionId(`session-${randomUUID()}`)
  const resume = launcherIdentity?.resume ?? workspace.sessionIds.includes(selected)

  // Install the maintained loop service without declarative agents; this
  // wrapper owns the one explicit create/resume so workspace durability can
  // settle before the TUI becomes available.
  await ctx.plugin(AgentLoop, { ...config, agents: [] })
  const handle = resume
    ? await ctx.agents.resume({ resumeSessionId: selected, agentOptions })
    : await ctx.agents.create({ sessionId: selected, seed: [], meta: { cwd: workspace.path }, agentOptions })

  if (!resume) await workspace.attachSession(handle.agent.session.id)
  ctx.provide(TUI_WORKSPACE_STARTUP_KEY, {
    sessionId: handle.agent.session.id,
    cwd: handle.agent.session.header.cwd ?? workspace.path,
  })
}
