/**
 * Unified session selector for the interactive chat channel: active-session
 * switching, workspace membership, persisted history, and resume handoff.
 * @module @deepseek-ai/dsh-tui/chat/resume
 */

import { stat } from 'node:fs/promises'
import type { TUI } from '@earendil-works/pi-tui'
import type { Agent, AgentStatus } from '@deepseek-ai/dsh-agent'
import { errorChain } from '@deepseek-ai/dsh-llm'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-session-projection'
import type { SessionProjectionCache } from '@deepseek-ai/dsh-session-projection-cache'
import type {} from '@deepseek-ai/dsh-session-title'
import type {
  SessionQueryEngine,
  SessionRecord,
} from '@deepseek-ai/dsh-session-query'
import type { HintEditor } from './helpers.ts'
import { formatCwd } from './helpers.ts'
import type { TuiOverlaySession } from '../extension/types.ts'
import type { TuiRuntime } from '../runtime.ts'
import { ASSISTANT_SESSION_ID } from './assistant.ts'
import type { WorkspaceSessions } from './workspace-sessions.ts'
import {
  ResumePicker,
  summarizeResumeCandidate,
  type ResumeCandidate,
} from '../components/dialogs.ts'
import type { ChannelNotice, ChatChannelDeps } from './channel.ts'

/** Collaborators the resume controller needs from the chat channel. */
export interface ResumeControllerDeps extends ChatChannelDeps, ChannelNotice {
  readonly agent: Agent
  readonly runtime: TuiRuntime
  /**
   * The optional session-query service, re-read at each use. `sessionQuery` is
   * mounted by an independent plugin, and a flat config tree gives no ordering
   * guarantee between it and this front door, so a value captured once at
   * construction can be `undefined` even though the service arrives moments later.
   */
  readonly sessionQuery: (this: void) => SessionQueryEngine | undefined
  readonly ui: TUI
  readonly editor: HintEditor
  /** Durable active-workspace membership. */
  readonly workspaceSessions: WorkspaceSessions
  /** Switch or adopt a session already live in this process. */
  openLive(sessionId: SessionId): boolean
  /** Resume and adopt a stopped session when its tools share this process workspace. */
  openPersisted(sessionId: SessionId, cwd: string): Promise<boolean>
  /** Current agent status, re-read at each resume precondition point. */
  agentStatus(): AgentStatus
}

/** Session-resume controller for one chat channel. */
export interface ResumeController {
  /** Open the unified searchable active-workspace and history selector. */
  showSessions(): void
  /** Open one active session directly, using an in-process switch or host handoff. */
  openSession(sessionId: SessionId): void
}

/**
 * Build the session-resume controller for one chat channel.
 * @param deps - channel collaborators, terminal handles, and optional services.
 * @returns the controller wired to the `/sessions` command.
 */
