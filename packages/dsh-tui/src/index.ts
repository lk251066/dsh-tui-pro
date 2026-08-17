/**
 * Interactive pi-tui front door for DeepSeek Harness agents. It renders the
 * durable session transcript, drives one configured agent, and provides
 * keyboard-driven user-interaction dialogs without owning agent lifecycle.
 * @module @deepseek-ai/dsh-tui
 */

import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import {
  CombinedAutocompleteProvider,
  Container,
  Key,
  Spacer,
  Text,
  TUI,
  ProcessTerminal,
  matchesKey,
  visibleWidth,
  type Component,
  type EditorTheme,
  type SlashCommand,
  type TerminalColorScheme,
} from '@earendil-works/pi-tui'
import { Service, type Context, type Fiber, type FiberState } from '@deepseek-ai/cordis'
import {
  assembleContextFor,
  installModelSelection,
  type Agent,
  type ModelSelectionRef,
  type AgentStatus,
} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-loop'
import type {} from '@deepseek-ai/dsh-token-meter'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import { createUserMessage, errorChain } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, MessageId } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-llm-retry'
import { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import {
  SessionId,
  type UserMessage,
} from '@deepseek-ai/dsh-session'
import { foldGoal } from '@deepseek-ai/dsh-goal'
import {
  parseSessionReferenceText,
} from '@deepseek-ai/dsh-session-reference'
import { foldSessionTitle } from '@deepseek-ai/dsh-session-title'
// Type import also declaration-merges the optional `sessionPersistence`
// service onto `Context` so `ctx.get('sessionPersistence')` is typed.
import type {} from '@deepseek-ai/dsh-session-persistence'
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-workspace'
import type { SkillRegistry } from '@deepseek-ai/dsh-skill'
// Merges the `permissionPresets` service and the `permission/preset` session
// event onto their ambient declarations; the service itself is optional at runtime.
import type {} from '@deepseek-ai/dsh-permission-presets'
// Type import declaration-merges the `userInteraction` service onto `Context`;
// the ask-user-question queue is registered by ./chat/questions.
import type {} from '@deepseek-ai/dsh-user-questions'
import {
  TuiExtensionServiceImpl,
  TuiOverlayManager,
} from './extension/overlay-manager.ts'

import {
  parseTuiPromptTemplate,
  renderTuiPromptTemplate,
  type TuiPromptValueHandle,
} from './prompt.ts'
import type {
  TuiOverlayRequest,
  TuiOverlaySession,
  TuiTheme,
} from './extension/types.ts'
import { displayInlineText, displayText } from './components/text.ts'
import { createCodeHighlighter } from './components/highlight.ts'
import { brandText, createPalette, markdownTheme, selectTheme } from './components/theme.ts'
import { THEME_PRESETS, THEME_PRESET_NAMES, type ThemePreset } from './components/theme-presets.ts'
import {
  cacheHitRate,
  formatTokens,
} from './chat/tokens.ts'
import {
  fadeGlyph,
  formatQueuedStatus,
  formatStatusDuration,
  pulseLevel,
  runningPhaseGlyph,
  TOOL_SPINNER_FRAMES,
  TOOL_SPINNER_INTERVAL_MS,
} from './chat/timing.ts'
import {
  resolveTuiConfig,
  type Config,
} from './config.ts'
import {
  type CondensedHeaderInfo,
  type ToolCardVisibility,
  HeaderComponent,
} from './components/transcript.ts'
import { FramedEditorComponent } from './components/framed-editor.ts'
import { WorkbenchShellComponent } from './components/workbench-shell.ts'
import { FullScreenTerminal, terminalMouseInput } from './full-screen-terminal.ts'
import { NoticeSlotComponent, type NoticeKind } from './components/notice-slot.ts'
import { WorkingLineComponent } from './components/working-line.ts'
import { contextPressureLevel } from './chat/context-pressure.ts'
import {
  compactTargetLabel,
  ConfirmDialog,
  contextMeter,
  DetailsDialog,
  diagnosticMeter,
  formatDiagnosticCount,
  formatDiagnosticNumber,
  formatDiagnosticTime,
  initialTarget,
  StatusCardComponent,
  PromptContextComponent,
  RenameDialog,
  SessionSwitchDialog,
  targetLabel,
  ThemeDialog,
  type DetailsSelection,
  type StatusCardRow,
} from './components/dialogs.ts'
import {
  parseSkillCommand,
  renderSkillInvocation,
  SKILL_COMMAND_PREFIX,
} from './chat/skill-invocation.ts'
import { ReferenceAutocompleteProvider } from './chat/autocomplete.ts'
import {
  formatCwd,
  gitBranch,
  HintEditor,
} from './chat/helpers.ts'
import { createSessionChannel, type SessionChannel } from './chat/session-channel.ts'
import {
  ASSISTANT_SESSION_ID,
  createAssistantController,
  setupAssistant,
} from './chat/assistant.ts'
import { createSessionLayout, type SessionLayoutController } from './chat/session-layout.ts'
import { createWorkspaceSessions } from './chat/workspace-sessions.ts'
import { TUI_WORKSPACE_STARTUP_KEY } from './workspace-agent-loop.ts'
import {
  createChannelRegistry,
  DEFAULT_MAX_LIVE_SLOTS,
  type ChannelRegistry,
  type SessionSlot,
} from './chat/channel-registry.ts'
import {
  createModelController,
  type ModelController,
} from './chat/model-command.ts'
import { createApprovalAnswerer, type ApprovalAnswerer } from './chat/approval.ts'
import { createGoalBar, type GoalBarController } from './chat/goal-bar.ts'
import { createPermissionController } from './chat/permission.ts'
import { createQuestionQueue } from './chat/questions.ts'
import { createQueueDock, replaceQueuedMessage, type QueueDockController } from './chat/queue-dock.ts'
import { forkSession } from './chat/fork.ts'
import {
  agentsLines,
  contextLines,
  jobsLines,
  openStaticDialog,
  settingsLines,
  statsStrip,
  writeExport,
  type InsightsDeps,
} from './chat/insights.ts'
import { foldPlanMode } from '@deepseek-ai/dsh-plan-mode'
import { createResumeController } from './chat/resume.ts'
import { createRewindController } from './chat/rewind.ts'
import type { TuiResumeHost, TuiRuntime } from './runtime.ts'
import { WorkspaceFileSearch } from './chat/file-autocomplete.ts'
import { copyText } from './clipboard.ts'

export { TuiPromptService } from './prompt.ts'
export { renderSkillInvocation } from './chat/skill-invocation.ts'
export type { TuiResumeHost, TuiRuntime } from './runtime.ts'
export {
  resolveTuiConfig,
  TuiConfigSchema,
  Config,
  type ResolvedTuiConfig,
  type ResolvedTuiThemeConfig,
  type TuiConfig,
  type TuiThemeConfig,
} from './config.ts'
export {
  DEFAULT_FILE_SEARCH_EXCLUDED_DIRECTORIES,
  DEFAULT_FILE_SEARCH_MAX_ENTRIES,
  DEFAULT_FILE_SEARCH_MAX_RESULTS,
} from './chat/file-autocomplete.ts'

export type {
  TuiComponent,
  TuiFocusable,
  TuiOverlayAnchor,
  TuiOverlayCloseReason,
  TuiOverlayHost,
  TuiOverlayMargin,
  TuiOverlayOptions,
  TuiOverlayOutcome,
  TuiOverlayRequest,
  TuiOverlaySession,
  TuiOverlayState,
  TuiTheme,
  TuiViewport,
} from './extension/types.ts'

/** First terminal Cordis state: FAILED, DISPOSED, and UNLOADING are unusable. */
const FIBER_FAILED = 3 as FiberState.FAILED
/** Short, bounded window for a sibling session-query plugin to finish mounting. */
const STOPPED_TITLE_RETRY_DELAY_MS = 50
const STOPPED_TITLE_RETRY_LIMIT = 20

/** Complete durable reference required by the attachment store. */
type ImageAttachmentRef = Extract<ContentBlock, { type: 'image' }>['attachment']

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Terminal-only interaction service, available only while a TUI is mounted. */
    tui: TuiExtensionService
    /** Optional process host that can replace this TUI with a resumed session. */
    tuiResumeHost: TuiResumeHost
    /** Launcher-owned `main` session identity; absent lets the app mint one. */
    mainSessionId: MainSessionIdentity | undefined
    /** Line the launcher wants printed on exit; absent prints nothing. */
    tuiGoodbyeMessage: string | undefined
    /** Skill the launcher wants auto-invoked as the fresh session's first turn; absent leaves it to the user. */
    tuiInitialSkill: string | undefined
  }
}

/** Launcher-chosen identity for the app's `main` session. */
export interface MainSessionIdentity {
  /** Exact session id `main` binds to. */
  readonly id: SessionId
  /**
   * Whether that session already has persisted history to load. `true` requires
   * an existing log and fails loud when absent; `false` creates it fresh.
   */
  readonly resume: boolean
}

/**
 * Context key a launcher sets before any Loader entry mounts
 * (`ctx.provide(MAIN_SESSION_ID_KEY, identity)`) to fix the `main` agent's
 * session identity, so an app bundle mounted from a `cordis.yml` binds a
 * launcher-selected session without a config key. `ctx.provide` is the only
 * channel from launcher argv into a Loader-mounted plugin, because config
 * `!!js` expressions evaluate against the entry's context. Absent leaves the
 * choice to the app.
 */
export const MAIN_SESSION_ID_KEY = 'mainSessionId'

/**
 * Context key a launcher sets before any Loader entry mounts
 * (`ctx.provide(TUI_GOODBYE_MESSAGE_KEY, line)`) to supply the line the TUI
 * prints once the terminal is released on exit — for the shipped CLI, the
 * command that resumes this session. The launcher owns the wording because only
 * it knows how it was invoked; the TUI escapes terminal controls before
 * rendering. Absent prints nothing.
 */
export const TUI_GOODBYE_MESSAGE_KEY = 'tuiGoodbyeMessage'

/**
 * Context key a launcher sets before any Loader entry mounts
 * (`ctx.provide(INITIAL_SKILL_KEY, name)`) to seed a fresh session's first user
 * turn with `/skill:<name>` — the `dsh migrate`/`dsh upgrade`
 * guided-session entry. The launcher sets it only when minting a fresh session,
 * so it never re-fires on a resumed one. Absent leaves the first turn to the user.
 */
export const INITIAL_SKILL_KEY = 'tuiInitialSkill'

/**
 * Optional terminal-local interaction service provided by one mounted TUI.
 *
 * The concrete provider retains pi-tui, focus, and terminal lifecycle state.
 * Plugins receive only effect-owned overlay sessions.
 */
export abstract class TuiExtensionService extends Service {
  /** Exact agent driven by this terminal instance. */
  abstract readonly agent: Agent

  /**
   * Queue an interactive overlay owned by the calling plugin fiber.
   *
   * The TUI displays one overlay at a time in FIFO order. Disposing the caller
   * removes a queued overlay or closes an active one before plugin teardown
   * settles. This live presentation is neither logged nor replayed.
   *
   * @param request - component factory, layout constraints, and cancellation.
   * @returns the effect-owned overlay session.
   * @throws when the TUI has begun shutting down.
   */
  abstract openOverlay(request: TuiOverlayRequest): TuiOverlaySession
}

export const name = 'ui-tui'
export const inject = ['agents', 'sessions', 'commands', 'userQuestions', 'tools', 'llm', 'systemPrompt', 'tokenMeter', 'tuiPrompt', 'workspaceRegistry', TUI_WORKSPACE_STARTUP_KEY]

/** Model guidance for path-only file references selected through the TUI. */
export const FILE_REFERENCE_PROMPT = 'Paths prefixed with @ are files explicitly referenced by the user. Use the read tool when their contents are needed; do not claim to have inspected a file before reading it.'

/**
 * This package's version, read from its own manifest for the condensed
 * header's `v{version}` segment. Read once through `createRequire` — the
 * plain-JSON require path ignores the package `exports` map, and any read
 * failure (a bundled build without the manifest beside it) simply drops the
 * segment rather than failing the UI.
 */
const TUI_VERSION: string = (() => {
  try {
    const require = createRequire(import.meta.url)
    const manifest = require('../package.json') as { version?: unknown }
    /* v8 ignore next -- a manifest without a string version drops the segment, same as a failed read. */
    return typeof manifest.version === 'string' ? manifest.version : ''
  } catch {
    /* v8 ignore next -- only a bundled build without the manifest beside it lands here. */
    return ''
  }
})()

/** Width/height adapter for a modal component rendered inside the base TUI flow. */
class InlineModalComponent extends Container {
  constructor(
    component: Component,
    private readonly width: number,
    private readonly maxHeight: number,
  ) {
    super()
    this.addChild(component)
  }

  override render(width: number): string[] {
    const lines = super.render(Math.max(1, Math.min(width, this.width)))
    return lines.slice(0, Math.max(1, this.maxHeight))
  }
}

/** Lifecycle handle for a mounted interactive terminal channel. */
export interface TuiController {
  /** Stop rendering, restore the terminal, and reject pending questions. */
  dispose(): Promise<void>
}

