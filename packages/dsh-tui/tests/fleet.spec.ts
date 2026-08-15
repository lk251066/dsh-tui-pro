import { describe, expect, it } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fleetLines, FLEET_ACTIVE_MS, FLEET_MAX_ROWS } from '../src/chat/fleet.ts'
import type { InsightsDeps } from '../src/chat/insights.ts'

/** Boot the insight deps surface over controllable optional services. */
function deps(options: {
  records?: Array<{ id: string; createdAt: number; cwd?: string }>
  titles?: Record<string, string>
  live?: Record<string, number[]>
  files?: Record<string, string>
}): InsightsDeps {
  const services: Record<string, unknown> = {}
  if (options.records !== undefined) {
    services.sessionQuery = {
      listSessions: async () => options.records!.map(record => ({
        header: { id: record.id, createdAt: record.createdAt, ...(record.cwd === undefined ? {} : { cwd: record.cwd }) },
      })),
      readTitleSnapshots: async (ids: readonly string[]) => ids.map(id => ({
        sessionId: id,
        status: 'fulfilled',
        value: { title: { title: options.titles?.[id] } },
      })),
    }
  }
  if (options.live !== undefined) {
    services.sessions = {
      get: (id: string) => {
        const times = options.live?.[id]
        return times === undefined ? undefined : { events: times.map(time => ({ time })) }
      },
    }
  }
  if (options.files !== undefined) {
    services.sessionPersistence = {
      locate: (header: { id: string }) => ({ path: options.files?.[header.id] ?? '' }),
    }
  }
  return {
    ctx: {
      get: (name: string) => services[name],
      reflect: {
        _getImpl: (name: string) => services[name] === undefined
          ? undefined
          : { fiber: { state: 1 } },
      },
    },
  } as unknown as InsightsDeps
}

describe('fleet board', () => {
  it('reports the gap when the session query is not mounted', async () => {
    const lines = await fleetLines(deps({}))
    expect(lines).toEqual(['Session query is not mounted; /fleet needs the resume index.'])
  })

  it('renders most-recent-first rows with active markers, ages, and workspaces', async () => {
    const now = Date.now()
    const root = await mkdtemp(join(tmpdir(), 'dsh-fleet-'))
    try {
      const activeLog = join(root, 'active.jsonl')
      await writeFile(activeLog, '{}\n', 'utf8')
      const lines = await fleetLines(deps({
        records: [
          { id: 'idle-old', createdAt: now - 3 * 24 * 60 * 60_000, cwd: 'D:/elsewhere' },
          { id: 'main', createdAt: now - 60_000 },
          { id: 'helper', createdAt: now - 2 * 60 * 60_000 },
        ],
        titles: { main: 'Fix the build' },
        live: { helper: [now - 2 * 60 * 60_000] },
        files: {
          'idle-old': join(root, 'missing.jsonl'),
          main: activeLog,
        },
      }))
      // mtime is "now", so main is the active row despite its older header.
      expect(lines[0]).toContain('3 sessions in the store · most recent first · 1 active')
      expect(lines[1]).toBe('')
      expect(lines[2]).toContain('● Fix the build · ')
      expect(lines[2]).toContain('s ago')
      expect(lines[3]).toContain('· helper · 2h ago')
      expect(lines[4]).toContain('· idle-old · 3d ago · D:/elsewhere')
      expect(lines).toHaveLength(5)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('folds the tail beyond the row budget into one count note', async () => {
    const now = Date.now()
    const records = Array.from({ length: FLEET_MAX_ROWS + 3 }, (_, index) => ({
      id: `s${index}`,
      createdAt: now - (index + 1) * FLEET_ACTIVE_MS,
    }))
    const lines = await fleetLines(deps({ records }))
    expect(lines[0]).toContain(`${FLEET_MAX_ROWS + 3} sessions`)
    expect(lines).toHaveLength(2 + FLEET_MAX_ROWS + 1)
    expect(lines.at(-1)).toBe('… +3 older')
  })

  it('renders the empty-store state', async () => {
    const lines = await fleetLines(deps({ records: [] }))
    expect(lines[0]).toContain('0 sessions')
    expect(lines[2]).toContain('Nothing yet')
  })

  it('falls back to the header creation time when no liveness source exists', async () => {
    const now = Date.now()
    const lines = await fleetLines(deps({
      records: [{ id: 'lonely', createdAt: now - 90_000 }],
    }))
    expect(lines[2]).toContain('● lonely · 1m ago · cwd unset')
  })
})
