/**
 * Persistent workspace sidebar: project identity, live sessions, and the
 * active agent's operational status in one fixed navigation pane.
 * @module @lk251066/dsh-tui/components/workspace-sidebar
 */

import {
  truncateToWidth,
  visibleWidth,
  type Component,
} from '@earendil-works/pi-tui'
import type { AgentStatus } from '@deepseek-ai/dsh-agent'
import { contextPressureLevel } from '../chat/context-pressure.ts'
import { formatTokens } from '../chat/tokens.ts'
import { SessionListComponent } from './session-list.ts'
import { displayText } from './text.ts'
import type { Palette } from './theme.ts'

/** Live values rendered below the session navigator. */
export interface WorkspaceSidebarState {
  readonly cwd: string
  readonly branch: string | undefined
  readonly status: AgentStatus
  readonly model: string
  readonly contextPercent: number | undefined
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheHitRate: number | undefined
  readonly queued: number
  readonly permission: string | undefined
  readonly plan: boolean
}

/** Fixed collaborators used to place live status within the terminal viewport. */
export interface WorkspaceSidebarOptions {
  /** Current terminal height in rows. */
  readonly terminalRows: () => number
  /** Live activity line shared with the active agent. */
  readonly activity: Component
}

function padToWidth(value: string, width: number): string {
  const clipped = truncateToWidth(value, Math.max(0, width), '')
  return clipped + ' '.repeat(Math.max(0, width - visibleWidth(clipped)))
}

function workspaceLabel(cwd: string): string {
  const normalized = cwd.replaceAll('\\', '/').replace(/\/$/u, '')
  const leaf = normalized.slice(normalized.lastIndexOf('/') + 1)
  return leaf || cwd
}

function sectionTitle(title: string, width: number, palette: Palette): string[] {
  return [
    padToWidth(palette.bold(` ${title}`), width),
    palette.dim('─'.repeat(width)),
  ]
}

function row(label: string, value: string, width: number, palette: Palette): string {
  const prefix = ` ${palette.dim(label.padEnd(8))}`
  return padToWidth(`${prefix}${value}`, width)
}

function contextValue(percent: number | undefined, palette: Palette): string {
  if (percent === undefined) return palette.dim('unknown')
  const clamped = Math.min(100, Math.max(0, percent))
  const filled = Math.round(clamped / 20)
  const level = contextPressureLevel(clamped)
  const paint = level === 'critical' ? palette.error : level === 'warning' ? palette.warning : palette.accent
  return `${paint('█'.repeat(filled))}${palette.dim('·'.repeat(5 - filled))} ${Math.round(clamped)}%`
}

/** Renders persistent project, session, and status sections in the right sidebar. */
export class WorkspaceSidebarComponent implements Component {
  private state: WorkspaceSidebarState = {
    cwd: '(unknown)',
    branch: undefined,
    status: 'idle',
    model: 'model unset',
    contextPercent: undefined,
    inputTokens: 0,
    outputTokens: 0,
    cacheHitRate: undefined,
    queued: 0,
    permission: undefined,
    plan: false,
  }

  constructor(
    private readonly palette: Palette,
    readonly sessionList: SessionListComponent,
    private readonly options: WorkspaceSidebarOptions,
  ) {}

  /** Replace the active workspace and agent values for the next render. */
  update(state: WorkspaceSidebarState): void {
    this.state = state
  }

  invalidate(): void {}

  render(width: number): string[] {
    if (width <= 0) return []
    const { state, palette } = this
    const cwd = displayText(state.cwd)
    const workspace = workspaceLabel(cwd)
    const statusGlyph = state.status === 'running'
      ? palette.accent('●')
      : palette.dim('○')
    const statusLabel = state.status === 'running' ? 'Running' : 'Idle'
    const tokenValue = `↑${formatTokens(state.inputTokens)} ↓${formatTokens(state.outputTokens)}`
    const cache = state.cacheHitRate === undefined ? palette.dim('unknown') : `${state.cacheHitRate}%`
    const permission = state.permission ?? palette.dim('unavailable')

    const workspaceLines = [
      ...sectionTitle('Workspace', width, palette),
      padToWidth(` ${palette.bold(palette.accent(workspace))}${state.branch === undefined ? '' : palette.dim(` · ${state.branch}`)}`, width),
      padToWidth(palette.dim(` ${cwd}`), width),
    ]
    const activity = this.options.activity.render(width)
    const currentLines = [
      ...sectionTitle('Current', width, palette),
      ...(activity.length > 0
        ? activity.map(line => padToWidth(` ${line}`, width))
        : [padToWidth(` ${statusGlyph} ${statusLabel}`, width)]),
    ]
    const statusLines = [
      ...sectionTitle('Status', width, palette),
      row('Model', state.model, width, palette),
      row('Context', contextValue(state.contextPercent, palette), width, palette),
      row('Tokens', tokenValue, width, palette),
      ...(state.cacheHitRate === undefined ? [] : [row('Cache', cache, width, palette)]),
      row('Queue', String(state.queued), width, palette),
      row('Perm', permission, width, palette),
      row('Plan', state.plan ? palette.accent('on') : palette.dim('off'), width, palette),
    ]
    const topLines = [
      ...workspaceLines,
      '',
      ...this.sessionList.render(width),
    ]
    const bottomLines = ['', ...currentLines, '', ...statusLines]
    const height = Math.max(1, Math.floor(this.options.terminalRows()))
    const filler = Math.max(0, height - topLines.length - bottomLines.length)
    const combined = [...topLines, ...Array.from({ length: filler }, () => ''), ...bottomLines]
    return combined.slice(Math.max(0, combined.length - height)).map(line => padToWidth(line, width))
  }
}