interface TuiConstructionState {
  failed: boolean
}

/**
 * One live session's full per-session state: the chat channel, the per-session
 * docks, the approval answerer that claims only this slot's agent, and the
 * agent-scoped listeners (model routing, the @-file prompt section). Built by
 * the slot factory, swapped under the shared chrome by the channel registry.
 */
export interface TuiSessionSlot extends SessionSlot {
  /** Model and reasoning selection owned only by this session. */
  readonly target: ModelSelectionRef
  /** Transcript channel: chat container, todo strip, session listeners. */
  readonly channel: SessionChannel
  /** The goal dock (Ctrl+G actions) for this session. */
  readonly goalBar: GoalBarController
  /** The steering queue dock (/queue sheet) for this session. */
  readonly queueDock: QueueDockController
  /** Ordinary editor submissions in their real submission order. */
  readonly submissions: Array<{ readonly text: string; readonly messageId: MessageId }>
  /** Answers `approval/request` for this slot's agent only. */
  readonly approvals: ApprovalAnswerer
  /** Disposer for this agent's model-selection waterfall listeners. */
  readonly disposeTargetListeners: () => void
  /** The @-file reference prompt section fiber on this agent's scope. */
  readonly fileReferenceFiber: Fiber
}

/**
 * Start the interactive pi-tui channel for an already-created target agent.
 * @param ctx - agent, tools, session-event, and user-interaction context.
 * @param config - target agent, banner, and TUI presentation config.
 * @param runtime - terminal and process-exit boundary.
 * @returns lifecycle controller used by the Cordis effect disposer.
 */
export function createTuiChat(
  ctx: Context,
  config: Config,
  runtime: TuiRuntime,
): TuiController {
  const construction: TuiConstructionState = { failed: false }
  try {
    return createTuiChatInternal(ctx, config, runtime, construction)
  } catch (error: unknown) {
    construction.failed = true
    throw error
  }
}

