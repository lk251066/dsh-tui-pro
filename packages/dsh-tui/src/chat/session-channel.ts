/**
 * Per-session chat channel: the transcript container and every piece of
 * presentation state that belongs to exactly one agent's session (streaming
 * components, tool/context cards, turn status, token totals, steering
 * bookkeeping), plus the event listeners that keep them current. `index.ts`
 * owns the shared chrome (TUI, editor, palette, header, docks) and mounts one
 * channel per driven session; the multi-session work ahead swaps the mounted
 * channel under the same chrome.
 *
 * This module is a byte-for-byte behavior-preserving extraction of the
 * per-agent closures that previously lived inside `createTuiChat`; nothing
 * here reorders, rewrites, or re-times the moved logic.
 * @module @deepseek-ai/dsh-tui/chat/session-channel
 */

import {
  Spacer,
  Text,
  type Component,
  type MarkdownTheme,
} from '@earendil-works/pi-tui'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import type { ContentBlock, MessageId } from '@deepseek-ai/dsh-llm'
import {
  isReplacementSurfaceEvent,
  type SessionEvent,
} from '@deepseek-ai/dsh-session'
import { recordEventUsage, sessionTokens, type SessionTokenTotals } from './tokens.ts'
import {
  openStepPhase,
  openTurn,
  runningPhaseGlyph,
  STATUS_ANIMATION_INTERVAL_MS,
  STATUS_FADE_MS,
  TIMING_BUCKET_GLYPHS,
  type StepPosition,
} from './timing.ts'
import type { ResolvedTuiConfig } from '../config.ts'
import {
  CollapsedToolGroupComponent,
  ContextCardComponent,
  type ToolCardVisibility,
  StreamingAssistantComponent,
  ToolCardComponent,
  TodoComponent,
  UserMessageComponent,
} from '../components/transcript.ts'
import { shortcutHint } from '../components/figures.ts'
import type { Palette } from '../components/theme.ts'
import { contentText, parseArguments } from '../components/content.ts'
import { displayText } from '../components/text.ts'
import { pickSpinnerVerb } from './spinner-verbs.ts'
import {
  isCompactCheckpoint,
  sessionReferenceCard,
  transcriptToolCallIds,
} from './helpers.ts'
import type { TuiTerminalLike } from './terminal.ts'
import { TranscriptContainer } from '../components/transcript-container.ts'
import { LiveTokenRate } from './live-token-rate.ts'

/** Complete durable reference required to retrieve one image. */
type ImageAttachmentRef = Extract<ContentBlock, { type: 'image' }>['attachment']

/**
 * Low-signal read/search tools whose adjacent calls collapse into one summary
 * row (Claude Code's collapsed read/search group): the registered names `read`
 * (tool-fs), `grep` and `glob` (tool-fs-search). The harness has no separate
 * `ls`/`list` tool — `glob` owns directory listings.
 */
const FOLDABLE_TOOLS: ReadonlySet<string> = new Set(['read', 'grep', 'glob'])

/** An adjacent run of foldable calls below this count keeps its standalone cards. */
const TOOL_GROUP_MIN_CARDS = 3

/**
 * Transcript row standing in for one compacted range while the full history is
 * rendered (Ctrl+O expanded): the conversation above it stays visible, so the
 * marker only reports where the model stopped seeing that history.
 */
const COMPACTION_BOUNDARY = '… earlier context was compacted …'

interface RunningStatus {
  turn: number | undefined
  /** Render clock when the turn began; origin of the glyph fade-in. */
  startedAt: number
  /** The most recently rendered phase glyph, handed to the fade-out. */
  lastGlyph: string
}

/** A running glyph fading out after its turn ended, before the caret returns. */
interface FadingStatus {
  glyph: string
  /** Render clock when the turn ended; origin of the glyph fade-out. */
  endedAt: number
}

/**
 * The shared chrome and services one session channel needs from its host.
 * Large by design: the channel is the extracted half of `createTuiChat`, so
 * this interface is exactly the half that stayed behind.
 */