export function createResumeController(deps: ResumeControllerDeps): ResumeController {
  const {
    ctx, runtime, resolved, palette, overlayManager,
    sessionQuery, ui, editor, workspaceSessions,
  } = deps
  /**
   * The agent resume preflights against, re-read per use: a multi-session
   * host routes `deps.agent` to the currently mounted slot, so the idle gate,
   * the flush, and the workspace scope always speak about the session on
   * screen, not the one this process started on.
   */
  const agent = (): Agent => deps.agent
  let resumeOverlay: TuiOverlaySession | undefined
  let resumeInFlight = false
  let sessionOpenInFlight = false
  let resumeScan = 0

  /** Label any session's own workspace the way the prompt labels the current one. */
  const workspaceLabel = (cwd: string | undefined): string =>
    runtime.formatCwd?.(cwd) ?? formatCwd(cwd)

  /** Summarize one record from metadata and its batch-folded title. */
  const summarize = (
    record: SessionRecord,
    title: string | undefined,
    lastActivityAt: number | undefined,
  ): ResumeCandidate => summarizeResumeCandidate(
    record,
    title,
    lastActivityAt,
    agent().session.id,
    agent().session.header.cwd,
    workspaceLabel,
    workspaceSessions.has(record.header.id),
    record.header.id === ASSISTANT_SESSION_ID,
  )

  /** The disabled fallback row for a session whose title read failed. */
  const unreadableCandidate = (
    record: SessionRecord,
    lastActivityAt: number | undefined,
    error: unknown,
  ): ResumeCandidate => ({
    record,
    title: 'Unreadable session',
    lastActivityAt: lastActivityAt ?? record.header.createdAt,
    currentWorkspace: record.header.cwd === agent().session.header.cwd,
    workspaceLabel: workspaceLabel(record.header.cwd),
    activeWorkspace: workspaceSessions.has(record.header.id),
    assistant: record.header.id === ASSISTANT_SESSION_ID,
    current: record.header.id === agent().session.id,
    disabledReason: `session cannot be loaded: ${errorChain(error)}`,
  })

  /**
   * Metadata-only activity time: a live session's last in-memory event time,
   * otherwise the persisted artifact's mtime. Never reads a log, so browsing
   * cost stays independent of log size; any append (including bookkeeping)
   * moves it.
   */
  const lastActivityAt = async (record: SessionRecord): Promise<number | undefined> => {
    const live = ctx.sessions.get(record.header.id)
    if (live !== undefined) return live.events.at(-1)?.time
    const location = ctx.get('sessionPersistence')?.locate(record.header)
    if (location === undefined) return undefined
    try {
      return (await stat(location.path)).mtimeMs
    } catch {
      // Only a just-deleted or never-materialized artifact fails stat; the row falls back to created-at.
      return undefined
    }
  }

  /**
   * One persisted row's title through the projection-cache ladder: the
   * zero-I/O checkpoint row when usable, otherwise a cold read that folds
   * only the log tail since the checkpoint and writes the refreshed row
   * back — so a store scanned once serves later scans without log reads.
   */
  const projectedTitle = async (
    cache: SessionProjectionCache,
    record: SessionRecord,
    signal: AbortSignal,
  ): Promise<string | null | undefined> => {
    const live = ctx.sessions.get(record.header.id)
    if (live !== undefined) return ctx.get('sessionProjections')?.snapshot(live).values.title
    const cached = cache.cachedSnapshot(record.header)
    if (cached !== undefined && 'title' in cached.values) return cached.values.title
    return (await cache.coldSnapshot(record.header.id, signal)).values.title
  }

  /** One per-record title resolution: a title (absent for untitled) or an isolated failure. */
  type TitleResolution = { title?: string; failure?: unknown }

  /**
   * Resolve every row's title without reading whole logs when the projection
   * cache is mounted (live registry snapshot / checkpoint row / tail-only
   * cold read, bounded by `resumeScanConcurrency`); a composition without
   * the cache falls back to one bounded raw-log title batch.
   */
  const resolveTitles = async (
    listQuery: SessionQueryEngine,
    records: readonly SessionRecord[],
    signal: AbortSignal,
  ): Promise<TitleResolution[]> => {
    const cache = ctx.get('sessionProjectionCache')
    if (cache === undefined) {
      const results = await listQuery.readTitleSnapshots(records.map(record => record.header.id), signal)
      return records.map((record, index): TitleResolution => {
        const result = results[index]
        /* v8 ignore next 2 -- readTitleSnapshots returns one result per unique listed id in input order */
        if (result === undefined || result.sessionId !== record.header.id) throw new Error(`resume scan misaligned at "${record.header.id}"`)
        if (result.status === 'rejected') return { failure: result.reason }
        const title = result.value.title?.title
        return title === undefined ? {} : { title }
      })
    }
    const resolutions = new Array<TitleResolution>(records.length)
    let cursor = 0
    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor
        if (index >= records.length) return
        cursor += 1
        const record = records[index] as SessionRecord
        try {
          const value = await projectedTitle(cache, record, signal)
          resolutions[index] = typeof value === 'string' ? { title: value } : {}
        } catch (failure: unknown) {
          resolutions[index] = { failure }
        }
      }
    }
    await Promise.all(Array.from(
      { length: Math.min(resolved.resumeScanConcurrency, records.length) },
      () => worker(),
    ))
    return resolutions
  }

  /** The latest logged provider/model route, for the preflight availability check. */
  const resumeRoute = (events: readonly SessionEvent[]): { provider: string; model: string } | undefined => {
    const header = events.findLast(item => item.type === 'request/header')
    if (header?.type === 'request/header') {
      return { provider: header.data.header.config.provider, model: header.data.header.config.model }
    }
    const assistant = events.findLast(item => item.type === 'assistant/message')
    return assistant?.type === 'assistant/message'
      ? { provider: assistant.data.message.source.provider, model: assistant.data.message.source.model }
      : undefined
  }

  /**
   * Re-read every mutable precondition immediately before terminal handoff and
   * resolve the exact identity and workspace the host will re-exec into. This
   * is where the one chosen log is fully read, replay-validated, and checked
   * for a currently-available route — the listing never does any of that.
   */
  const preflightResume = async (sessionId: SessionId): Promise<{ id: SessionId; cwd: string }> => {
    const query = sessionQuery()
    /* v8 ignore start -- showResume alone calls this after proving the optional service exists */
    if (query === undefined) throw new Error('Resume is unavailable: session query is not mounted.')
    /* v8 ignore stop */
    const initialStatus = deps.agentStatus()
    if (initialStatus !== 'idle') throw new Error(`Resume requires an idle agent (status: ${initialStatus}).`)
    const record = (await query.listSessions()).find(candidate => candidate.header.id === sessionId)
    if (record === undefined) throw new Error(`Session "${sessionId}" is no longer available.`)
    const candidate = summarize(record, undefined, undefined)
    if (candidate.disabledReason !== undefined) throw new Error(candidate.disabledReason)
    let events: readonly SessionEvent[]
    try {
      events = (await query.readSession(record.header.id)).events
    } catch (error: unknown) {
      throw new Error(`session cannot be loaded: ${errorChain(error)}`)
    }
    const route = resumeRoute(events)
    if (route !== undefined && !ctx.llm.listProviders().some(provider => provider.id === route.provider)) {
      throw new Error(`session is complete, but route is currently unavailable (${route.provider}/${route.model})`)
    }
    const cwd = record.header.cwd
    /* v8 ignore next -- summarizeResumeCandidate disables a cwd-less record, so the check above already rejected it */
    if (cwd === undefined) throw new Error(`Session "${sessionId}" has no recorded workspace to resume in.`)
    const finalStatus = deps.agentStatus()
    if (finalStatus !== 'idle') throw new Error(`Resume requires an idle agent (status: ${finalStatus}).`)
    return { id: record.header.id, cwd }
  }

  const handoffResume = async (
    sessionId: SessionId,
    overlay?: TuiOverlaySession,
    preflight?: { id: SessionId; cwd: string },
  ): Promise<void> => {
    if (resumeInFlight) return
    resumeInFlight = true
    let terminalReleased = false
    try {
      const checked = preflight ?? await preflightResume(sessionId)
      const hostHandoff = runtime.handoffResume
      if (hostHandoff === undefined) {
        await overlay?.close()
        resumeOverlay = undefined
        deps.appendNotice('Session is resumable, but this host cannot hand it off in place.', 'warning')
        return
      }
      /* v8 ignore next -- shutdown during preflight invalidates an awaited service read or reaches this guard */
      if (deps.isDisposed()) return
      await ctx.sessions.flush(agent().session)
      // Disposal can run while the flush promise is pending.
      if (deps.isDisposed()) return
      if (agent().status !== 'idle') throw new Error(`Resume requires an idle agent (status: ${agent().status}).`)
      await overlay?.close()
      resumeOverlay = undefined
      await runtime.terminal.drainInput(100, 20)
      // Disposal can run while terminal draining is pending.
      if (deps.isDisposed()) return
      ui.stop()
      terminalReleased = true
      // The host re-execs into the session's own workspace: process cwd, not the
      // restored session header, is what the filesystem and shell tools resolve
      // against.
      await hostHandoff(checked.id, checked.cwd)
      throw new Error('resume host returned without replacing the process')
    } catch (error: unknown) {
      if (!deps.isDisposed()) {
        if (terminalReleased) {
          ui.start()
          ui.setFocus(editor)
          deps.appendNotice(`Resume handoff failed: ${errorChain(error)}`, 'error')
        } else {
          await overlay?.close()
          resumeOverlay = undefined
          deps.appendNotice(`Resume failed: ${errorChain(error)}`, 'error')
        }
      }
    } finally {
      resumeInFlight = false
    }
  }

  const openStoppedSession = (sessionId: SessionId, overlay?: TuiOverlaySession): void => {
    if (sessionOpenInFlight) return
    sessionOpenInFlight = true
    const open = async (): Promise<void> => {
      try {
        const checked = await preflightResume(sessionId)
        if (await deps.openPersisted(checked.id, checked.cwd)) {
          await overlay?.close()
          return
        }
        await handoffResume(checked.id, overlay, checked)
      } catch (error: unknown) {
        if (!deps.isDisposed()) {
          await overlay?.close()
          deps.appendNotice(`Session open failed: ${errorChain(error)}`, 'error')
        }
      } finally {
        sessionOpenInFlight = false
      }
    }
    void open()
  }

  const openSession = (candidate: ResumeCandidate, overlay: TuiOverlaySession): void => {
    if (candidate.current) {
      void overlay.close()
      return
    }
    if (candidate.record.live && deps.openLive(candidate.record.header.id)) {
      void overlay.close()
      return
    }
    openStoppedSession(candidate.record.header.id, overlay)
  }

  return {
    openSession(sessionId): void {
      if (sessionId === agent().session.id) return
      if (deps.openLive(sessionId)) return
      openStoppedSession(sessionId)
    },
    showSessions(): void {
      const listQuery = sessionQuery()
      if (listQuery === undefined) {
        deps.appendNotice('Resume is not available: session query is not mounted.', 'warning')
        return
      }
      const scan = ++resumeScan
      void resumeOverlay?.close()
      // The picker opens before the scan settles so the terminal stops feeding
      // the editor immediately; a queued activation (the closing predecessor
      // still holds the slot) receives an already-scanned set through
      // `scanned` instead of a loading placeholder.
      let picker: ResumePicker | undefined
      let scanned: ResumeCandidate[] | undefined
      const session = overlayManager.open({
        create: (host) => {
          picker = new ResumePicker(
            scanned,
            resolved.maxResumeOptions,
            () => Math.max(1, host.viewport.rows - 2),
            palette,
            (candidate) => { openSession(candidate, session) },
            (candidate) => {
              const toggle = async (): Promise<void> => {
                if (candidate.activeWorkspace) await workspaceSessions.remove(candidate.record.header.id)
                else await workspaceSessions.add(candidate.record.header.id)
                if (scanned !== undefined) {
                  scanned = scanned.map(item => item.record.header.id === candidate.record.header.id
                    ? { ...item, activeWorkspace: !candidate.activeWorkspace }
                    : item)
                  picker?.setCandidates(scanned)
                }
                deps.requestRender()
              }
              void toggle().catch((error: unknown) => {
                deps.appendNotice(`Workspace update failed: ${errorChain(error)}`, 'error')
              })
            },
            () => { void session.close() },
          )
          return picker
        },
        options: {
          width: resolved.questionDialogWidth,
          maxHeight: '100%',
        },
      }, 'main')
      resumeOverlay = session
      // Closing the picker — Escape, supersession, disposal — aborts the scan:
      // the borrowed-log pass over a large store must not outlive its overlay.
      const scanAbort = new AbortController()
      void session.closed.then(() => {
        scanAbort.abort()
        /* v8 ignore next -- overlay FIFO closes this session before a replacement can become the tracked resume overlay */
        if (resumeOverlay === session) resumeOverlay = undefined
      })
      deps.requestRender()
      /** Whether this scan's overlay, session generation, or TUI is gone. */
      const scanStale = (): boolean =>
        deps.isDisposed() || scan !== resumeScan || scanAbort.signal.aborted
      const scanCandidates = async (): Promise<void> => {
        // Every workspace in the store is listed; the picker owns the
        // current-workspace/all-workspaces scope split over the whole set.
        const records = await listQuery.listSessions(scanAbort.signal)
        if (scanStale()) return
        // Rows need only metadata, an mtime, and a title — resolved without
        // whole-log reads when the projection cache is mounted. A corrupt
        // neighbor degrades to one disabled row.
        const [titles, activity] = await Promise.all([
          resolveTitles(listQuery, records, scanAbort.signal),
          Promise.all(records.map(record => lastActivityAt(record))),
        ])
        const candidates = records.map((record, index) => {
          const resolution = titles[index] as TitleResolution
          return 'failure' in resolution
            ? unreadableCandidate(record, activity[index], resolution.failure)
            : summarize(record, resolution.title, activity[index])
        })
        candidates.sort((a, b) => b.lastActivityAt - a.lastActivityAt
          || a.record.header.id.localeCompare(b.record.header.id))
        if (scanStale()) return
        scanned = candidates
        picker?.setCandidates(candidates)
        deps.requestRender()
      }
      // One catch covers listing, titles, and mtimes, so a scan failure
      // cannot strand the overlay on its loading placeholder; an aborted
      // scan's rejection stays silent because the user already dismissed the
      // picker.
      void scanCandidates().catch((error: unknown) => {
        if (scanStale()) return
        void session.close()
        deps.appendNotice(`Resume session scan failed: ${errorChain(error)}`, 'error')
      })
    },
  }
}