/** Build the TUI while the exported entry point owns construction rollback state. */
function createTuiChatInternal(
  ctx: Context,
  config: Config,
  runtime: TuiRuntime,
  construction: TuiConstructionState,
): TuiController {
  const sessionId = SessionId(config.sessionId ?? 'main')
  const initialAgent = ctx.agents.get(sessionId)
  if (initialAgent === undefined) throw new Error(`ui-tui: session "${sessionId}" is not running`)
  // The initial agent the TUI starts on; the channel registry reassigns this
  // (with the channel/dock lets below) every time the mounted session switches,
  // so chrome closures reading them per call always route to the session on
  // screen. Construction-time captures are the slot factory's own instances.
  let agent: Agent = initialAgent
  const resolved = resolveTuiConfig(config)
  // Named-theme state: `undefined` is the adaptive `deepseek` default.
  const initialPreset = resolved.theme.name === 'deepseek' ? undefined : THEME_PRESETS[resolved.theme.name]
  let currentPreset: ThemePreset | undefined = initialPreset
  let currentThemeName = initialPreset === undefined ? 'deepseek' : resolved.theme.name
  const paletteOptions = (): { preset?: ThemePreset; truecolor?: boolean } => currentPreset === undefined
    ? {}
    : { preset: currentPreset, truecolor: resolved.theme.truecolor }
  const palette = createPalette(resolved.theme.color, 'dark', paletteOptions())
  // The highlighter reads the live palette per call; once the lazily-loaded
  // module lands, blocks that rendered plain get a transcript rebuild.
  const codeHighlighter = createCodeHighlighter(palette, resolved.theme.color, () => {
    if (!disposed) rebuildTranscript(false)
  })
  const mdTheme = markdownTheme(palette, codeHighlighter.highlightCode)
  codeHighlighter.preload()
  const workbenchRows = (): number => Math.max(0, runtime.terminal.rows - 2)
  const ui = new TUI(new FullScreenTerminal(runtime.terminal), resolved.showHardwareCursor)
  const todoContainer = new Container()
  const mainOverlayContainer = new Container()
  const questionContainer = new Container()
  const mainHeader = new Container()
  const auxiliary = new Container()
  const inputArea = new Container()
  const inputTemplate = parseTuiPromptTemplate(displayInlineText(resolved.theme.inputPrompt))
  /**
   * Read one prompt value for a render. A render that races the final teardown
   * (the TUI's debounced render timer firing while the owning context goes
   * away) must not crash the process: the service read degrades to an unset
   * fragment and the stale frame renders without it.
   */
  const safePromptValue = (valueName: string): string | undefined => {
    try {
      return ctx.tuiPrompt.get(valueName)
    } catch {
      return undefined
    }
  }
  const renderInputPrompt = (): string => renderTuiPromptTemplate(inputTemplate, safePromptValue)
  const initialInputPrompt = renderInputPrompt()
  const editor = new HintEditor(ui, {
    borderColor: palette.dim,
    selectList: selectTheme(palette),
  } satisfies EditorTheme, {
    paddingX: 1,
    frame: 'none',
    prompt: {
      first: initialInputPrompt,
      continuation: ' '.repeat(visibleWidth(initialInputPrompt)),
    },
  })
  editor.hintPrefix = initialInputPrompt
  const compactionStatusLine = new Text('', 0, 0)
  let showReasoning = resolved.showReasoning
  // Ctrl+O cycles collapsed -> expanded -> hidden. Codex-style: hidden drops
  // tool cards entirely, collapsed previews, expanded shows full bodies.
  let toolsVisibility: ToolCardVisibility = 'collapsed'
  let disposed = false
  let shuttingDown: Promise<void> | undefined
  // Optional: skills mount conditionally, so read the global service store
  // rather than declaring an injection that would make the TUI require them.
  const skills = ctx.get('skills')
  const initialCwd = agent.session.header.cwd ?? process.cwd()
  const activeCwd = (): string => agent.session.header.cwd ?? initialCwd
  const fileSearchConfig = {
    maxResults: resolved.fileSearchMaxResults,
    maxEntries: resolved.fileSearchMaxEntries,
    excludedDirectories: resolved.fileSearchExcludedDirectories,
  }
  let fileSearch = new WorkspaceFileSearch(initialCwd, fileSearchConfig)
  const skillAbort = new AbortController()
  const liveErrors = new Set<string>()
  const commandControllers = new Set<AbortController>()
  const referenceControllers = new Set<AbortController>()
  let tuiServiceFiber: Fiber | undefined
  const initialTargetRef: ModelSelectionRef = { current: initialTarget(agent), assembled: undefined }
  let activeTargetRef = initialTargetRef
  const target: ModelSelectionRef = {
    get current() { return activeTargetRef.current },
    set current(value) { activeTargetRef.current = value },
    get assembled() { return activeTargetRef.assembled },
    set assembled(value) { activeTargetRef.assembled = value },
  }
  // `updatePromptValues` (defined below) closes over the model controller, but
  // the controller needs `appendNotice`/`overlayManager`, defined after that
  // closure. Declare here, assign once after those exist, and defer the first
  // `updatePromptValues()` call until after the assignment so no read precedes it.
  // oxlint-disable-next-line prefer-const -- single assignment is a forward-reference, not a const.
  let modelController!: ModelController
  // The mounted slot's pieces, assigned by the registry's initial mount and
  // reassigned on every switch. Chrome closures below read them per call, so
  // message dispatch, commands, status, and prompts follow the mounted session.
  let channel!: SessionChannel
  let goalBar!: GoalBarController
  let queueDock!: QueueDockController
  let sessionLayout: SessionLayoutController | undefined
  let workbench: WorkbenchShellComponent | undefined
  const now = (): number => runtime.now?.() ?? Date.now()
  const agentStatus = (): AgentStatus => agent.status
  const isDisposed = (): boolean =>
    disposed || construction.failed || ctx.fiber.state >= FIBER_FAILED

  let sessionTitle = foldSessionTitle(agent.session.events)?.title
  let formattedCwd = displayText(runtime.formatCwd?.(agent.session.header.cwd) ?? formatCwd(agent.session.header.cwd))
  /** Compact workbench identity read per render for session and model changes. */
  const condensedHeaderInfo = (): CondensedHeaderInfo => ({
    version: TUI_VERSION,
    model: target.current === undefined ? '' : compactTargetLabel(target.current),
    cwd: formattedCwd,
    title: sessionTitle ?? (agent.session.events.some(event => event.type === 'user/message')
      ? undefined
      : config.welcome),
  })
  const header = new HeaderComponent(
    () => sessionTitle ?? config.welcome,
    palette,
    resolved.theme.color && resolved.theme.truecolor,
    condensedHeaderInfo,
  )
  let branch = runtime.gitBranch?.(initialCwd) ?? gitBranch(initialCwd)
  const promptValues: TuiPromptValueHandle[] = [
    ctx.tuiPrompt.register('cwd', palette.bold(palette.accent(formattedCwd))),
    ctx.tuiPrompt.register('git/worktree', branch === undefined ? undefined : palette.dim(` (${displayText(branch)})`)),
    ctx.tuiPrompt.register('token_meter/cache_hit_rate'),
    ctx.tuiPrompt.register('model'),
    ctx.tuiPrompt.register('context'),
    ctx.tuiPrompt.register('queued'),
    ctx.tuiPrompt.register('symbol', palette.bold(palette.accent('dsh'))),
    ctx.tuiPrompt.register('indicator', palette.dim('> ')),
    ctx.tuiPrompt.register('permission'),
    ctx.tuiPrompt.register('plan'),
    ctx.tuiPrompt.register('stats'),
  ]
  const [
    cwdValue, gitValue, tokenValue, modelValue, contextValue, queuedValue,
    symbolValue, indicatorValue, permissionValue, planValue, statsValue,
  ] = promptValues
  /* v8 ignore next -- the fixed built-in registration list always supplies each handle. */
  if (cwdValue === undefined || gitValue === undefined || tokenValue === undefined || modelValue === undefined
    || contextValue === undefined || queuedValue === undefined || symbolValue === undefined || indicatorValue === undefined
    || permissionValue === undefined || planValue === undefined || statsValue === undefined) {
    throw new Error('TUI prompt built-ins failed to initialize')
  }
  /**
   * The context-pressure projection when the projection registry is mounted
   * (the base bundle always mounts it): projected next-request tokens over the
   * route's context window. Absent, callers fall back to the token-meter
   * measure the footer already uses.
   */
  const contextPressure = (): { projectedTokens?: number; pressureTokens?: number; contextWindow?: number } | undefined => {
    const projections = ctx.get('sessionProjections')
    if (projections === undefined) return undefined
    try {
      const snapshot = (projections as {
        snapshot?: (session: unknown) => { values?: Record<string, unknown> } | undefined
      }).snapshot?.(agent.session)
      const pressure = snapshot?.values?.contextPressure
      return pressure === undefined ? undefined : pressure as NonNullable<ReturnType<typeof contextPressure>>
    } catch {
      // An unavailable projection never breaks the prompt footer.
      return undefined
    }
  }

  const updatePromptValues = (): void => {
    const renderTime = now()
    sessionLayout?.refresh()
    const tokens = channel.tokens()
    cwdValue.set(palette.bold(palette.accent(formattedCwd)))
    gitValue.set(branch === undefined ? undefined : palette.dim(` (${displayText(branch)})`))
    const rate = cacheHitRate(tokens)
    const usage = `↑${formatTokens(tokens.input)} ↓${formatTokens(tokens.output)}`
    modelValue.set(`  ${palette.dim(displayText(target.current === undefined ? 'model unset' : compactTargetLabel(target.current)))}`)
    tokenValue.set(`  ${palette.dim(rate === undefined ? usage : `${usage}  cache ${rate}%`)}`)
    const pressure = contextPressure()
    const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens
      ?? ctx.tokenMeter.measure(agent.session).totalTokens
    const effectiveWindow = pressure?.contextWindow ?? modelController.contextWindow()
    const occupancy = effectiveWindow === undefined || effectiveWindow <= 0
      ? undefined
      : Math.min(100, usedTokens / effectiveWindow * 100)
    if (occupancy === undefined) {
      contextValue.set(undefined)
    } else {
      // The meter segments and the percent number share the pressure color
      // (dim → warning → error); the surrounding text stays dim. Colored
      // pieces are concatenated rather than nested (single-Colored rule).
      const level = contextPressureLevel(occupancy)
      const percentText = `${Math.round(occupancy)}%`
      const percent = level === 'critical'
        ? palette.error(percentText)
        : level === 'warning'
          ? palette.warning(percentText)
          : palette.dim(percentText)
      contextValue.set(`  ${contextMeter(occupancy, palette)} ${percent}${palette.dim(' context')}`)
    }
    const queued = channel.isRunning() ? formatQueuedStatus(channel.pendingSteeringCount()) : undefined
    queuedValue.set(queued === undefined ? undefined : palette.dim(queued))
    // Shift+Tab's preset ring and the plan-mode chip; absent services render nothing.
    const preset = permissionController.chip()
    permissionValue.set(preset === undefined || preset === 'custom' ? undefined : palette.dim(` [${preset}]`))
    const planActive = foldPlanMode(agent.session.events)
    planValue.set(planActive
      ? palette.bold(palette.accent(' ⎇ plan'))
      : undefined)
    const stats = statsStrip(insights)
    statsValue.set(stats === undefined ? undefined : palette.dim(`  ${stats}`))
    sessionLayout?.updateStatus({
      cwd: displayText(activeCwd()),
      branch: branch === undefined ? undefined : displayText(branch),
      status: agent.status,
      model: displayText(target.current === undefined ? 'model unset' : compactTargetLabel(target.current)),
      contextPercent: occupancy,
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      cacheHitRate: rate,
      // The channel tracks newly submitted steering until the inbox projection
      // catches up. Both counts can describe the same messages, so never sum.
      queued: Math.max(queueDock.pendingCount(), channel.pendingSteeringCount()),
      permission: preset,
      plan: planActive,
    })
    symbolValue.set(palette.bold(palette.accent('dsh')))
    compactionStatusLine.setText(channel.isCompacting()
      ? palette.dim(`Context being compacted ${formatStatusDuration(renderTime - (channel.compactingStartedAt() ?? renderTime))}`)
      : occupancy !== undefined && contextPressureLevel(occupancy) === 'critical'
        ? palette.error(`Context low · ${Math.round(occupancy)}% used · run /compact to free space`)
        : '')
    // `${indicator}` owns the caret column and its trailing gap before the
    // cursor. The active status glyph replaces the `>` caret in place — same
    // width every frame — fading in when work starts, throbbing while it runs,
    // and fading out after it ends before the plain `>` returns. Only the gray
    // brightness changes, so the cursor never shifts.
    const statusGlyph = runningPhaseGlyph(
      agent.session.events,
      channel.isRunning(),
      channel.isCompacting(),
    )
    channel.noteRenderedStatusGlyph(statusGlyph)
    // The fade envelope gates appear/disappear; the active throb breathes the
    // glyph throughout the operation. Truecolor opacity is envelope × throb; the
    // non-truecolor fallback keys visibility off the envelope alone, so the
    // throb never blinks it. `envelope` clamps to [0, 1].
    const envelope = channel.statusGlyphEnvelope(statusGlyph, renderTime)
    const caret = envelope === undefined
      ? palette.dim('>')
      : fadeGlyph(
        envelope.glyph,
        palette,
        resolved.theme.color,
        resolved.theme.color && resolved.theme.truecolor,
        envelope.level * pulseLevel(renderTime),
        envelope.level >= 0.5,
      )
    indicatorValue.set(`${caret}${palette.dim(' ')}`)
  }
  const promptContext = new PromptContextComponent(
    parseTuiPromptTemplate(displayInlineText(resolved.theme.leftPrompt)),
    parseTuiPromptTemplate(displayInlineText(resolved.theme.rightPrompt)),
    valueName => safePromptValue(valueName),
  )
  mainHeader.addChild(header)
  mainHeader.addChild(new Spacer(1))
  auxiliary.addChild(todoContainer)
  // Docks (goal bar, steering queue) mount into this slot in order once their
  // controllers exist; an empty container renders nothing.
  const docks = new Container()
  auxiliary.addChild(docks)
  auxiliary.addChild(compactionStatusLine)
  // The right sidebar owns live working status; the main input area stays quiet.
  const workingLine = new WorkingLineComponent(palette, now)
  const editorFrame = new FramedEditorComponent(editor)
  inputArea.addChild(workingLine)
  inputArea.addChild(editorFrame)
  inputArea.addChild(promptContext)
  ui.setFocus(editor)
  const updateTerminalTitle = (): void => {
    runtime.terminal.setTitle(displayText(
      sessionTitle === undefined ? resolved.title : `${sessionTitle} — ${resolved.title}`,
    ))
  }
  updateTerminalTitle()

  const requestRender = (): void => {
    if (isDisposed()) return
    updatePromptValues()
    const inputPrompt = renderInputPrompt()
    editor.setPrompt({ first: inputPrompt, continuation: ' '.repeat(visibleWidth(inputPrompt)) })
    editor.hintPrefix = inputPrompt
    promptContext.invalidate()
    ui.requestRender()
  }
  // A prompt value that changes on its own schedule (e.g. a plugin-owned
  // `${custom}` fragment) redraws through the registry's coalesced notification;
  // built-ins are already covered by the state-change callers of requestRender.
  const disposePromptChanges = ctx.tuiPrompt.subscribe(requestRender)

  const appendNotice = (message: string, kind: 'info' | 'warning' | 'error' = 'info'): void => {
    const color = kind === 'error' ? palette.error : kind === 'warning' ? palette.warning : palette.dim
    // The mounted channel's transcript: a notice about any session (including
    // a backgrounded one) lands where the user is looking.
    channel.chat.addChild(new Spacer(1))
    channel.chat.addChild(new Text(color(displayText(message)), 0, 0))
    requestRender()
  }

  // Claude Code's Notifications slot: one transient row at the very bottom for
  // lightweight operation receipts (state-switch feedback) that must not
  // pollute the durable transcript. Errors, warnings, and anything the user
  // may need to scroll back to keep going through appendNotice.
  const noticeSlot = new NoticeSlotComponent(palette, requestRender)
  inputArea.addChild(noticeSlot)
  const showTransientNotice = (message: string, kind: NoticeKind = 'info'): void => {
    noticeSlot.show(message, kind)
  }

  const extensionTheme: TuiTheme = Object.freeze({
    text: (value: string) => palette.text(value),
    brand: (value: string) => resolved.theme.color
      ? resolved.theme.truecolor ? brandText(value) : palette.brand(value)
      : value,
    dim: (value: string) => palette.dim(value),
    accent: (value: string) => palette.accent(value),
    success: (value: string) => palette.success(value),
    warning: (value: string) => palette.warning(value),
    error: (value: string) => palette.error(value),
    bold: (value: string) => palette.bold(value),
  })
  const overlayManager = new TuiOverlayManager({
    viewport: () => Object.freeze({
      columns: runtime.terminal.columns,
      rows: runtime.terminal.rows,
    }),
    theme: () => extensionTheme,
    display: displayText,
    show: (component, options, placement) => {
      if (placement === 'overlay') {
        return ui.showOverlay(component, options === undefined
          ? undefined
          : {
            ...options,
            ...typeof options.margin === 'object'
              ? { margin: { ...options.margin } }
              : {},
          })
      }
      if (placement === 'main') {
        mainOverlayContainer.clear()
        mainOverlayContainer.addChild(component)
        ui.setFocus(component)
        return {
          hide(): void {
            mainOverlayContainer.clear()
            ui.setFocus(editor)
          },
        }
      }
      const modal = new InlineModalComponent(
        component,
        resolved.questionDialogWidth,
        resolved.questionDialogMaxHeight,
      )
      questionContainer.clear()
      questionContainer.addChild(modal)
      ui.setFocus(component)
      return {
        hide(): void {
          questionContainer.clear()
          ui.setFocus(editor)
        },
      }
    },
    invalidate: requestRender,
    reportError: (error) => {
      const message = errorChain(error)
      ctx.logger.warn(`ui-tui: overlay failed: ${message}`)
      /* v8 ignore next -- shutdown removes overlays before the terminal stops */
      if (disposed) return
      appendNotice(`TUI overlay failed: ${message}`, 'error')
    },
  })

  modelController = createModelController({
    ctx,
    resolved,
    palette,
    overlayManager,
    target,
    appendNotice,
    requestRender,
    isDisposed,
    showTransientNotice,
  })

  // Shift+Tab preset ring with the danger-preset risk confirmation overlay.
  const permissionController = createPermissionController({
    ctx, resolved, palette, overlayManager, requestRender, isDisposed, appendNotice,
    get agent(): Agent { return agent },
    confirmRisk: (message, onChoice) => {
      const session = overlayManager.open({
        create: () => new ConfirmDialog(
          'Full access',
          message,
          palette,
          onChoice,
          () => { void session.close() },
        ),
        options: { width: 64, maxHeight: 12 },
      }, 'inline')
      requestRender()
    },
  })

  // Insight surfaces (/context, /agents, /jobs, /settings, /export, stats
  // strip). `agent` is a getter: every insight handler re-reads the mounted
  // session at call time, so the surfaces follow a /sessions switch.
  const insights: InsightsDeps = {
    ctx, resolved, palette, overlayManager, requestRender, isDisposed, appendNotice,
    get agent(): Agent { return agent },
  }

  /** Resolve one stored image attachment's bytes through the optional store. */
  const loadAttachmentImage = (ref: ImageAttachmentRef): Promise<Uint8Array | undefined> => {
    const attachments = ctx.get('attachments') as {
      readImage?: (ref: ImageAttachmentRef, signal?: AbortSignal) => Promise<{ data: Uint8Array }>
    } | undefined
    if (attachments?.readImage === undefined) return Promise.resolve(undefined)
    return attachments.readImage(ref).then(
      stored => stored.data,
      () => undefined,
    )
  }

  /**
   * The @-file prompt-section fibers by agent context: one registration per
   * distinct context, so agents sharing a context (embedders, fakes) do not
   * collide on the section's global name.
   */
  const fileReferenceFibers = new Map<Context, Fiber>()

  /**
   * Register the @-file reference prompt section on one agent's scope, or
   * return the existing fiber when that context already carries one.
   */
  const registerFileReferenceSection = (slotAgent: Agent): Fiber => {
    const existing = fileReferenceFibers.get(slotAgent.ctx)
    if (existing !== undefined) return existing
    const fiber = slotAgent.ctx.inject(['systemPrompt'], (promptCtx) => {
      promptCtx.systemPrompt.section({
        name: 'ui:tui-file-reference',
        order: 99,
        // Tool visibility can change dynamically or by agent scope. Empty
        // sections are omitted by renderPrompt, so guidance never names a
        // tool that this agent cannot call.
        text: () => slotAgent.ctx.tools.get('read', slotAgent) === undefined ? '' : FILE_REFERENCE_PROMPT,
      })
    })
    fileReferenceFibers.set(slotAgent.ctx, fiber)
    return fiber
  }

  /**
   * Build one live session's full slot: its chat channel (transcript, cards,
   * status state machine), its per-session docks, the approval answerer that
   * claims only this agent's asks, this agent's model-selection routing, and
   * its @-file prompt section. Called by the registry for the initial session
   * and for every `/new` adoption; the returned pieces are swapped under the
   * shared chrome by {@link mountSlot}/{@link unmountSlot}.
   */
  const buildSlot = (slotAgent: Agent): TuiSessionSlot => {
    // The registry is assigned by the createChannelRegistry call below; these
    // closures only run on session events, which cannot fire before it exists.
    const isActiveAgent = (): boolean =>
      /* v8 ignore next -- the registry exists before any session event fires. */
      registry === undefined || registry.active().agent === slotAgent
    const slotGoalBar = createGoalBar({ ctx, resolved, palette, overlayManager, requestRender, isDisposed, appendNotice, agent: slotAgent })
    const slotQueueDock = createQueueDock({
      ctx, resolved, palette, overlayManager, requestRender, isDisposed, appendNotice, agent: slotAgent,
      loadIntoEditor: (text) => {
        editor.setText(text)
        requestRender()
      },
      showTransientNotice,
    })
    // The per-session chat channel: transcript container, streaming/tool/
    // context cards, turn status, token totals, and the session-scoped
    // listeners. Every chrome callback it reads (docks, notices, spinner
    // working line) either belongs to this slot or gates on the slot being
    // mounted, so a backgrounded session never repaints the foreground chrome.
    const slotChannel: SessionChannel = createSessionChannel({
      ctx,
      agent: slotAgent,
      resolved,
      palette,
      mdTheme,
      now,
      terminal: runtime.terminal,
      requestRender,
      appendNotice,
      loadAttachmentImage,
      addToEditorHistory: (text) => {
        editor.addToHistory(text)
      },
      refreshGoalBar: () => {
        slotGoalBar.refresh()
      },
      refreshQueueDock: () => {
        slotQueueDock.refresh()
        if (isActiveAgent()) applyEditorHint()
      },
      onSessionTitle: (title) => {
        if (!isActiveAgent()) return
        sessionTitle = title
        header.invalidate()
        updateTerminalTitle()
      },
      onToolResult: () => {
        fileSearch.invalidate()
      },
      applyStatus: (status) => {
        if (isActiveAgent()) setStatus(status)
      },
      showReasoning: () => showReasoning,
      toolsVisibility: () => toolsVisibility,
      onSpinnerFrame: (running, startedAt, label, frame, extras) => {
        if (!isActiveAgent()) return
        workingLine.update(running, startedAt, label, frame, extras)
        requestRender()
      },
      onSpinnerIdle: () => {
        if (!isActiveAgent()) return
        workingLine.update(false, undefined, undefined, undefined)
        requestRender()
      },
      onAgentError: (stepKey, error) => {
        liveErrors.add(stepKey)
        // Full cause chain: wrapper messages like `fetch failed` carry the
        // actionable transport detail on `cause`.
        appendNotice(errorChain(error), 'error')
      },
      onAgentDisposed: () => {
        appendNotice(`Agent "${slotAgent.id}" was disposed.`, 'warning')
        // Only the mounted session's disposal ends the TUI; a backgrounded
        // slot losing its agent is a notice, not a shutdown.
        if (isActiveAgent()) disposed = true
      },
    })
    const slotTarget = slotAgent === initialAgent
      ? initialTargetRef
      : { current: initialTarget(slotAgent), assembled: undefined }
    return {
      sessionId: slotAgent.session.id,
      agent: slotAgent,
      target: slotTarget,
      channel: slotChannel,
      goalBar: slotGoalBar,
      queueDock: slotQueueDock,
      submissions: [],
      approvals: createApprovalAnswerer({
        ctx,
        resolved,
        palette,
        overlayManager,
        requestRender,
        isDisposed,
        appendNotice,
        agent: slotAgent,
        questionMaxHeight: () => {
          return Math.max(1, Math.min(
            resolved.questionDialogMaxHeight,
            workbenchRows(),
          ))
        },
        pendingCallLabel: callId => slotChannel.toolCardLabel(callId),
      }),
      disposeTargetListeners: installModelSelection(slotAgent.ctx, slotTarget),
      // The @-file reference section registers on the agent's own scope (the
      // per-agent override the systemPrompt registry names in its collision
      // error). Agents sharing one context (embedders, fakes) share the first
      // registration — the section's text() is agent-scoped either way.
      fileReferenceFiber: registerFileReferenceSection(slotAgent),
    }
  }

  // The registry mounts its initial slot before returning. That first mount
  // uses the chat directly; once the registry exists, startup replaces it
  // synchronously with the persistent workbench before the terminal starts.
  /** Wire one slot's components into the shared chrome and start its listeners. */
  const mountSlot = (slot: TuiSessionSlot): void => {
    // Publish the mounted slot before attach: listener callbacks and repaint
    // requests must always observe the channel that owns the mounted UI.
    agent = slot.agent
    activeTargetRef = slot.target
    channel = slot.channel
    goalBar = slot.goalBar
    queueDock = slot.queueDock
    workbench?.setTranscript(slot.channel.chat)
    todoContainer.addChild(slot.channel.todo)
    docks.addChild(slot.goalBar.component)
    docks.addChild(slot.queueDock.component)
    slot.channel.attach()
  }

  /** Unwire one slot's components and stop its session listeners (switch-away). */
  const unmountSlot = (slot: TuiSessionSlot): void => {
    slot.channel.detach()
    todoContainer.clear()
    docks.clear()
  }

  /** Final teardown for one slot (eviction or shutdown): scoped listeners and overlays. */
  const disposeSlot = (slot: TuiSessionSlot): void => {
    slot.approvals.drain()
    slot.approvals.unregister()
    slot.goalBar.dispose()
    slot.queueDock.dispose()
    slot.disposeTargetListeners()
    for (const [context, registered] of fileReferenceFibers) {
      if (registered === slot.fileReferenceFiber) fileReferenceFibers.delete(context)
    }
    // A shared registration (agents on one context) reaches this disposal
    // through each sharing slot; an already-disposed fiber returns nothing or
    // throws, and either way the section is gone.
    try {
      void Promise.resolve(slot.fileReferenceFiber.dispose()).catch(() => {})
    } catch {
      /* already disposed through a sharing sibling slot */
    }
  }

  // The multi-session registry: one slot per live in-process session, swapped
  // under this shared chrome. Sessions live with the process by design —
  // `/sessions` owns live switching and persisted history in one surface.
  const registry: ChannelRegistry<TuiSessionSlot> = createChannelRegistry<TuiSessionSlot>({
    buildSlot,
    mount: mountSlot,
    unmount: unmountSlot,
    dispose: disposeSlot,
    onActiveChange(previous, next) {
      agent = next.agent
      channel = next.channel
      goalBar = next.goalBar
      queueDock = next.queueDock
      // The startup path (rebuild, prompt values, initial setStatus) already
      // covers the first activation; switches refresh the chrome here.
      if (previous === undefined) return
      // The switched-in channel was detached while backgrounded: re-derive
      // its transcript from the log so events it missed render now.
      next.channel.rebuildTranscript(false)
      void ctx.sessions.flush(previous.agent.session).catch(() => {})
      const nextCwd = next.agent.session.header.cwd ?? initialCwd
      fileSearch.dispose()
      fileSearch = new WorkspaceFileSearch(nextCwd, fileSearchConfig)
      formattedCwd = displayText(runtime.formatCwd?.(nextCwd) ?? formatCwd(nextCwd))
      branch = runtime.gitBranch?.(nextCwd) ?? gitBranch(nextCwd)
      sessionTitle = foldSessionTitle(next.agent.session.events)?.title
      modelController.activateSelection()
      header.invalidate()
      updateTerminalTitle()
      setStatus(next.agent.status)
      refreshCommandAutocomplete()
      if (skills !== undefined) refreshSkillCommands(skills)
      updatePromptValues()
      next.goalBar.refresh()
      refreshQueueDock()
      sessionLayout?.refresh()
      requestRender()
    },
    maxLiveSlots: DEFAULT_MAX_LIVE_SLOTS,
    onEvictionSkipped: (liveCount) => {
      appendNotice(`Live-session ceiling reached (${liveCount}); every background session is busy, keeping them all.`, 'warning')
    },
  }, agent)

  // A queued session reference must not inject its context into the currently
  // running turn. Hold it by prompt identity and inject it synchronously after
  // that turn closes, before the next queued turn claims its first step.
  const queuedReferenceContexts = new Map<MessageId, { readonly agent: Agent; readonly context: UserMessage }>()

  const workspaceSessions = createWorkspaceSessions(ctx)

  if (agent.session.id === ASSISTANT_SESSION_ID) setupAssistant(agent.ctx, registry, workspaceSessions)

  /**
   * Start a fresh in-process session (`/new`) and switch to it. The
   * created agent runs the same loop and routing as the initial one; its slot
   * mounts under the shared chrome immediately.
   */
  const newSession = (rawPath = ''): void => {
    const freshId = SessionId(`session-${randomUUID()}`)
    const requested = rawPath.trim()
    const projectCwd = resolve(activeCwd(), requested === '' ? '.' : requested)
    const create = async (): Promise<void> => {
      if (disposed) return
      const handle = await ctx.agents.create({ sessionId: freshId, seed: [], meta: { cwd: projectCwd } })
      if (disposed) return
      await workspaceSessions.add(handle.agent.session.id)
      if (disposed) return
      registry.adopt(handle.agent)
      showTransientNotice(`New session ${displayText(String(freshId))} in ${displayText(projectCwd)}.`)
    }
    const operation = requested === ''
      ? create()
      : stat(projectCwd).then(async (status) => {
          if (!status.isDirectory()) throw new Error(`not a directory: ${projectCwd}`)
          await create()
        })
    void operation.catch((error: unknown) => {
      if (!disposed) appendNotice(`New session failed: ${errorChain(error)}`, 'error')
    })
  }

  // The personal assistant (`/assistant`): a fixed-id session with workspace
  // management tools, resumed across processes when its log exists.
  const assistant = createAssistantController({
    ctx,
    registry,
    workspaceSessions,
    cwd: initialCwd,
    appendNotice,
    showTransientNotice,
    isDisposed,
  })

  // Every live session shares one workbench and swaps only its transcript.
  const persistentLayout = createSessionLayout({
    palette,
    registry,
    workspaceSessions,
    terminalRows: workbenchRows,
    now,
  })
  sessionLayout = persistentLayout
  workbench = new WorkbenchShellComponent(palette, {
    terminalRows: () => runtime.terminal.rows,
    preferredSidebarWidth: resolved.sidebarWidth,
    header: mainHeader,
    auxiliary,
    main: mainOverlayContainer,
    dialog: questionContainer,
    input: inputArea,
    sidebar: persistentLayout.sidebar,
    sidebarSessionAt: (row, width) => persistentLayout.sidebar.sessionAtRow(row, width),
    transcript: registry.active().channel.chat,
  })
  ui.addChild(workbench)
  persistentLayout.refresh()
  let stoppedTitleScan = 0
  let stoppedTitleAbort: AbortController | undefined
  let stoppedTitleRetry: ReturnType<typeof setTimeout> | undefined
  let stoppedTitleRetryCount = 0
  const refreshStoppedTitles = (): void => {
    const query = currentSessionQuery()
    if (query === undefined) {
      if (
        stoppedTitleRetry === undefined
        && stoppedTitleRetryCount < STOPPED_TITLE_RETRY_LIMIT
        && !isDisposed()
      ) {
        stoppedTitleRetryCount += 1
        stoppedTitleRetry = setTimeout(() => {
          stoppedTitleRetry = undefined
          refreshStoppedTitles()
        }, STOPPED_TITLE_RETRY_DELAY_MS)
      }
      return
    }
    stoppedTitleRetryCount = 0
    const ids = workspaceSessions.list().map(item => item.sessionId).filter((sessionId, index, all) =>
      registry.get(sessionId) === undefined && all.indexOf(sessionId) === index)
    if (ids.length === 0 || typeof query.readTitleSnapshots !== 'function') return
    const scan = ++stoppedTitleScan
    stoppedTitleAbort?.abort()
    const controller = new AbortController()
    stoppedTitleAbort = controller
    void query.readTitleSnapshots(ids, controller.signal).then((results) => {
      if (isDisposed() || controller.signal.aborted || scan !== stoppedTitleScan) return
      const titles = new Map<SessionId, string>()
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.title !== undefined) {
          titles.set(result.sessionId, result.value.title.title)
        }
      }
      persistentLayout.setPersistedTitles(titles)
      requestRender()
    }, () => {})
  }
  // Mounted channels already request renders for their own events. Background
  // channels are detached, so wake the shared chrome when one of their rows
  // changes; updatePromptValues() then rebuilds the full live-session list.
  const disposeBackgroundSessionEvents = ctx.on('session/event', (sourceSession) => {
    const slot = registry.slots().find(candidate => candidate.agent.session === sourceSession)
    if (slot !== undefined && !registry.isActive(slot)) requestRender()
  })
  const disposeQueuedReferenceTurns = ctx.on('session/event', (sourceSession, event) => {
    if (event.type !== 'turn/end') return
    const slot = registry.slots().find(candidate => candidate.agent.session === sourceSession)
    const next = slot?.agent.inbox.nextTurn[0]
    if (slot === undefined || next === undefined) return
    const pending = queuedReferenceContexts.get(next.id)
    if (pending === undefined || pending.agent !== slot.agent) return
    queuedReferenceContexts.delete(next.id)
    slot.agent.inject(pending.context)
  })
  const disposeQueuedReferenceDiscards = ctx.on('agent/inbox/discarded', ({ message }) => {
    queuedReferenceContexts.delete(message.id)
  })
  const disposeBackgroundStatusChanges = ctx.on('agent/status', ({ agent: source }) => {
    const slot = registry.slots().find(candidate => candidate.agent === source)
    if (slot !== undefined && !registry.isActive(slot)) requestRender()
  })
  const disposeWorkspaceChanges = ctx.on('domain/changed', (change) => {
    if (change.domain === 'workspace') {
      stoppedTitleRetryCount = 0
      refreshStoppedTitles()
      requestRender()
    }
  })

  updatePromptValues()
  refreshStoppedTitles()

  /** Status-priority placeholder text for the empty editor (dim; the hint editor paints it). */
  const editorHintFor = (status: AgentStatus): string => {
    if (status === 'running') return palette.dim(displayInlineText(resolved.theme.inputPlaceholder))
    if (foldPlanMode(agent.session.events)) {
      return palette.dim('plan mode — present a plan; the review runs before any edit')
    }
    // Queued messages are more actionable than examples: ↑ pops the newest
    // one back into the editor (see the input listener's Key.up branch).
    if (queueDock.pendingCount() > 0) return palette.dim('press ↑ to edit queued messages')
    return palette.dim('type / for commands, @ for files')
  }

  /**
   * Re-derive the editor placeholder from the live status, plan mode, and
   * queue. The Ctrl+C/Ctrl+D exit arm hint outranks every status-derived hint
   * for the lifetime of its window; the disarm timeout re-applies this.
   */
  const applyEditorHint = (): void => {
    if (exitArmedAt !== undefined) return
    editor.hint = editorHintFor(agent.status)
  }

  /**
   * Re-derive the queue dock from the inbox and refresh the editor hint with
   * it: the queue-emptying/queue-filling edge is exactly when the idle
   * placeholder flips between the queue hint and the examples hint.
   */
  const refreshQueueDock = (): void => {
    queueDock.refresh()
    applyEditorHint()
  }

  const setStatus = (status: AgentStatus): void => {
    editor.borderColor = status === 'running' ? text => palette.accent(text) : text => palette.dim(text)
    // Running keeps the steering placeholder; idle plan mode carries its own;
    // plain idle carries the queue hint or the example-commands hint.
    applyEditorHint()
    channel.setStatus(status)
    // Publish the active session's state immediately. This also clears a
    // running line retained by the previously mounted session.
    workingLine.update(
      status === 'running',
      status === 'running' ? channel.runningStartedAt() : undefined,
      undefined,
      undefined,
    )
    requestRender()
  }

  // One process-wide spinner tick: the newest pending tool card animates its
  // braille frame, and the working line above the input mirrors the same
  // frame plus the call's verb label. While nothing pends (or the agent is
  // idle) the card update is skipped; the working line itself renders empty
  // when idle, so the tick is effectively self-gating.
  let spinnerFrame = 0
  const spinnerTimer = setInterval(() => {
    if (disposed) return
    const frame = TOOL_SPINNER_FRAMES[spinnerFrame++ % TOOL_SPINNER_FRAMES.length] ?? TOOL_SPINNER_FRAMES[0]
    channel.tickSpinner(frame)
  }, TOOL_SPINNER_INTERVAL_MS)

  const rebuildTranscript = (populateHistory: boolean): void => {
    channel.rebuildTranscript(populateHistory)
  }
  const applyTurnFolding = (turn: number): void => {
    channel.applyTurnFolding(turn)
  }
  const clearStatus = (): void => {
    channel.clearStatus()
  }
  const setToolsVisibility = (next: ToolCardVisibility): void => {
    toolsVisibility = next
    // The compact history fold keys off the expanded phase, so a session that
    // ever compacted re-derives its transcript on every phase switch: expanded
    // restores the folded history, the other phases fold it again. The loops
    // below then re-apply the phase to the rebuilt components idempotently.
    if (channel.hasCompactionCheckpoint()) rebuildTranscript(false)
    channel.applyToolsVisibility(toolsVisibility)
    // Hidden mode folds each turn's steps into one assistant message; other
    // modes restore the per-step Assistant headers.
    for (const turn of channel.assistantStepTurns()) applyTurnFolding(turn)
    // State-switch feedback: transient receipt, not transcript history.
    showTransientNotice(toolsVisibility === 'hidden' ? 'Tool cards hidden.' : `Tool and context cards ${toolsVisibility}.`)
  }

  const questions = createQuestionQueue({
    ctx,
    resolved,
    palette,
    overlayManager,
    requestRender,
    isDisposed,
    questionMaxHeight: () => {
      return Math.max(1, Math.min(
        resolved.questionDialogMaxHeight,
        workbenchRows(),
      ))
    },
  })

  // The keyboard answerer behind `approval/request` lives per-slot in the
  // channel registry (each slot claims only its own agent's asks).

  function currentSessionQuery(): SessionQueryEngine | undefined {
    const implementation = ctx.reflect._getImpl('sessionQuery', false)
    if (implementation === undefined || implementation.fiber.state >= FIBER_FAILED) return undefined
    return ctx.get('sessionQuery', false)
  }

  const resume = createResumeController({
    ctx,
    // Getter: /sessions preflights the mounted session, not the initial one.
    get agent(): Agent { return agent },
    runtime,
    resolved,
    palette,
    overlayManager,
    // Optional and independently mounted. Cordis transiently leaves this sibling
    // non-ACTIVE during command callbacks, so the non-strict read is intentional;
    // terminal fiber states still exclude failed, closing, and closed providers.
    sessionQuery: currentSessionQuery,
    workspaceSessions,
    openLive(sessionId): boolean {
      const slot = registry.get(sessionId)
      if (slot !== undefined) return registry.switchTo(sessionId)
      const live = ctx.agents.get(sessionId)
      if (live === undefined) return false
      registry.adopt(live)
      return true
    },
    async openPersisted(sessionId, cwd): Promise<boolean> {
      // Tool consumers resolve relative paths from the resumed agent's
      // immutable session cwd, so cross-workspace sessions can resume in this
      // process even on hosts that cannot replace themselves in place.
      const handle = await ctx.agents.resume({ resumeSessionId: sessionId }).catch((error: unknown) => {
        if (resolve(cwd) !== resolve(initialCwd)) return undefined
        throw error
      })
      if (handle === undefined) return false
      let adopted = false
      try {
        if (isDisposed()) return true
        await workspaceSessions.add(handle.agent.session.id)
        if (isDisposed()) return true
        registry.adopt(handle.agent)
        adopted = true
        return true
      } finally {
        if (!adopted) await handle.dispose()
      }
    },
    ui,
    editor,
    appendNotice,
    requestRender,
    isDisposed,
    agentStatus,
  })

  const rewind = createRewindController({
    ctx,
    get agent(): Agent { return agent },
    resolved,
    palette,
    overlayManager,
    appendNotice,
    requestRender,
    isDisposed,
    async activate(rewoundAgent, prompt): Promise<void> {
      await workspaceSessions.add(rewoundAgent.session.id)
      if (isDisposed()) return
      registry.adopt(rewoundAgent)
      editor.setText(prompt)
      requestRender()
    },
  })

  const activeSessionIds = (): SessionId[] => [
      ASSISTANT_SESSION_ID,
      ...workspaceSessions.list().map(item => item.sessionId),
    ].filter((sessionId, index, all) => all.indexOf(sessionId) === index)

  const activateSession = (sessionId: SessionId): void => {
    if (sessionId === agent.session.id) return
    if (sessionId === ASSISTANT_SESSION_ID) assistant.open()
    else resume.openSession(sessionId)
  }

  const cycleActiveSession = (offset: -1 | 1): void => {
    const ids = activeSessionIds()
    if (ids.length <= 1) return
    const current = Math.max(0, ids.indexOf(agent.session.id))
    const next = ids[(current + offset + ids.length) % ids.length]
    if (next === undefined || next === agent.session.id) return
    activateSession(next)
  }

  let switchOverlay: TuiOverlaySession | undefined
  const showSessionSwitcher = (): void => {
    const items = sessionLayout?.sessionList.getItems() ?? []
    if (items.length <= 1) {
      showTransientNotice('No other active session.')
      return
    }
    void switchOverlay?.close()
    const session = overlayManager.open({
      create: () => new SessionSwitchDialog(
        items.map(item => ({
          id: item.id,
          title: item.title,
          workspace: item.workspace,
          status: item.status,
          current: item.isActive,
        })),
        palette,
        (id) => {
          void session.close()
          activateSession(SessionId(id))
        },
        () => { void session.close() },
      ),
      options: { width: resolved.detailsDialogWidth, maxHeight: resolved.questionDialogMaxHeight },
    }, 'inline')
    switchOverlay = session
    void session.closed.then(() => {
      if (switchOverlay === session) switchOverlay = undefined
    })
    requestRender()
  }

  const runSessionSwitch = (rawInput: string): void => {
    const argument = rawInput.trim()
    if (argument === '') {
      showSessionSwitcher()
      return
    }
    const normalized = argument.toLowerCase()
    if (normalized === 'next') {
      cycleActiveSession(1)
      return
    }
    if (normalized === 'previous' || normalized === 'prev') {
      cycleActiveSession(-1)
      return
    }
    const items = sessionLayout?.sessionList.getItems() ?? []
    const index = /^\d+$/u.test(argument) ? Number.parseInt(argument, 10) - 1 : -1
    const byIndex = index >= 0 ? items[index] : undefined
    const exact = items.filter(item => item.id === argument || item.title.toLowerCase() === normalized)
    const selected = byIndex ?? (exact.length === 1 ? exact[0] : undefined)
    if (selected === undefined) {
      appendNotice(
        exact.length > 1
          ? `Active session title "${displayText(argument)}" is ambiguous; use its number.`
          : `Unknown active session "${displayText(argument)}". Use /switch to list active sessions.`,
        'warning',
      )
      return
    }
    activateSession(SessionId(selected.id))
  }

  const writeClipboardText = async (text: string): Promise<void> => {
    try {
      const method = await copyText(text, runtime.terminal)
      if (!isDisposed()) showTransientNotice(`Copied ${String(text.length)} characters via ${method}.`)
    } catch (error: unknown) {
      if (!isDisposed()) appendNotice(`Copy failed: ${errorChain(error)}`, 'error')
    }
  }

  // Ctrl+C/Ctrl+D at an idle empty prompt require a second press within
  // EXIT_DOUBLE_PRESS_MS (the Claude Code convention) — a stray press shows a
  // dim hint on the editor instead of killing the session.
  const EXIT_DOUBLE_PRESS_MS = 800
  const REWIND_DOUBLE_PRESS_MS = 800
  // Hard ceiling on the shutdown dispose chain before the exit fires anyway.
  const SHUTDOWN_EXIT_FALLBACK_MS = 3_000
  let exitArmedAt: number | undefined
  let rewindArmedAt: number | undefined
  const doublePressExit = (key: string): void => {
    const pressedAt = now()
    if (exitArmedAt !== undefined && pressedAt - exitArmedAt <= EXIT_DOUBLE_PRESS_MS) {
      exitArmedAt = undefined
      editor.hint = undefined
      requestExit()
      return
    }
    exitArmedAt = pressedAt
    editor.hint = palette.dim(`press ${key} again to exit`)
    requestRender()
    setTimeout(() => {
      // Disarm quietly once the window lapses; restore the state-appropriate
      // placeholder (steer / plan / queue / examples).
      if (exitArmedAt !== undefined && now() - exitArmedAt >= EXIT_DOUBLE_PRESS_MS) {
        exitArmedAt = undefined
        applyEditorHint()
        requestRender()
      }
    }, EXIT_DOUBLE_PRESS_MS + 50)
  }

  const shutdown = (exitProcess: boolean): Promise<void> => {
    // The exit boundary is idempotent and reached from three places: the end
    // of the dispose chain, the chain's rejection, and a hard fallback timer
    // — a turn that ran can leave a dispose step unresolved, and the process
    // must never hang with the terminal already torn down.
    let exitedRuntime = false
    const finish = (): void => {
      if (!exitProcess || exitedRuntime) return
      exitedRuntime = true
      if (runtime.goodbyeMessage !== undefined) {
        runtime.terminal.write(`${palette.dim(displayText(runtime.goodbyeMessage))}\n`)
      }
      runtime.exit(0)
    }
    shuttingDown ??= (async () => {
      disposed = true
      overlayManager.beginShutdown()
      modelController.resetContextResolution()
      clearStatus()
      clearInterval(spinnerTimer)
      for (const controller of commandControllers) controller.abort(new Error('TUI disposed'))
      commandControllers.clear()
      for (const controller of referenceControllers) controller.abort(new Error('TUI disposed'))
      referenceControllers.clear()
      await tuiServiceFiber?.dispose()
      tuiServiceFiber = undefined
      // Every live slot's approvals drain and unregister together (the
      // registry's dispose path), mirroring the single-slot shutdown before it.
      registry.disposeAll()
      questions.rejectAll()
      await overlayManager.dispose()
      modelController.clearOverlay()
      questions.unregister()
      await runtime.terminal.drainInput(100, 20)
      ui.stop()
      finish()
    })()
    if (exitProcess) {
      void shuttingDown.catch(() => {}).then(finish)
      setTimeout(finish, SHUTDOWN_EXIT_FALLBACK_MS)
    }
    return shuttingDown
  }

  const requestExit = (): void => {
    if (agent.status === 'running') {
      agent.cancel({ kind: 'user' })
      appendNotice('Cancelling the active turn before exit…', 'warning')
      void agent.whenIdle().then(() => shutdown(true))
      return
    }
    void shutdown(true)
  }

  /** Swap the palette and all derived themes for the given terminal color scheme. */
  const applyColorScheme = (scheme: TerminalColorScheme): void => {
    if (scheme === currentScheme) return
    currentScheme = scheme
    Object.assign(palette, createPalette(resolved.theme.color, scheme, paletteOptions()))
    Object.assign(mdTheme, markdownTheme(palette, codeHighlighter.highlightCode))
    // Rows cached under the prior palette's roles must not outlive it.
    codeHighlighter.invalidate()
    // `setStatus` below re-derives `editor.borderColor` from the new palette.
    rebuildTranscript(false)
    setStatus(agent.status)
    requestRender()
  }
  let currentScheme: TerminalColorScheme = 'dark'

  // Apply any color scheme the terminal reports. Registering before the query
  // below means even a synchronous reply reaches `applyColorScheme`; in practice
  // the startup query's reply is the only report, since dsh-tui leaves
  // unsolicited color-scheme notifications disabled.
  const disposeSchemeListener = ui.onTerminalColorSchemeChange(applyColorScheme)

  // Ask the terminal for its color scheme via device-status report; the reply,
  // if any, arrives through the listener above. Most terminals do not respond,
  // so we keep the dark-optimised palette. Swallow a query-write failure for the
  // same reason.
  ui.queryTerminalColorScheme({ timeoutMs: 2000 }).catch(() => {})

  const toggleTools = (): void => {
    // The cycle order puts the two common reading modes adjacent: preview ->
    // full detail -> conversation-only, then back to the preview default.
    setToolsVisibility(toolsVisibility === 'collapsed' ? 'expanded'
      : toolsVisibility === 'expanded' ? 'hidden' : 'collapsed')
  }

  const setReasoning = (show: boolean): void => {
    showReasoning = show
    const activeStreaming = channel.detachStreaming()
    rebuildTranscript(false)
    /* v8 ignore next -- the non-streaming command path is covered; this branch preserves an active stream across rebuild. */
    if (activeStreaming !== undefined) {
      channel.restoreStreaming(activeStreaming)
    }
    // State-switch feedback: transient receipt, not transcript history.
    showTransientNotice(`Reasoning ${showReasoning ? 'expanded' : 'collapsed'}.`)
  }

  const toggleReasoning = (): void => { setReasoning(!showReasoning) }

  // The selector and the argument grammar mutate the same closure state the
  // Ctrl+O cycle and Ctrl+R toggle drive, so every entry converges.
  let detailsOverlay: TuiOverlaySession | undefined
  const showDetailsSelector = (): void => {
    void detailsOverlay?.close()
    const session = overlayManager.open({
      create: () => new DetailsDialog(
        toolsVisibility,
        showReasoning,
        palette,
        // Each Tab applies immediately; one dimension changes per call.
        (selection: DetailsSelection) => {
          if (selection.showReasoning !== showReasoning) setReasoning(selection.showReasoning)
          if (selection.visibility !== toolsVisibility) setToolsVisibility(selection.visibility)
        },
        () => { void session.close() },
      ),
      options: { width: resolved.detailsDialogWidth, maxHeight: resolved.questionDialogMaxHeight },
    }, 'inline')
    detailsOverlay = session
    void session.closed.then(() => {
      if (detailsOverlay === session) detailsOverlay = undefined
    })
    requestRender()
  }

  /**
   * Swap the active named theme in place: rebuild the palette and derived
   * themes over the SAME palette object (the whole component tree holds it),
   * invalidate highlight rows cached under the old roles, and re-render.
   */
  const applyTheme = (name: string): boolean => {
    const preset = THEME_PRESETS[name]
    if (preset === undefined) {
      appendNotice(`Unknown theme "${name}". Available: ${THEME_PRESET_NAMES.join(', ')}.`, 'warning')
      return false
    }
    currentPreset = name === 'deepseek' ? undefined : preset
    currentThemeName = name
    Object.assign(palette, createPalette(resolved.theme.color, currentScheme, paletteOptions()))
    Object.assign(mdTheme, markdownTheme(palette, codeHighlighter.highlightCode))
    codeHighlighter.invalidate()
    rebuildTranscript(false)
    setStatus(agent.status)
    requestRender()
    return true
  }

  /** Rename the session through the (optional) session-title service. */
  const renameSession = (title: string): void => {
    const titles = ctx.get('sessionTitle') as {
      rename(session: unknown, title: string): unknown
    } | undefined
    if (titles === undefined) {
      appendNotice('Session titles are not available in this session.', 'warning')
      return
    }
    try {
      titles.rename(agent.session, title)
      showTransientNotice(`Session renamed to "${title}".`)
    } catch (error) {
      appendNotice(`Rename failed: ${errorChain(error)}`, 'error')
    }
  }

  // The `/theme` picker overlay; Tab previews live, Enter keeps, Esc restores.
  let themeOverlay: TuiOverlaySession | undefined
  const showThemeSelector = (): void => {
    void themeOverlay?.close()
    const session = overlayManager.open({
      create: () => new ThemeDialog(
        THEME_PRESET_NAMES.map(name => ({
          name,
          description: THEME_PRESETS[name]?.description ?? '',
          dark: THEME_PRESETS[name]?.dark ?? false,
        })),
        currentThemeName,
        palette,
        applyTheme,
        () => { void session.close() },
      ),
      options: { width: resolved.detailsDialogWidth, maxHeight: resolved.questionDialogMaxHeight },
    }, 'inline')
    themeOverlay = session
    void session.closed.then(() => {
      if (themeOverlay === session) themeOverlay = undefined
    })
    requestRender()
  }

  // `/details` names the same transcript-detail state the Ctrl+O cycle and
  // Ctrl+R toggle mutate, so a user can jump to a mode without cycling.
  const runDetails = (rawInput: string): CommandResult => {
    const tokens = rawInput.split(/\s+/u).filter(token => token !== '')
    if (tokens.length === 0) {
      showDetailsSelector()
      return { kind: 'success' }
    }
    let visibility: ToolCardVisibility | undefined
    let reasoning: boolean | undefined
    for (let token = tokens.shift(); token !== undefined; token = tokens.shift()) {
      if (token === 'collapsed' || token === 'expanded' || token === 'hidden') {
        visibility = token
      } else if (token === 'reasoning') {
        const value = tokens[0]
        if (value === 'on' || value === 'off') {
          tokens.shift()
          reasoning = value === 'on'
        } else {
          reasoning = !showReasoning
        }
      } else {
        return { kind: 'error', text: `Unknown /details argument "${token}". Usage: /details [collapsed|expanded|hidden] [reasoning [on|off]]` }
      }
    }
    // Reasoning first: its transcript rebuild would drop the visibility notice.
    if (reasoning !== undefined) setReasoning(reasoning)
    if (visibility !== undefined) setToolsVisibility(visibility)
    return { kind: 'success' }
  }

  const showHelp = (): void => {
    const commandLines = ctx.commands.list(agent).map((command) => {
      const input = command.input === undefined ? '' : ` ${command.input.hint}`
      return `/${command.name}${input} — ${command.description}`
    })
    channel.chat.addChild(new Spacer(1))
    channel.chat.addChild(new Text(palette.bold(palette.accent('Keyboard shortcuts')), 0, 0))
    channel.chat.addChild(new Text([
      'Enter send/steer • Tab queue while running • Shift/Alt+Enter newline • Up/Down prompt history',
      'Esc cancel turn; double Esc edits a checkpoint • Alt+Left/Right switch active sessions',
      'Ctrl+O cycle cards (collapse/expand/hide) • Ctrl+R toggle reasoning • Ctrl+L redraw',
      'Shift+Tab cycle permission preset • Ctrl+G goal actions • Ctrl+C cancel/clear/exit • Ctrl+D exit',
      '',
      ...commandLines,
      '/skill:<name> [instructions] — load a skill into the conversation',
    ].map(line => palette.dim(line)).join('\n'), 0, 0))
    requestRender()
  }

  const showStatus = async (signal: AbortSignal): Promise<void> => {
    const assembly = await ctx.systemPrompt.assemble(assembleContextFor(agent, signal))
    /* v8 ignore next -- disposal during the awaited assembly is covered by command-owner teardown tests. */
    if (disposed) return
    /* v8 ignore next -- SystemPrompt always emits at least its required base section. */
    const systemPrompt = displayText(renderPrompt(assembly)) || '(empty)'
    const registeredTools = assembly.tools.map(tool => displayText(tool.name)).join(', ') || '(none)'
    const events = agent.session.events
    const latestActivity = agent.session.header.createdAt
    const pressure = contextPressure()
    const usedContext = Math.max(0, Math.round(
      pressure?.projectedTokens ?? pressure?.pressureTokens ?? ctx.tokenMeter.measure(agent.session).totalTokens,
    ))
    let context = `${formatDiagnosticNumber(usedContext)} used · capacity unknown`
    const contextWindow = pressure?.contextWindow ?? modelController.contextWindow()
    if (contextWindow !== undefined && contextWindow > 0) {
      const contextPercent = Math.round(usedContext / contextWindow * 100)
      context = `${diagnosticMeter(contextPercent, palette)} ${String(contextPercent)}% used (${formatDiagnosticNumber(usedContext)} / ${formatDiagnosticNumber(contextWindow)})`
    }
    const tokens = channel.tokens()
    const rate = cacheHitRate(tokens)
    const turns = events.filter(event => event.type === 'turn/start').length
    const steps = events.filter(event => event.type === 'step/start').length
    const toolCalls = events.filter(event => event.type === 'tool/call').length
    const model = target.current === undefined ? 'unset' : displayText(targetLabel(target.current))
    const effort = target.current === undefined
      ? 'unset'
      : target.current.reasoningEffort === undefined
        ? 'default'
        : displayText(target.current.reasoningEffort)
    const groups: readonly (readonly StatusCardRow[])[] = [
      [
        ['Session', displayText(agent.session.id)],
        ['Title', displayText(sessionTitle ?? 'untitled')],
        ['Directory', displayText(activeCwd())],
        ['Model', `${model} ${palette.dim(`(effort ${effort}; reasoning blocks ${showReasoning ? 'shown' : 'hidden'})`)}`],
      ],
      [
        ['Agent', [
          agent.status,
          formatDiagnosticCount(events.length, 'event'),
          formatDiagnosticCount(turns, 'turn'),
          formatDiagnosticCount(steps, 'step'),
          formatDiagnosticCount(toolCalls, 'tool call'),
        ].join(' · ')],
      ],
      [
        ['Tokens', `${formatDiagnosticNumber(tokens.input)} input + ${formatDiagnosticNumber(tokens.output)} output`],
        ['KV cache', rate === undefined
          ? `n/a (${formatDiagnosticNumber(tokens.cacheRead)} read + ${formatDiagnosticNumber(tokens.cacheWrite)} write)`
          : `${diagnosticMeter(rate, palette)} ${String(rate)}% hit (${formatDiagnosticNumber(tokens.cacheRead)} read + ${formatDiagnosticNumber(tokens.cacheWrite)} write)`],
        ['Context', context],
      ],
      [
        ['Created', formatDiagnosticTime(agent.session.header.createdAt)],
        ['Active', formatDiagnosticTime(latestActivity)],
      ],
    ]
    const card = new StatusCardComponent(groups, palette)
    channel.chat.addChild(new Spacer(1))
    channel.chat.addChild(card)
    channel.chat.addChild(new Spacer(1))
    channel.chat.addChild(new Text(palette.bold(palette.accent('System prompt')), 0, 0))
    channel.chat.addChild(new Text(systemPrompt, 0, 0))
    channel.chat.addChild(new Spacer(1))
    channel.chat.addChild(new Text(palette.bold(palette.accent('Registered tools')), 0, 0))
    channel.chat.addChild(new Text(registeredTools, 0, 0))
    requestRender()
  }

  // Skill listing is async while `createTuiChat` is synchronous, so the TUI
  // retains the last complete invocation-neutral catalog for synchronous
  // editor completion, filters it for user invocation, and refreshes it after
  // registry invalidation.
  let skillCommands: SlashCommand[] = []
  let skillCommandScan = 0
  const refreshCommandAutocomplete = (): void => {
    const base = new CombinedAutocompleteProvider(
      [
        ...ctx.commands.list(agent).map(command => ({
          name: command.name,
          description: command.description,
          ...(command.input === undefined ? {} : { argumentHint: command.input.hint }),
        })),
        ...skillCommands,
      ],
      agent.session.header.cwd ?? process.cwd(),
    )
    const sessionReferences = ctx.get('sessionReferenceResolver')
    editor.setAutocompleteProvider(new ReferenceAutocompleteProvider(
      base,
      fileSearch,
      sessionReferences,
      agent,
    ))
  }
  const refreshVisibleSlashAutocomplete = (): void => {
    const cursor = editor.getCursor()
    const textBeforeCursor = editor.getLines().slice(cursor.line, cursor.line + 1).join('').slice(0, cursor.col)
    if (cursor.line === 0 && textBeforeCursor.startsWith('/') && !textBeforeCursor.includes(' ')) {
      // pi-tui's provider setter closes an existing menu but does not query
      // the replacement for the current draft. Tab in a slash-name context
      // only requests suggestions, so it refreshes without editing the text.
      editor.handleInput('\t')
    }
  }
  const disposeCommandChanges = ctx.on('commands/change', refreshCommandAutocomplete)
  refreshCommandAutocomplete()

  const refreshSkillCommands = (service: SkillRegistry): void => {
    const scan = ++skillCommandScan
    service.snapshot({ cwd: activeCwd(), signal: skillAbort.signal }).then(
      (snapshot) => {
        if (disposed || scan !== skillCommandScan || !snapshot.complete) return
        const invocable = snapshot.skills.filter(skill => skill.invocation.userInvocable)
        // The argument-hint slot shows in the menu but is never inserted on
        // selection, so it carries the skill's scope instead of an
        // instructions placeholder. `SkillSource` is open-ended; every
        // non-project source (user, custom, bundled, runtime, …) collapses
        // to `(user)`.
        skillCommands = invocable.map(skill => ({
          name: `skill:${skill.name}`,
          description: skill.description,
          argumentHint: skill.source.startsWith('project-') ? '(project)' : '(user)',
        }))
        refreshCommandAutocomplete()
        refreshVisibleSlashAutocomplete()
        requestRender()
      },
      () => {
        // Discovery failed or was aborted on dispose; keep the base slash
        // commands so autocomplete still works without skill entries.
      },
    )
  }
  const disposeSkillChanges = skills === undefined
    ? () => {}
    : ctx.on('skills/change', () => { refreshSkillCommands(skills) })
  if (skills !== undefined) refreshSkillCommands(skills)

  // Front-door commands register GLOBALLY (through this plugin's context, not
  // the initial agent's): the commands service scopes registrations by the
  // owning context, and an agent-scoped registration is invisible to every
  // other live session — `/sessions`, `/new`, and the rest must execute for
  // whichever session is mounted. The fiber still dies with the TUI.
  const commandFiber = ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      name: 'help',
      description: 'Show keyboard shortcuts and commands',
      handler: () => { showHelp(); return { kind: 'success' } },
    })
    commandCtx.commands.register({
      name: 'model',
      description: 'Show or switch this session\'s model; use /effort for reasoning level',
      input: { hint: '[[provider/]model]' },
      handler: ({ rawInput }) => {
        modelController.queueModelCommand(rawInput)
        return { kind: 'success' }
      },
    })
    commandCtx.commands.register({
      name: 'effort',
      description: 'Show or set this session\'s reasoning effort',
      input: { hint: '[level]' },
      handler: ({ rawInput }) => {
        modelController.queueReasoningEffortCommand(rawInput)
        return { kind: 'success' }
      },
    })
    commandCtx.commands.register({
      name: 'clear',
      description: 'Clear the transcript view (session history is unchanged)',
      handler: () => { channel.chat.clear(); requestRender(); return { kind: 'success' } },
    })
    commandCtx.commands.register({
      name: 'details',
      description: 'Select tool-card visibility and reasoning display',
      input: { hint: '[collapsed|expanded|hidden] [reasoning [on|off]]' },
      handler: ({ rawInput }) => runDetails(rawInput),
    })
    commandCtx.commands.register({
      name: 'theme',
      description: 'Show or switch the TUI color theme',
      input: { hint: '[name]' },
      handler: ({ rawInput }) => {
        const name = rawInput.trim()
        if (name === '') {
          showThemeSelector()
        } else {
          applyTheme(name)
        }
        return { kind: 'success' }
      },
    })
    commandCtx.commands.register({
      name: 'queue',
      description: 'Review queued steering messages (edit or remove)',
      handler: () => { queueDock.showSheet(); return { kind: 'success' } },
    })
    commandCtx.commands.register({
      name: 'rename',
      description: 'Rename this session',
      input: { hint: '[title]' },
      handler: ({ rawInput }) => {
        const title = rawInput.trim()
        if (title !== '') {
          renameSession(title)
          return { kind: 'success' }
        }
        const session = overlayManager.open({
          create: () => new RenameDialog(
            sessionTitle ?? '',
            palette,
            renameSession,
            () => { void session.close() },
          ),
          options: { width: 64, maxHeight: 10 },
        }, 'inline')
        return { kind: 'success' }
      },
    })
    commandCtx.commands.register({
      name: 'fork',
      description: 'Branch this session at its last completed turn and open it',
      handler: async () => {
        await forkSession({
          ctx, resolved, palette, overlayManager, requestRender, isDisposed, appendNotice, agent,
          activate: async (forkedAgent) => {
            await workspaceSessions.add(forkedAgent.session.id)
            if (!isDisposed()) registry.adopt(forkedAgent)
          },
        })
        return { kind: 'success' }
      },
    })
    commandCtx.commands.register({
      name: 'status',
      description: 'Show session diagnostics, system prompt, and registered tools',
      handler: async ({ signal }) => { await showStatus(signal); return { kind: 'success' } },
    })
    commandCtx.commands.register({
      name: 'context',
      description: 'Show context occupancy and its system/tools/messages breakdown',
      handler: () => {
        openStaticDialog(insights, 'Context', contextLines(insights, palette), () => contextLines(insights, palette))
        return { kind: 'success' }
      },
    })
    commandCtx.commands.register({
      name: 'agents',
      description: 'List this session\'s subagent sessions and their activity',
      handler: async ({ signal }) => {
        const lines = await agentsLines(insights, signal)
        if (!isDisposed()) openStaticDialog(insights, 'Subagents', lines)
        return { kind: 'success' }
      },
    })
    commandCtx.commands.register({
      name: 'jobs',
      description: 'List this session\'s background jobs',
      handler: () => {
        openStaticDialog(insights, 'Background jobs', jobsLines(insights), () => jobsLines(insights))
        return { kind: 'success' }
      },
    })
    commandCtx.commands.register({
      name: 'settings',
      description: 'Show settings namespaces and where overrides live',
      handler: () => {
        openStaticDialog(insights, 'Settings', settingsLines(insights), () => settingsLines(insights))
        return { kind: 'success' }
      },
    })
    commandCtx.commands.register({
      name: 'export',
      description: 'Write this session\'s transcript to a markdown file',
      input: { hint: '[path]' },
      handler: ({ rawInput }) => {
        const argument = rawInput.trim()
        try {
          const path = writeExport(
            activeCwd(),
            agent.session,
            argument === '' ? undefined : resolve(activeCwd(), argument),
          )
          showTransientNotice(`Exported to ${path}`)
        } catch (error) {
          appendNotice(`Export failed: ${errorChain(error)}`, 'error')
        }
        return { kind: 'success' }
      },
    })
    const exitHandler = (): CommandResult => {
      requestExit()
      return { kind: 'success' }
    }
    commandCtx.commands.register({
      name: 'exit',
      description: 'Exit after the active turn reaches idle',
      handler: exitHandler,
    })
    commandCtx.commands.register({
      name: 'quit',
      description: 'Exit after the active turn reaches idle',
      handler: exitHandler,
    })
    commandCtx.commands.register({
      name: 'sessions',
      description: 'Browse active workspace sessions and complete history',
      handler: () => { resume.showSessions(); return { kind: 'success' } },
    })
    commandCtx.commands.register({
      name: 'switch',
      description: 'Switch among active workspace sessions',
      input: { hint: '[next|previous|number|title]' },
      handler: ({ rawInput }) => { runSessionSwitch(rawInput); return { kind: 'success' } },
    })
    commandCtx.commands.register({
      name: 'new',
      description: 'Start a fresh session in this or another project and switch to it',
      input: { hint: '[project path]' },
      handler: ({ rawInput }) => { newSession(rawInput); return { kind: 'success' } },
    })
    commandCtx.commands.register({
      name: 'assistant',
      description: 'Switch to the personal assistant session',
      handler: () => { assistant.open(); return { kind: 'success' } },
    })
  })
  // The @-file reference prompt section registers per-slot (on each agent's
  // own scope) inside the slot factory.

  const runCommand = (text: string): void => {
    const controller = new AbortController()
    commandControllers.add(controller)
    void ctx.commands.execute(agent, text, controller.signal).then(
      (execution) => {
        if (disposed) return
        if (execution === undefined) {
          appendNotice(`Unknown command: ${text}`, 'warning')
        } else if (execution.result.text !== undefined && execution.result.text !== '') {
          appendNotice(execution.result.text, execution.result.kind === 'error' ? 'error' : 'info')
        }
      },
      (error: unknown) => {
        if (!disposed) {
          appendNotice(`Command failed: ${errorChain(error)}`, 'error')
        }
      },
    ).finally(() => { commandControllers.delete(controller) })
  }

  type MessageDelivery = 'auto' | 'queue'

  const dispatchMessage = (
    content: ContentBlock[],
    attachedContext?: UserMessage,
    delivery: MessageDelivery = 'auto',
    targetAgent: Agent = agent,
    targetChannel: SessionChannel = channel,
  ): UserMessage | undefined => {
    if (disposed) {
      appendNotice(`Agent "${targetAgent.id}" is disposed.`, 'error')
      return undefined
    }
    const message = createUserMessage({ content, source: { kind: 'user' } })
    if (delivery === 'queue') {
      if (attachedContext !== undefined) {
        queuedReferenceContexts.set(message.id, { agent: targetAgent, context: attachedContext })
      }
      targetAgent.followup(message)
    } else if (targetAgent.status === 'running') {
      if (attachedContext !== undefined) targetAgent.inject(attachedContext)
      targetAgent.steer(message)
      targetChannel.addPendingSteering(message.id)
    } else {
      if (attachedContext !== undefined) targetAgent.inject(attachedContext)
      targetAgent.followup(message)
    }
    return message
  }

  const recordSubmission = (targetAgent: Agent, text: string, message: UserMessage): void => {
    registry.get(targetAgent.session.id)?.submissions.push({ text, messageId: message.id })
  }

  /** Deliver a user turn to the agent: steer while running, send while idle, or report a disposed agent. */
  const deliver = (payload: string): void => {
    dispatchMessage([{ type: 'text', text: payload }])
  }

  /** Load a manually invoked skill and deliver its rendered body as a user turn, reporting lookup outcomes as notices. */
  const invokeSkill = (name: string, instructions: string): void => {
    if (skills === undefined) {
      appendNotice('Skills are not available in this session.', 'warning')
      return
    }
    const lookup = { cwd: activeCwd(), signal: skillAbort.signal }
    const reportFailure = (error: unknown): void => {
      if (disposed) return
      appendNotice(`Skill "${name}" failed to load: ${errorChain(error)}`, 'error')
    }
    skills.list(lookup).then(
      (summaries) => {
        if (disposed) return
        const summary = summaries.find(skill => skill.name === name)
        if (summary === undefined) {
          appendNotice(`Unknown skill: ${name}`, 'warning')
          return
        }
        if (!summary.invocation.userInvocable) {
          appendNotice(`Skill "${name}" is not available for user invocation.`, 'warning')
          return
        }
        skills.get(name, lookup).then(
          (skill) => {
            if (disposed) return
            if (skill === undefined) {
              appendNotice(`Unknown skill: ${name}`, 'warning')
              return
            }
            if (!skill.invocation.userInvocable) {
              appendNotice(`Skill "${name}" is not available for user invocation.`, 'warning')
              return
            }
            deliver(renderSkillInvocation(skill, instructions))
          },
          reportFailure,
        )
      },
      reportFailure,
    )
  }

  const submitEditorValue = (value: string, delivery: MessageDelivery = 'auto'): void => {
    const text = value.trim()
    if (text === '') return
    const restoreSubmittedInput = (): void => {
      if (editor.getText() === '') editor.setText(value)
    }
    // An armed inbox edit REPLACES its queued message instead of dispatching.
    const editTarget = queueDock.takeEditTarget()
    if (editTarget !== undefined) {
      editor.addToHistory(text)
      editor.setText('')
      const replacement = replaceQueuedMessage(editTarget, [{ type: 'text', text }])
      if (agent.inbox.replace(editTarget.id, replacement)) {
        const attached = queuedReferenceContexts.get(editTarget.id)
        queuedReferenceContexts.delete(editTarget.id)
        if (attached !== undefined) queuedReferenceContexts.set(replacement.id, attached)
        if (agent.inbox.nextStep.some(message => message.id === replacement.id)) {
          channel.addPendingSteering(replacement.id)
        }
        recordSubmission(agent, text, replacement)
        showTransientNotice('Queued message updated.')
      } else if (agent.status === 'running') {
        // The target left the queue while editing; deliver as fresh steering.
        agent.steer(replacement)
        channel.addPendingSteering(replacement.id)
        recordSubmission(agent, text, replacement)
      } else {
        agent.followup(replacement)
        recordSubmission(agent, text, replacement)
      }
      refreshQueueDock()
      channel.refreshStatus()
      return
    }
    // `/skill:<name>` carries a colon, which the command registry's name
    // grammar rejects, so it is intercepted before generic command routing.
    if (text.startsWith(SKILL_COMMAND_PREFIX)) {
      editor.addToHistory(text)
      editor.setText('')
      const { name: skillName, instructions } = parseSkillCommand(text)
      if (skillName === '') appendNotice('Usage: /skill:<name> [instructions]', 'warning')
      else invokeSkill(skillName, instructions)
      return
    }
    if (value.startsWith('/')) {
      editor.addToHistory(text)
      editor.setText('')
      runCommand(value)
      return
    }
    let parsed: ReturnType<typeof parseSessionReferenceText>
    try {
      parsed = parseSessionReferenceText(text)
    } catch (error: unknown) {
      restoreSubmittedInput()
      appendNotice(`Invalid session reference: ${errorChain(error)}`, 'error')
      return
    }
    if (parsed.references.length === 0) {
      editor.addToHistory(text)
      editor.setText('')
      const message = dispatchMessage([{ type: 'text', text: parsed.text }], undefined, delivery)
      if (message !== undefined) recordSubmission(agent, text, message)
      return
    }
    const sessionReferences = ctx.get('sessionReferenceResolver')
    if (sessionReferences === undefined) {
      restoreSubmittedInput()
      appendNotice('Session reference capability unavailable.', 'error')
      return
    }
    const controller = new AbortController()
    const targetAgent = agent
    const targetChannel = channel
    referenceControllers.add(controller)
    editor.disableSubmit = true
    void sessionReferences.prepare(
      targetAgent,
      [{ type: 'text', text: parsed.text }],
      parsed.references,
      controller.signal,
    ).then((prepared: { content: ContentBlock[]; additionalContext?: UserMessage }) => {
      if (disposed) return
      editor.addToHistory(text)
      if (editor.getText() === value) editor.setText('')
      // The snapshot travels with the prompt so a blocking admission hook
      // discards them together — see dispatchMessage's attached-context path.
      const message = dispatchMessage(prepared.content, prepared.additionalContext, delivery, targetAgent, targetChannel)
      if (message !== undefined) recordSubmission(targetAgent, text, message)
    }, (error: unknown) => {
      if (!disposed && !controller.signal.aborted) {
        restoreSubmittedInput()
        appendNotice(`Session reference failed: ${errorChain(error)}`, 'error')
      }
    }).finally(() => {
      referenceControllers.delete(controller)
      editor.disableSubmit = false
      requestRender()
    })
  }
  editor.onSubmit = (value: string) => { submitEditorValue(value) }

  const removeInputListener = ui.addInputListener((data) => {
    if (overlayManager.hasActiveOverlay()) return undefined

    const mouse = terminalMouseInput(data)
    if (mouse !== undefined) {
      const result = workbench?.handleMouse(mouse, runtime.terminal.columns)
      if (result?.sessionId !== undefined) activateSession(SessionId(result.sessionId))
      if (result?.copiedText !== undefined) {
        void writeClipboardText(result.copiedText)
      }
      if (result?.consumed === true) requestRender()
      return { consume: true }
    }

    const fastSessionSwitch = editor.focused
      && editor.getText() === ''
      && !editor.isShowingAutocomplete()
    if (fastSessionSwitch && matchesKey(data, 'alt+left')) {
      cycleActiveSession(-1)
      return { consume: true }
    }
    if (fastSessionSwitch && matchesKey(data, 'alt+right')) {
      cycleActiveSession(1)
      return { consume: true }
    }
    if (matchesKey(data, Key.pageUp)) {
      workbench?.scrollPageUp(runtime.terminal.columns)
      requestRender()
      return { consume: true }
    }
    if (matchesKey(data, Key.pageDown)) {
      workbench?.scrollPageDown(runtime.terminal.columns)
      requestRender()
      return { consume: true }
    }

    // Shift+Tab cycles permission presets before plain Tab is considered for
    // queue submission.
    if (matchesKey(data, Key.shift(Key.tab))) {
      permissionController.cycle()
      return { consume: true }
    }
    if (
      matchesKey(data, Key.tab)
      && agent.status === 'running'
      && editor.focused
      && !editor.disableSubmit
      && !editor.isShowingAutocomplete()
      && editor.getText().trim() !== ''
      && !editor.getText().trimStart().startsWith('/')
    ) {
      submitEditorValue(editor.getText(), 'queue')
      return { consume: true }
    }

    // Empty-input ↑ recalls the latest real message submission. When that
    // exact item is still pending, the next submit replaces it in place;
    // otherwise the text is restored as a fresh draft. This preserves actual
    // Enter/Tab order across the two inbox lanes.
    if (
      matchesKey(data, Key.up)
      && editor.focused
      && editor.getText() === ''
      && !editor.isShowingAutocomplete()
    ) {
      const latest = registry.active().submissions.at(-1)
      if (latest !== undefined) {
        if (!queueDock.armForEdit(latest.messageId)) editor.setText(latest.text)
        requestRender()
        return { consume: true }
      }
      if (queueDock.armLatestForEdit()) return { consume: true }
    }
    if (matchesKey(data, Key.up) && queueDock.hasEditTarget()) {
      queueDock.cancelEditTarget()
    }
    if (matchesKey(data, Key.ctrl('g'))) {
      goalBar.showActions()
      return { consume: true }
    }
    if (matchesKey(data, Key.ctrl('o'))) {
      toggleTools()
      return { consume: true }
    }
    if (matchesKey(data, Key.ctrl('r'))) {
      toggleReasoning()
      return { consume: true }
    }
    if (matchesKey(data, Key.ctrl('l'))) {
      ui.invalidate()
      ui.requestRender(true)
      return { consume: true }
    }
    if (matchesKey(data, Key.escape) && agent.status === 'running') {
      rewindArmedAt = undefined
      agent.cancel({ kind: 'user' })
      return { consume: true }
    }
    if (
      matchesKey(data, Key.escape)
      && agent.status === 'idle'
      && editor.getText() === ''
      && !editor.isShowingAutocomplete()
    ) {
      const pressedAt = now()
      if (rewindArmedAt !== undefined && pressedAt - rewindArmedAt <= REWIND_DOUBLE_PRESS_MS) {
        rewindArmedAt = undefined
        applyEditorHint()
        rewind.show()
      } else {
        rewindArmedAt = pressedAt
        editor.hint = palette.dim('press Esc again to rewind this conversation')
        requestRender()
        setTimeout(() => {
          if (rewindArmedAt !== undefined && now() - rewindArmedAt >= REWIND_DOUBLE_PRESS_MS) {
            rewindArmedAt = undefined
            applyEditorHint()
            requestRender()
          }
        }, REWIND_DOUBLE_PRESS_MS + 50)
      }
      return { consume: true }
    }
    if (matchesKey(data, Key.ctrl('c'))) {
      if (agent.status === 'running') {
        agent.cancel({ kind: 'user' })
      } else if (editor.getText() !== '') {
        editor.setText('')
      } else {
        doublePressExit('ctrl+c')
      }
      return { consume: true }
    }
    if (matchesKey(data, Key.ctrl('d'))) {
      if (agent.status === 'running') appendNotice('Cancel the active turn before exiting.', 'warning')
      else doublePressExit('ctrl+d')
      return { consume: true }
    }
    return undefined
  })

  // Every session-scoped listener (session events, inbox/status/error/disposed)
  // lives on the mounted channel; the registry's mount/unmount attach and
  // detach them with the slot itself. The initial slot is already attached.

  const detachListeners = (): void => {
    stoppedTitleAbort?.abort()
    if (stoppedTitleRetry !== undefined) clearTimeout(stoppedTitleRetry)
    skillAbort.abort()
    fileSearch.dispose()
    noticeSlot.dispose()
    removeInputListener()
    disposeCommandChanges()
    disposeSkillChanges()
    disposePromptChanges()
    disposeBackgroundSessionEvents()
    disposeQueuedReferenceTurns()
    disposeQueuedReferenceDiscards()
    disposeBackgroundStatusChanges()
    disposeWorkspaceChanges()
    for (const value of promptValues) value.dispose()
    // Every live slot tears down together: session listeners, per-slot
    // approvals/docks, agent-scoped model routing and prompt sections.
    registry.disposeAll()
    queuedReferenceContexts.clear()
    disposeSchemeListener()
    modelController.detach()
  }

  rebuildTranscript(true)
  goalBar.refresh()
  refreshQueueDock()
  const restoredGoal = foldGoal(agent.session.events).goal
  /* v8 ignore next -- goal replay coverage lives with the goal seam; the TUI only formats its startup notice. */
  if (restoredGoal !== undefined && restoredGoal.phase !== 'complete') {
    appendNotice(
      `Goal restored (${restoredGoal.phase}) with automatic continuation disarmed. `
      + 'Human confirmation is required; send “继续” or run /goal resume.',
      'warning',
    )
  }
  setStatus(agent.status)
  try {
    ui.start()
  } catch (error: unknown) {
    disposed = true
    detachListeners()
    void commandFiber.dispose().catch(
      /* v8 ignore next 2 -- command registration cleanup is non-throwing; this guards a future disposer regression */
      (cleanupError: unknown) => {
        ctx.logger.warn(`ui-tui: scoped cleanup after startup failure failed: ${errorChain(cleanupError)}`)
      },
    )
    clearStatus()
    clearInterval(spinnerTimer)
    questions.unregister()
    ui.stop()
    throw error
  }
  tuiServiceFiber = ctx.inject([], (serviceCtx) => {
    new TuiExtensionServiceImpl(serviceCtx, agent, overlayManager)
  })

  // A launcher-seeded first turn (`dsh migrate`/`dsh upgrade`):
  // invoke the named skill exactly as a typed `/skill:<name>` would, once the
  // chat is live and the agent is idle. The launcher sets this only for a fresh
  // session, so there is no prior turn to collide with; invokeSkill reports an
  // unknown skill as a notice.
  if (config.initialSkill !== undefined) invokeSkill(config.initialSkill, '')

  // A configured theme name that matches no shipped preset falls back to the
  // adaptive default; say so once at startup rather than failing silently.
  if (resolved.theme.name !== 'deepseek' && THEME_PRESETS[resolved.theme.name] === undefined) {
    appendNotice(`Unknown theme "${resolved.theme.name}" in config; using the adaptive default. Available: ${THEME_PRESET_NAMES.join(', ')}.`, 'warning')
  }

  return {
    async dispose(): Promise<void> {
      detachListeners()
      await shutdown(false)
      await commandFiber.dispose()
    },
  }
}