export interface SessionChannelDeps {
  readonly ctx: Context
  /** The agent whose session this channel renders. */
  readonly agent: Agent
  /** Resolved presentation config (line limits, tool-card sizing). */
  readonly resolved: ResolvedTuiConfig
  /** Shared palette; the host may swap its roles in place. */
  readonly palette: Palette
  /** Shared markdown theme; the host may swap its callbacks in place. */
  readonly mdTheme: MarkdownTheme
  /** Logical render clock; the host's `runtime.now`. */
  now(): number
  /** Terminal façade for the progress bit; the host's `runtime.terminal`. */
  readonly terminal: TuiTerminalLike
  /** Redraw the channel (also refreshes prompt values and chrome). */
  requestRender(): void
  /** Append a durable notice row to the transcript. */
  appendNotice(message: string, kind?: 'info' | 'warning' | 'error'): void
  /** Resolve one stored image attachment's bytes (optional store). */
  loadAttachmentImage(ref: ImageAttachmentRef): Promise<Uint8Array | undefined>
  /** Learn a rendered prompt into the shared editor's history. */
  addToEditorHistory(text: string): void
  /** The goal dock refreshes on goal/turn events (host-owned chrome). */
  refreshGoalBar(): void
  /** The queue dock refreshes on inbox-affecting events (host-owned chrome). */
  refreshQueueDock(): void
  /** The title/header/terminal-title chrome refresh on `session/title`. */
  onSessionTitle(title: string): void
  /** File-search cache invalidation hook (`tool/result`). */
  onToolResult(): void
  /**
   * Apply an agent-status edge in full (channel state machine plus the host's
   * editor border/hint/working-line chrome); the channel's own event listeners
   * call this so the host side runs exactly as a direct `setStatus` would.
   */
  applyStatus(status: AgentStatus): void
  /** Whether the transcript renders reasoning blocks. */
  showReasoning(): boolean
  /** Current tool-card visibility phase. */
  toolsVisibility(): ToolCardVisibility
  /**
   * Spinner tick with work in flight: drive the host-owned working line with
   * the frame, the active status origin, the pending call's label, and the
   * streamed-token/stall extras, then redraw.
   */
  onSpinnerFrame(
    running: boolean,
    startedAt: number | undefined,
    label: string | undefined,
    frame: string,
    extras: { verb: string; emittedTokens: number; lastOutputAt?: number },
  ): void
  /** Spinner tick with nothing in flight: hide the working line and redraw. */
  onSpinnerIdle(): void
  /**
   * Agent-level error observed on the event stream: the host retains it for
   * its live-error set and appends the durable notice.
   */
  onAgentError(stepKey: string, error: unknown): void
  /** The channel's agent left the registry; the host marks itself disposed. */
  onAgentDisposed(): void
}

/** One session's chat channel as seen by its host chrome. */
export interface SessionChannel {
  /** Transcript container the host mounts once in its chrome. */
  readonly chat: TranscriptContainer
  /** Todo strip component (mounted by the host inside `todoContainer`). */
  readonly todo: TodoComponent
  /** Live token totals for the prompt footer and diagnostics. */
  tokens(): SessionTokenTotals
  /** Whether a turn is currently running (spinner/working-line input). */
  isRunning(): boolean
  /** Whether a compaction is live (working-line input). */
  isCompacting(): boolean
  /** Rolling output speed for the current model step. */
  liveTokenRate(): number | undefined
  /** Render clock of the running turn's start (working-line input). */
  runningStartedAt(): number | undefined
  /** Render clock of the live compaction's start, when one runs. */
  compactingStartedAt(): number | undefined
  /** The live phase glyph the fade-out should show; feeds the running seed. */
  noteRenderedStatusGlyph(glyph: string | undefined): void
  /**
   * Fade envelope for the prompt caret: the running/compaction fade-in when a
   * glyph is active, else the running fade-out, else `undefined`.
   */
  statusGlyphEnvelope(
    glyph: string | undefined,
    renderTime: number,
  ): { glyph: string; level: number } | undefined
  /** Re-apply the current visibility phase to cards, groups, and context cards. */
  applyToolsVisibility(visibility: ToolCardVisibility): void
  /** Steering submissions not yet claimed or discarded (prompt badge). */
  pendingSteeringCount(): number
  /**
   * The process-wide spinner tick body: animate the newest pending card and
   * derive the working-line frame. The host owns the interval so teardown
   * stays single-owner; it calls this each tick.
   */
  readonly tickSpinner: (frame: string) => void
  /** Register the channel's session-scoped `ctx` listeners. */
  attach(): void
  /** Unregister the listeners `attach` registered. */
  detach(): void
  /** Render one session event into the transcript. */
  renderEvent(event: SessionEvent, options: { addHistory: boolean; renderChunks: boolean; trackLive: boolean }): void
  /** Re-derive the whole transcript from the session log. */
  rebuildTranscript(populateHistory: boolean): void
  /**
   * The channel half of the status state machine (running/fading glyphs,
   * progress bit); the host's `setStatus` wraps it with editor chrome.
   */
  setStatus(status: AgentStatus): void
  /** Invalidate the live streaming component and redraw (steering badge edges). */
  refreshStatus(): void
  /** Drop every status indicator, including a live compaction bracket. */
  clearStatus(): void
  /** Whether the session log carries at least one compaction checkpoint. */
  hasCompactionCheckpoint(): boolean
  /** Track a steering submission until it is claimed or discarded. */
  addPendingSteering(id: MessageId): void
  /** Label of the tool card a pending approval asks about. */
  toolCardLabel(callId: string | undefined): string | undefined
}

