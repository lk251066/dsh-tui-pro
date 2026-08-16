/**
 * The `/fleet` board: every persisted session in the store as one read-only
 * monitor row — title, workspace, last activity, and a live marker for
 * sessions that moved recently (the "probably running somewhere" signal).
 * This is the personal workstation's cross-process view: it scans the
 * durable store, so it sees sessions owned by OTHER dsh processes too.
 * @module @deepseek-ai/dsh-tui/chat/fleet
 */

import { stat } from 'node:fs/promises'
import type { InsightsDeps } from './insights.ts'
import { formatCwd } from './helpers.ts'
import { displayText } from '../components/text.ts'

/** A session counts as active when its last change is younger than this. */
export const FLEET_ACTIVE_MS = 5 * 60_000

/** Rows shown before this many sessions; the tail folds into a count note. */
export const FLEET_MAX_ROWS = 20

/** One board row's inputs: identity, title, and the last-change time. */
interface FleetEntry {
  readonly id: string
  readonly title: string
  readonly lastActivityAt: number
  readonly cwd: string | undefined
}

/** Compact relative age: `45s` / `3m` / `2h` / `4d` / a date for older. */
function formatAge(ageMs: number, now: number): string {
  const minutes = Math.floor(ageMs / 60_000)
  if (minutes < 1) return `${Math.max(0, Math.floor(ageMs / 1000))}s`
  if (minutes < 60) return `${minutes}m`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}d`
  return new Date(now - ageMs).toISOString().slice(0, 10)
}

/**
 * The board's rows: header with counts, then one row per session — an active
 * marker (●) or idle dot (·), the title (or id when untitled), the age of the
 * last change, and the workspace label. Most recent first; the tail beyond
 * {@link FLEET_MAX_ROWS} folds into one dim count note.
 * @param deps - channel collaborators (context and terminal cwd formatting).
 * @param signal - optional cancellation for the store scan.
 * @returns the rendered rows.
 */
export async function fleetLines(deps: InsightsDeps, signal?: AbortSignal): Promise<string[]> {
  // Same non-strict read discipline as the resume controller: Cordis can
  // transiently leave this sibling non-ACTIVE during command callbacks (which
  // is exactly when /fleet runs), so the fiber state is checked through the
  // reflect surface before reading.
  const implementation = deps.ctx.reflect._getImpl('sessionQuery', false)
  const query = (implementation === undefined || implementation.fiber.state >= 3)
    ? undefined
    : deps.ctx.get('sessionQuery', false) as {
      listSessions(signal?: AbortSignal): Promise<Array<{ header: { id: string; createdAt: number; cwd?: string } }>>
      readTitleSnapshots?: (ids: readonly string[], signal?: AbortSignal) => Promise<
        Array<{ sessionId: string; status: string; value?: { title?: { title?: string } } }>
      >
    } | undefined
  if (query === undefined) {
    return ['Session query is not mounted; /fleet needs the resume index.']
  }
  // A store with conflicting artifacts for one id (two process lifecycles
  // wrote the same session id without a clean handoff) fails the listing
  // wholesale — the same condition /sessions reports. Degrade to an
  // in-dialog explanation instead of a failed command.
  let records: Array<{ header: { id: string; createdAt: number; cwd?: string } }>
  try {
    records = await query.listSessions(signal)
  } catch (error) {
    return [`Session scan failed: ${String(error instanceof Error ? error.message : error)}`]
  }
  signal?.throwIfAborted()
  const titleResults = query.readTitleSnapshots === undefined
    ? []
    : await query.readTitleSnapshots(records.map(record => record.header.id), signal)
  const titles = new Map(titleResults.map(result =>
    [result.sessionId, result.status === 'fulfilled' ? result.value?.title?.title : undefined]))
  const now = Date.now()
  const entries: FleetEntry[] = []
  for (const record of records) {
    entries.push({
      id: String(record.header.id),
      title: titles.get(String(record.header.id)) ?? String(record.header.id),
      lastActivityAt: await lastActivityAt(deps, record.header.id, record.header.createdAt),
      cwd: record.header.cwd,
    })
  }
  entries.sort((left, right) => right.lastActivityAt - left.lastActivityAt)
  const active = entries.filter(entry => now - entry.lastActivityAt < FLEET_ACTIVE_MS).length
  const header = `${entries.length} session${entries.length === 1 ? '' : 's'} in the store · most recent first · ${active} active`
  if (entries.length === 0) return [header, '', 'Nothing yet — sessions land here as they persist.']
  const rows = entries.slice(0, FLEET_MAX_ROWS).map((entry) => {
    const marker = now - entry.lastActivityAt < FLEET_ACTIVE_MS ? '●' : '·'
    return `${marker} ${displayText(entry.title)} · ${formatAge(now - entry.lastActivityAt, now)} ago · ${formatCwd(entry.cwd)}`
  })
  const folded = entries.length - FLEET_MAX_ROWS
  return [header, '', ...rows, ...(folded > 0 ? [`… +${folded} older`] : [])]
}

/** Last-change time: a live session's last event, otherwise the artifact's mtime. */
async function lastActivityAt(
  deps: InsightsDeps,
  id: string,
  createdAt: number,
): Promise<number> {
  const live = deps.ctx.get('sessions', false) as {
    get?: (id: string) => { events?: Array<{ time: number }> } | undefined
  } | undefined
  const session = live?.get?.(id)
  const lastEvent = session?.events?.at(-1)?.time
  if (lastEvent !== undefined) return lastEvent
  const persistence = deps.ctx.get('sessionPersistence', false) as {
    locate?: (header: { id: string; createdAt: number }) => { path: string } | undefined
  } | undefined
  const location = persistence?.locate?.({ id, createdAt })
  if (location === undefined) return createdAt
  try {
    return (await stat(location.path)).mtimeMs
  } catch {
    return createdAt
  }
}