/**
 * Open the pi-tui channel once its configured agent exists.
 *
 * @param ctx - Context supplying the agent registry, tools, and event stream.
 * @param config - Target agent and presentation configuration.
 * @param runtime - Terminal and process-exit boundary.
 */
export function mountTui(ctx: Context, config: Config, runtime: TuiRuntime): void {
  const sessionId = SessionId(config.sessionId ?? 'main')
  const matchesConfiguredIdentity = (agent: Agent): boolean =>
    agent.id === sessionId && ctx.agents.roots().includes(agent)
  let settled = false

  const stopWaiting = (): void => {
    disposeCreated()
    disposeFailure()
  }
  const start = (payload: { agent: Agent }): void => {
    if (settled || !matchesConfiguredIdentity(payload.agent)) return
    settled = true
    stopWaiting()
    ctx.effect(() => {
      const controller = createTuiChat(ctx, config, runtime)
      return () => controller.dispose()
    }, 'ui-tui')
  }
  const fail = (payload: { sessionId: SessionId; error: unknown }): void => {
    if (settled || payload.sessionId !== sessionId) return
    settled = true
    stopWaiting()
    runtime.terminal.write(displayText(`ui-tui: session "${sessionId}" failed to start: ${errorChain(payload.error)}\n`))
    runtime.exit(1)
  }

  const disposeCreated = ctx.on('agent/created', start)
  const disposeFailure = ctx.on('agent-loop/config-start-failed', fail)
  const existing = ctx.agents.roots().find(agent => agent.id === sessionId)
  if (existing !== undefined) start({ agent: existing })
}