/**
 * Build one session's chat channel.
 * @param deps - the host chrome callbacks and shared services listed above.
 * @returns the channel handle.
 */
export function createSessionChannel(deps: SessionChannelDeps): SessionChannel {
  const { ctx, agent, resolved, palette, mdTheme } = deps
  const chat = new TranscriptContainer()
  const todo = new TodoComponent(palette)
  let streaming: StreamingAssistantComponent | undefined
  let completedStreaming: StreamingAssistantComponent | undefined
  let runningStatus: RunningStatus | undefined
  let fadingStatus: FadingStatus | undefined
  /**
   * Live compaction observed by this process. Never derive this
   * state from history: a resumed log may contain a stale orphaned start.
   */
  let compacting: {
    turn: number | null
    startedAt: number
    /**
     * Whether the compaction needs the shared status tick: standalone work
     * animates on its own, while a turn-owned compaction rides the turn's
     * running status.
     */
    ownsTimer: boolean
  } | undefined
  // TUI steering submissions that the inbox has not yet claimed or discarded.
  // Correlation ids avoid guessing whether a running-state submission actually
  // joined steering or fell back to the queued-turn FIFO during turn close.
  const pendingSteering = new Set<MessageId>()
  const tokens = sessionTokens(agent.session)
  const toolCards = new Map<string, ToolCardComponent>()
  const allToolCards = new Set<ToolCardComponent>()
  /** Every collapsed tool group in the transcript, for visibility and animation passes. */
  const toolGroups = new Set<CollapsedToolGroupComponent>()
  /**
   * The run of adjacent foldable calls currently accumulating toward a group:
   * `cards` holds the member cards (which render standalone in the chat until
   * the run reaches {@link TOOL_GROUP_MIN_CARDS}), `component` the group row
   * that replaced them once it does.
   */
  let openToolGroup: {
    cards: ToolCardComponent[]
    component: CollapsedToolGroupComponent | undefined
  } | undefined
  const contextCards = new Set<ContextCardComponent>()

  const renderStatus = (): void => {
    streaming?.invalidate()
    deps.requestRender()
  }

  /**
   * The channel's one status-animation timer. The running turn, the fade-out,
   * and a standalone compaction each need the same 50 ms re-render tick, so
   * one interval dispatches to whichever state is live instead of each owning
   * a timer (previously three `setInterval` sites with entangled lifecycles).
   */
  let statusTimer: ReturnType<typeof setInterval> | undefined

  /** One shared-tick frame: retire an expired fade-out, then re-render. */
  const statusTick = (): void => {
    if (fadingStatus !== undefined && deps.now() - fadingStatus.endedAt >= STATUS_FADE_MS) clearTurnStatus()
    renderStatus()
  }

  /** Start the shared tick while any status state needs it; stop it when none does. */
  const syncStatusTimer = (): void => {
    const needed = runningStatus !== undefined || fadingStatus !== undefined
      || (compacting !== undefined && compacting.ownsTimer)
    if (needed && statusTimer === undefined) {
      statusTimer = setInterval(statusTick, STATUS_ANIMATION_INTERVAL_MS)
    } else if (!needed && statusTimer !== undefined) {
      clearInterval(statusTimer)
      statusTimer = undefined
    }
  }

  /** Drop the turn-phase running and fade-out states and re-sync the shared tick. */
  const clearTurnStatus = (): void => {
    runningStatus = undefined
    fadingStatus = undefined
    deps.terminal.setProgress(compacting !== undefined)
    syncStatusTimer()
  }

  /**
   * Hand the last active glyph to a fade-out that re-renders until it settles
   * on the `>` caret, then retires itself at the envelope's end. A hard clear
   * (teardown) skips this via {@link SessionChannel.clearStatus}.
   */
  const beginFadeOut = (glyph: string): void => {
    clearTurnStatus()
    fadingStatus = { glyph, endedAt: deps.now() }
    syncStatusTimer()
  }

  const parsedTool = (event: Extract<SessionEvent, { type: 'tool/call' }>): ToolCardComponent => {
    const parsed = parseArguments(event.data.arguments)
    const card = new ToolCardComponent(
      event.data.name,
      parsed,
      ctx.tools.get(event.data.name, agent),
      resolved.maxToolOutputLines,
      resolved.maxDiffEditLength,
      palette,
      mdTheme,
      event.time,
    )
    card.setVisibility(deps.toolsVisibility())
    toolCards.set(event.data.callId, card)
    allToolCards.add(card)
    return card
  }

  /**
   * Detach one child from the chat container — the standalone cards a collapsed
   * group replaces (mirroring `removeStreaming`'s direct children splice).
   */
  const removeChatChild = (component: Component): void => {
    const index = chat.children.indexOf(component)
    if (index >= 0) chat.children.splice(index, 1)
  }

  // Working-line extras: one random fun verb per turn (seeded off the turn
  // number so the word stays stable within a turn), streamed-token estimate
  // (chars/4) for the status segment, and the last stream output time for
  // the stall warning.
  const verbBase = Date.now() % 997
  let streamedChars = 0
  let lastOutputAt: number | undefined
  const liveTokenRate = new LiveTokenRate()

  const removeStreaming = (current: StreamingAssistantComponent | undefined): void => {
    if (current === undefined) return
    const index = chat.children.indexOf(current)
    /* v8 ignore next -- streaming components are retained only while attached to the chat. */
    if (index >= 0) chat.children.splice(index, 1)
  }

  const clearStreaming = (): void => {
    removeStreaming(streaming)
    streaming = undefined
  }

  const retractFailedStreaming = (): void => {
    removeStreaming(streaming ?? completedStreaming)
    streaming = undefined
    completedStreaming = undefined
  }

  const startAssistantStep = (position: StepPosition, startedAt?: number): void => {
    streaming = new StreamingAssistantComponent(
      position,
      deps.showReasoning(),
      palette,
      mdTheme,
      resolved.maxMessageLines,
      deps.now,
    )
    streaming.markStart(startedAt)
  }

  const attachStreaming = (): void => {
    if (streaming === undefined || chat.children.includes(streaming)) return
    chat.addChild(streaming)
  }

  const renderEvent = (
    event: SessionEvent,
    options: {
      addHistory: boolean
      renderChunks: boolean
      trackLive: boolean
    },
  ): void => {
    // Foldable grouping: a run of adjacent low-signal calls ends at any event
    // that renders something else or moves the conversation along. A
    // `tool/result` inserts no component of its own (results flow into the
    // existing cards), so it keeps the run open — a batch's calls land
    // consecutively and their results follow without breaking the group they
    // formed.
    if (
      event.type !== 'tool/result'
      && !(event.type === 'tool/call' && FOLDABLE_TOOLS.has(event.data.name))
    ) {
      openToolGroup = undefined
    }
    switch (event.type) {
      case 'user/message': {
        // Injected context (plugin/goal source) renders as a dim context card,
        // not a human bubble; only a direct human prompt is a user message. The
        // boolean avoids narrowing `source`, so the label keeps its full union.
        const source = event.data.source
        if (source.kind !== 'user') {
          const references = sessionReferenceCard(event.data.source)
          if (references !== undefined) {
            chat.addChild(new Spacer(1))
            chat.addChild(new Text(palette.dim(`Referenced sessions · ${references.map(displayText).join(', ')}`), 0, 0))
            break
          }
          const text = contentText(event.data.content).trim()
          /* v8 ignore next -- context events with empty content are rejected by their owning producers. */
          if (text) {
            // The tui type view lacks plugin-augmented source kinds (e.g. goal),
            // so read the display label without narrowing on `kind`. The session
            // log is a durable/replay boundary: a corrupt or foreign injected
            // source may not match the typed shape, so fall back to `context`.
            const labelled = source as { kind?: unknown; plugin?: unknown }
            const label = typeof labelled.plugin === 'string' ? labelled.plugin
              : typeof labelled.kind === 'string' ? labelled.kind
                : 'context'
            const card = new ContextCardComponent(label, text, resolved.maxToolOutputLines, palette)
            card.setExpanded(deps.toolsVisibility() === 'expanded')
            contextCards.add(card)
            chat.addChild(new Spacer(1))
            chat.addChild(card)
          }
          break
        }
        const text = displayText(contentText(event.data.content).trim())
        const images = event.data.content
          .filter((block): block is Extract<ContentBlock, { type: 'image' }> => block.type === 'image')
          .map(block => block.attachment)
        if (text || images.length > 0) {
          // Message-level spacing: two blank rows set a user bubble apart from
          // the previous block; turn-internal gaps stay at one row.
          chat.addChild(new Spacer(2))
          chat.addChild(new UserMessageComponent(text, palette, images, ref => deps.loadAttachmentImage(ref)))
          if (options.addHistory && text) deps.addToEditorHistory(text)
        }
        break
      }
      case 'step/start':
        if (options.trackLive) liveTokenRate.begin()
        startAssistantStep(event.data, event.time)
        break
      case 'assistant/chunk': {
        const chunk = event.data.chunk
        if (options.trackLive) {
          const output = chunk.type === 'text-delta' || chunk.type === 'reasoning-delta'
            ? chunk.text
            : chunk.type === 'tool-call-delta' ? chunk.argumentsDelta : undefined
          if (output !== undefined) {
            streamedChars += output.length
            liveTokenRate.record(output, deps.now())
            lastOutputAt = deps.now()
          }
          if (chunk.type === 'finish') liveTokenRate.end()
        }
        if (options.renderChunks && streaming !== undefined) {
          attachStreaming()
          streaming.update(event.data.chunk, event.time)
        }
        break
      }
      case 'assistant/message':
        completedStreaming = undefined
        // A settled component stays attached but never absorbs a later message
        // of the same step; both the live and replay paths start a new one.
        if (streaming === undefined || streaming.isSettled() || !chat.children.includes(streaming)) {
          startAssistantStep(event.data, event.time)
        }
        if (streaming !== undefined) {
          attachStreaming()
          streaming.settle(event.data.message.content, event.time)
        }
        if (options.trackLive) liveTokenRate.end()
        break
      case 'llm/retry': {
        if (options.trackLive) liveTokenRate.begin()
        retractFailedStreaming()
        const retryLimit = event.data.mode === 'always' ? '∞' : String(event.data.maxRetries)
        deps.appendNotice(
          `Retrying model request (${event.data.retry}/${retryLimit}) in ${event.data.delayMs}ms: ${event.data.failure.message}`,
          'warning',
        )
        break
      }
      // No external Spacer for tool cards: the card renders its own leading
      // gap, so the hidden state removes the row and the gap together.
      case 'tool/call': {
        const card = parsedTool(event)
        if (!FOLDABLE_TOOLS.has(event.data.name)) {
          chat.addChild(card)
          break
        }
        const group = openToolGroup
        if (group === undefined) {
          chat.addChild(card)
          openToolGroup = { cards: [card], component: undefined }
          break
        }
        group.cards.push(card)
        if (group.component === undefined) {
          // Below the threshold the run renders as standalone cards; the call
          // that reaches it swaps the whole run for one group row.
          chat.addChild(card)
          if (group.cards.length < TOOL_GROUP_MIN_CARDS) break
          for (const member of group.cards) removeChatChild(member)
          const component = new CollapsedToolGroupComponent(group.cards, palette)
          component.setVisibility(deps.toolsVisibility())
          toolGroups.add(component)
          chat.addChild(component)
          group.component = component
        } else {
          group.component.add(card)
        }
        break
      }
      case 'tool/result': {
        lastOutputAt = event.time
        const callId = event.data.message.source.callId
        let card = toolCards.get(callId)
        if (card === undefined) {
          card = new ToolCardComponent(
            'tool',
            { value: {}, valid: true },
            undefined,
            resolved.maxToolOutputLines,
            resolved.maxDiffEditLength,
            palette,
            mdTheme,
            event.time,
          )
          card.setVisibility(deps.toolsVisibility())
          chat.addChild(card)
          allToolCards.add(card)
          // The orphan fallback is its own card component, so a following
          // foldable call must not join a run across it.
          openToolGroup = undefined
        }
        card.updateResult(event.data, event.time)
        toolCards.delete(callId)
        // A member's result changes every group summary that reads it (settled
        // glyph, pending hint); drop their cached rows.
        for (const group of toolGroups) group.refresh()
        break
      }
      case 'todo/write':
        todo.update(event.data.todos)
        break
      case 'turn/start':
        streamedChars = 0
        lastOutputAt = undefined
        if (options.trackLive) liveTokenRate.end()
        break
      case 'session/title':
        deps.onSessionTitle(event.data.title)
        break
      case 'step/end':
        if (options.trackLive) liveTokenRate.end()
        if (streaming === undefined) startAssistantStep(event.data, event.time)
        completedStreaming = streaming
        streaming = undefined
        break
      // Every turn/end kind presents why the agent stopped: `completed` is
      // presented by the settled assistant message and its Completed timing
      // header; every other kind appends an explicit notice.
      case 'turn/end': {
        if (options.trackLive) liveTokenRate.end()
        clearStreaming()
        const reason = event.data.reason
        switch (reason.kind) {
          case 'completed':
            break
          case 'error': {
            deps.appendNotice(reason.error.message, 'error')
            break
          }
          case 'aborted':
            deps.appendNotice('Turn cancelled.', 'warning')
            break
          case 'max-tokens':
            deps.appendNotice('The model reached its output-token limit.', 'warning')
            break
          case 'interrupted':
            deps.appendNotice('The previous process ended during this turn.', 'warning')
            break
          default:
            // TurnEndReasonMap is merge-extensible: a plugin-added outcome
            // still names why the agent stopped rather than ending silently.
            deps.appendNotice(`Turn ended: ${(reason as { kind: string }).kind}.`, 'warning')
            break
        }
        break
      }
      default:
        break
    }
  }

  /**
   * Transcript row at a landed compaction boundary: one dim line naming how
   * much history folded away (Claude Code's boundary convention) instead of
   * re-rendering the replaced conversation above it.
   */
  const renderCompactionFold = (foldedMessages: number): void => {
    chat.addChild(new Spacer(1))
    chat.addChild(new Text(palette.dim(
      `⋯ ${foldedMessages} earlier message${foldedMessages === 1 ? '' : 's'} compacted ${shortcutHint('ctrl+o', 'expand')}`,
    ), 0, 0))
  }

  /** The static boundary marker one checkpoint renders in expanded replay. */
  const renderCompactionBoundary = (): void => {
    chat.addChild(new Spacer(1))
    chat.addChild(new Text(palette.dim(COMPACTION_BOUNDARY), 0, 0))
  }

  /**
   * The log index of the LAST landed compaction checkpoint, or `-1` when the
   * session never compacted. Only the last boundary matters: any earlier one
   * sits inside the range it folds.
   */
  const lastCompactCheckpointIndex = (events: readonly SessionEvent[]): number => {
    let boundary = -1
    for (const [index, event] of events.entries()) {
      if (isCompactCheckpoint(event)) boundary = index
    }
    return boundary
  }

  /** The one step whose streamed chunks are still live in a running agent. */
  const liveStep = (events: readonly SessionEvent[]): StepPosition | undefined => {
    if (agent.status !== 'running') return undefined
    let open: StepPosition | undefined
    for (const event of events) {
      if (event.type === 'step/start') open = { turn: event.data.turn, step: event.data.step }
      else if (
        event.type === 'step/end'
        && open?.turn === event.data.turn
        && open.step === event.data.step
      ) open = undefined
      else if (event.type === 'turn/end' && open?.turn === event.data.turn) open = undefined
    }
    return open
  }

  /**
   * Replay the human transcript from the append-only log. The conversation a
   * compaction replaced folds away at its last boundary (Claude Code's
   * behavior): the transcript renders only the post-boundary events plus one
   * dim fold row counting the dropped messages, while Ctrl+O's expanded phase
   * restores the full history (every checkpoint then marks its own boundary
   * row, the pre-fold layout). Everything else is append-origin and renders
   * in log order.
   *
   * The `tool/call` pairing check has no live counterpart, because only replay
   * can meet an orphan: `tool/call` carries no `surfaceOp` of its own, so it
   * inherits transcript membership from the `assistant/message` that advertised
   * it, which the live listener has necessarily just rendered. A loaded log is a
   * replay boundary, so the pairing is re-derived here instead of assumed.
   */
  const rebuildTranscript = (populateHistory: boolean): void => {
    chat.clear()
    toolCards.clear()
    allToolCards.clear()
    toolGroups.clear()
    openToolGroup = undefined
    contextCards.clear()
    streaming = undefined
    todo.update([])
    const transcriptCalls = transcriptToolCallIds(agent.session)
    const events = agent.session.events
    const activeStep = liveStep(events)
    const boundary = deps.toolsVisibility() === 'expanded' ? -1 : lastCompactCheckpointIndex(events)
    let foldedMessages = 0
    for (const [index, event] of events.entries()) {
      if (isReplacementSurfaceEvent(event)) {
        if (isCompactCheckpoint(event)) {
          // The last checkpoint owns the fold row; in expanded replay (no
          // fold, boundary -1) every checkpoint marks its own range instead.
          if (index === boundary) renderCompactionFold(foldedMessages)
          else if (boundary === -1) renderCompactionBoundary()
        }
        continue
      }
      if (index < boundary) {
        // Folded range: nothing renders, but a resumed session's prompt
        // history still learns its prompts, the way the unfolded replay did.
        if (event.type === 'user/message' && event.data.source.kind === 'user') {
          foldedMessages += 1
          const text = displayText(contentText(event.data.content).trim())
          /* v8 ignore next -- an image-only folded prompt carries no history text to learn. */
          if (populateHistory && text) deps.addToEditorHistory(text)
        }
        continue
      }
      if (event.type === 'tool/call' && !transcriptCalls.has(event.data.callId)) continue
      const renderChunks = event.type === 'assistant/chunk'
        && activeStep?.turn === event.data.turn
        && activeStep.step === event.data.step
      renderEvent(event, { addHistory: populateHistory, renderChunks, trackLive: false })
    }
    deps.requestRender()
  }

  const setStatus = (status: AgentStatus): void => {
    const priorTurn = runningStatus?.turn
    const fadeOutGlyph = status !== 'running' ? runningStatus?.lastGlyph : undefined
    if (status === 'running') clearTurnStatus()
    else if (fadeOutGlyph !== undefined) beginFadeOut(fadeOutGlyph)
    else clearTurnStatus()
    if (status !== 'running') liveTokenRate.end()
    // Running keeps the steering placeholder; idle plan mode carries its own;
    // plain idle carries the queue hint or the example-commands hint.
    if (status === 'running') {
      const turn = priorTurn ?? openTurn(agent.session.events)
      runningStatus = {
        turn,
        startedAt: deps.now(),
        // Seed with the current phase (ttft before the first step opens) so the
        // fade-out always has a glyph, even for a turn that ends before a render.
        lastGlyph: TIMING_BUCKET_GLYPHS[openStepPhase(agent.session.events) ?? 'ttft'],
      }
      // The shared tick re-renders each frame so the fading prompt phase glyph
      // animates even before the first token, when no streaming component
      // exists yet.
      syncStatusTimer()
      deps.terminal.setProgress(true)
    }
  }

  /** Hard clear: drop every indicator, including a live compaction bracket. */
  const clearStatus = (): void => {
    compacting = undefined
    liveTokenRate.end()
    clearTurnStatus()
  }

  // One process-wide spinner tick: the newest pending tool card animates its
  // braille frame, and the working line above the input mirrors the same
  // frame plus the call's verb label. While nothing pends (or the agent is
  // idle) the card update is skipped; the working line itself renders empty
  // when idle, so the tick is effectively self-gating.
  let workShown = false
  const tickSpinner = (frame: string): void => {
    let pending: ToolCardComponent | undefined
    for (const card of allToolCards) {
      if (card.isPending()) pending = card
    }
    const running = runningStatus !== undefined || compacting !== undefined
    // Idle steady state (nothing pending, nothing running): the previous tick
    // already rendered the empty line, so skip — this keeps the timer free.
    if (pending === undefined && !running) {
      settleSpinnerIdle()
      return
    }
    workShown = true
    if (pending !== undefined) pending.setSpinner(frame)
    // A collapsed group whose newest member pends animates its summary glyph.
    for (const group of toolGroups) group.setSpinner(frame)
    deps.onSpinnerFrame(running, runningStatus?.startedAt ?? compacting?.startedAt, pending?.label(), frame, {
      verb: pickSpinnerVerb(verbBase + (runningStatus?.turn ?? 0)),
      emittedTokens: Math.floor(streamedChars / 4),
      ...pending !== undefined || lastOutputAt === undefined ? {} : { lastOutputAt },
    })
  }
  const settleSpinnerIdle = (): void => {
    if (!workShown) return
    workShown = false
    deps.onSpinnerIdle()
  }

  const renderSessionEvent = (event: SessionEvent): void => {
    recordEventUsage(tokens, event)
    if (event.type === 'turn/start' && runningStatus !== undefined) runningStatus.turn = event.data.turn
    // Docks re-derive from the log: the goal bar on goal changes, the queue
    // dock on inbox-affecting events; plan-mode switches re-derive the hint.
    if (event.type === 'goal/change' || event.type === 'turn/start') deps.refreshGoalBar()
    if (event.type === 'agent/inbox/spliced' || event.type === 'user/message') deps.refreshQueueDock()
    if (event.type === 'plan/mode' || event.type === 'permission/preset') deps.applyStatus(agent.status)
    // Track live compaction state. A turn-owned compaction rides the turn's
    // status tick; standalone work (or a malformed idle turn bracket) needs
    // the shared tick for itself.
    if (event.type === 'compaction/start') {
      if (compacting === undefined) {
        const startedAt = deps.now()
        compacting = {
          turn: event.data.turn,
          startedAt,
          ownsTimer: event.data.turn === null || runningStatus === undefined,
        }
        syncStatusTimer()
        deps.terminal.setProgress(true)
      }
      deps.requestRender()
      return
    }
    if (event.type === 'compaction/end' && compacting?.turn === event.data.turn) {
      const fadeOutGlyph = runningPhaseGlyph(agent.session.events, false, true)
      compacting = undefined
      if (event.data.error !== undefined) {
        deps.appendNotice(`Compaction failed: ${event.data.error}`, 'warning')
      }
      // A concurrently running turn owns the indicator. Keep its tick and
      // progress bit instead of letting the compaction fade clear that state.
      if (runningStatus === undefined && fadeOutGlyph !== undefined) beginFadeOut(fadeOutGlyph)
      syncStatusTimer()
      deps.requestRender()
      return
    }
    // A replacement mutates only the model surface, so the rendered transcript
    // keeps what it already showed; a landed summary checkpoint folds the
    // history it replaced, so the transcript is re-derived from the log rather
    // than patched in place — the fold removes components already attached.
    if (isReplacementSurfaceEvent(event)) {
      if (isCompactCheckpoint(event)) rebuildTranscript(false)
      deps.requestRender()
      return
    }
    renderEvent(event, { addHistory: false, renderChunks: true, trackLive: true })
    deps.requestRender()
  }

  const settlePendingSteering = (id: MessageId): void => {
    if (pendingSteering.delete(id)) renderStatus()
  }

  let disposeSessionEvents: (() => void) | undefined
  let disposeDequeued: (() => void) | undefined
  let disposeDiscarded: (() => void) | undefined
  let disposeInserted: (() => void) | undefined
  let disposeStatus: (() => void) | undefined
  let disposeError: (() => void) | undefined
  let disposeAgentDisposed: (() => void) | undefined

  const channel: SessionChannel = {
    chat,
    todo,
    tokens: () => tokens,
    isRunning: () => runningStatus !== undefined,
    isCompacting: () => compacting !== undefined,
    liveTokenRate: () => liveTokenRate.rate(deps.now()),
    runningStartedAt: () => runningStatus?.startedAt ?? compacting?.startedAt,
    compactingStartedAt: () => compacting?.startedAt,
    noteRenderedStatusGlyph: (glyph) => {
      if (runningStatus !== undefined && glyph !== undefined) runningStatus.lastGlyph = glyph
    },
    statusGlyphEnvelope: (glyph, renderTime) => {
      const activeSince = runningStatus?.startedAt ?? compacting?.startedAt
      if (activeSince !== undefined && glyph !== undefined) {
        return { glyph, level: Math.min(1, (renderTime - activeSince) / STATUS_FADE_MS) }
      }
      if (fadingStatus !== undefined) {
        return {
          glyph: fadingStatus.glyph,
          level: Math.max(0, 1 - (renderTime - fadingStatus.endedAt) / STATUS_FADE_MS),
        }
      }
      return undefined
    },
    applyToolsVisibility: (visibility) => {
      for (const card of allToolCards) card.setVisibility(visibility)
      // Group rows ride the same cycle: hidden drops the summary, expanded lists
      // the member cards (the loop above already set their own visibility).
      for (const group of toolGroups) group.setVisibility(visibility)
      // Context cards carry injected instructions rather than tool traffic, so
      // they never hide: the hidden phase reads as their collapsed preview.
      for (const card of contextCards) card.setExpanded(visibility === 'expanded')
      todo.setExpanded(visibility === 'expanded')
    },
    pendingSteeringCount: () => pendingSteering.size,
    tickSpinner,
    attach(): void {
      disposeSessionEvents = ctx.on('session/event', (session, event) => {
        if (session !== agent.session) return
        if (event.type === 'tool/result') deps.onToolResult()
        renderSessionEvent(event)
      })
      disposeDequeued = ctx.on('agent/inbox/claimed', ({ agent: source, message }) => {
        if (source !== agent) return
        settlePendingSteering(message.id)
        deps.refreshQueueDock()
      })
      disposeDiscarded = ctx.on('agent/inbox/discarded', ({ agent: source, message }) => {
        if (source !== agent) return
        if (pendingSteering.delete(message.id)) renderStatus()
        deps.refreshQueueDock()
      })
      disposeInserted = ctx.on('agent/inbox/inserted', ({ agent: source }) => {
        if (source === agent) deps.refreshQueueDock()
      })
      disposeStatus = ctx.on('agent/status', ({ agent: source, status }) => {
        if (source !== agent) return
        // Leaving 'running' ends the turn's status line; clear any badge so the
        // next running turn starts from zero (and a cancellation, which discards
        // the queue without logging drains, cannot strand a stale count).
        if (status !== 'running') pendingSteering.clear()
        deps.applyStatus(status)
      })
      disposeError = ctx.on('agent/error', ({ agent: source, turn, step, error }) => {
        if (source !== agent) return
        deps.onAgentError(`${turn}:${step}`, error)
      })
      disposeAgentDisposed = ctx.on('agent/disposed', ({ agent: source }) => {
        if (source !== agent) return
        // The agent left the registry (e.g. an agent-loop-only reload) while the
        // TUI stays mounted. Retained agents accept deliveries after detachment, so
        // without this a later send would drive a zombie agent/session; the host
        // marks itself disposed so dispatchMessage reports it instead.
        // The hard clear also retires live compaction. A later compact/end is
        // intentionally presentation-silent: this disposal notice owns the
        // terminal outcome, and no animation may survive agent detachment.
        clearStatus()
        deps.onAgentDisposed()
      })
    },
    detach(): void {
      disposeSessionEvents?.()
      disposeDequeued?.()
      disposeDiscarded?.()
      disposeInserted?.()
      disposeStatus?.()
      disposeError?.()
      disposeAgentDisposed?.()
      disposeSessionEvents = undefined
      disposeDequeued = undefined
      disposeDiscarded = undefined
      disposeInserted = undefined
      disposeStatus = undefined
      disposeError = undefined
      disposeAgentDisposed = undefined
    },
    renderEvent,
    rebuildTranscript,
    setStatus,
    refreshStatus: renderStatus,
    clearStatus,
    hasCompactionCheckpoint: () => lastCompactCheckpointIndex(agent.session.events) >= 0,
    addPendingSteering: (id) => {
      pendingSteering.add(id)
      renderStatus()
    },
    toolCardLabel: callId => callId === undefined ? undefined : toolCards.get(callId)?.label(),
  }
  return channel
}