const ROOT_DISPOSE_TIMEOUT_MS = 5_000

/**
 * Dispose the whole application before process exit, with a bounded fallback.
 * @param ctx - The TUI plugin context whose root owns sibling resources.
 * @param code - Process status to report.
 * @param exit - Exit boundary, replaceable by tests.
 */
export function disposeRootAndExit(
  ctx: Context,
  code: number,
  exit: (status: number) => void = (status) => { process.exit(status) },
): void {
  let exited = false
  const exitOnce = (): void => {
    if (exited) return
    exited = true
    exit(code)
  }
  const timeout = setTimeout(exitOnce, ROOT_DISPOSE_TIMEOUT_MS)
  void ctx.root.fiber.dispose().then(
    () => { clearTimeout(timeout); exitOnce() },
    () => { clearTimeout(timeout); exitOnce() },
  )
}

/** Cordis entry point using the process terminal; explicit TUI composition requires a TTY pair. */
/* v8 ignore start -- production process wiring; fake-terminal tests cover mountTui/createTuiChat,
   and apps/cli PTY smokes cover the real entry */
export function apply(ctx: Context, config: Config): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('ui-tui: both stdin and stdout must be TTYs; use the one-shot @deepseek-ai/dsh-cli-demo app for pipes')
  }
  // Truecolor is a terminal capability, so detect it here at the process
  // boundary: COLORTERM is the standard signal, but Windows Terminal only
  // sets WT_SESSION and several other modern terminals announce themselves
  // through TERM_PROGRAM; an explicit theme value still wins.
  const truecolor = config.theme?.truecolor ?? (
    ['truecolor', '24bit'].includes(process.env.COLORTERM ?? '')
    || process.env.WT_SESSION !== undefined
    || ['vscode', 'WezTerm', 'ghostty', 'iTerm.app', 'Hyper'].includes(process.env.TERM_PROGRAM ?? '')
  )
  const resumeHost = ctx.get('tuiResumeHost')
  const goodbyeMessage = ctx.get('tuiGoodbyeMessage')
  // The launcher seeds a guided fresh session's first turn through this key; a
  // config value still wins. Consumed in createTuiChat via config.initialSkill.
  const initialSkill = config.initialSkill ?? ctx.get('tuiInitialSkill')
  const startup = ctx.tuiWorkspaceStartup
  mountTui(ctx, Object.assign(
    {},
    config,
    { sessionId: String(startup.sessionId) },
    { theme: Object.assign({}, config.theme, { truecolor }) },
    initialSkill === undefined ? {} : { initialSkill },
  ), {
    terminal: new ProcessTerminal(),
    exit: (code) => { disposeRootAndExit(ctx, code) },
    ...resumeHost === undefined ? {} : { handoffResume: (sessionId, cwd) => resumeHost.handoff(sessionId, cwd) },
    ...goodbyeMessage === undefined ? {} : { goodbyeMessage },
  })
}
/* v8 ignore stop */
