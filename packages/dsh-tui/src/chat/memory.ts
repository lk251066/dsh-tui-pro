/**
 * Durable user memory and per-session enablement for the TUI.
 * @module @lk251066/dsh-tui/chat/memory
 */

import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import type { Branded } from '@deepseek-ai/dsh-brand'
import { SessionId } from '@deepseek-ai/dsh-session'
import { defineDomain, domainTable, type KvTable } from '@deepseek-ai/dsh-storage-domain'
import { defineTool, type GenericCallView } from '@deepseek-ai/dsh-tools'
import s from 'schemastery'
import { z } from 'zod'

/** Maximum Unicode code points accepted in one memory. */
export const DEFAULT_MAX_TEXT_CHARS = 2_000
/** Maximum Unicode code points included in the automatic recall section. */
export const DEFAULT_RECALL_MAX_CHARS = 4_000
/** Default result limit for `memory_search`. */
export const DEFAULT_SEARCH_LIMIT = 20

const MEMORY_TOOL_GUIDANCE = [
  'You have long-term memory tools. Before answering questions about the user, call memory_search.',
  'When the user states a durable fact or preference, search before saving it. One memory is one short,',
  'self-contained fact. Update a stale memory and delete a false one instead of adding contradictions.',
].join(' ')

/** Opaque identity of one durable memory. */
export type MemoryId = Branded<'TuiMemoryId'>

/** User fact shared by every session with memory enabled. */
export interface MemoryRecord {
  readonly id: MemoryId
  readonly text: string
  readonly tags: readonly string[]
  readonly createdAt: number
  readonly updatedAt: number
}

interface MemoryRow {
  readonly text: string
  readonly tags: readonly string[]
  readonly createdAt: number
  readonly updatedAt: number
}

interface SessionSettingRow {
  readonly enabled: boolean
  readonly updatedAt: number
}

/** Deployment-varying memory limits. */
export interface MemoryConfig {
  readonly maxTextChars?: number
  readonly recallMaxChars?: number
}

const nonNegativeSafeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const normalizedTag = z.string().min(1).refine(tag => tag === tag.trim().toLowerCase(), {
  message: 'memory tag must be trimmed and lowercase',
})
const memoryRowSchema: z.ZodType<MemoryRow> = z.object({
  text: z.string().refine(text => text.trim().length > 0, {
    message: 'memory text must contain a non-whitespace character',
  }),
  tags: z.array(normalizedTag).refine(tags => new Set(tags).size === tags.length, {
    message: 'memory tags must be unique',
  }),
  createdAt: nonNegativeSafeInteger,
  updatedAt: nonNegativeSafeInteger,
}).refine(row => row.updatedAt >= row.createdAt, {
  path: ['updatedAt'],
  message: 'memory updatedAt must not precede createdAt',
})
const sessionSettingRowSchema: z.ZodType<SessionSettingRow> = z.object({
  enabled: z.boolean(),
  updatedAt: nonNegativeSafeInteger,
})

/** Shared memories and per-session switches use separate tables in one domain. */
export const tuiMemoryDomainSpec = defineDomain({
  name: 'tui_memory',
  version: 0,
  tables: {
    memories: domainTable<MemoryId, MemoryRow>(memoryRowSchema),
    session_settings: domainTable<SessionId, SessionSettingRow>(sessionSettingRowSchema),
  },
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Shared durable TUI memory service. */
    memory: TuiMemoryService
  }
}

/** Pure default policy: the fixed assistant session starts enabled. */
export function memoryEnabledByDefault(sessionId: SessionId): boolean {
  return String(sessionId) === 'assistant'
}

/** Dispose all prompt and tool registrations installed for one agent. */
export type MemoryScopeDisposer = () => void | Promise<void>

interface SaveArgs {
  readonly text: string
  readonly tags?: readonly string[]
}

interface SearchArgs {
  readonly query: string
  readonly limit?: number
}

interface UpdateArgs {
  readonly id: string
  readonly text?: string
  readonly tags?: readonly string[]
}

interface DeleteArgs {
  readonly id: string
}

/** Durable shared memory with agent-scoped tool installation. */
export class TuiMemoryService extends Service {
  static inject = ['storageDomain']

  static Config: s<MemoryConfig> = s.object({
    maxTextChars: s.number().step(1).min(1).default(DEFAULT_MAX_TEXT_CHARS),
    recallMaxChars: s.number().step(1).min(1).default(DEFAULT_RECALL_MAX_CHARS),
  })

  private memories: KvTable<MemoryId, MemoryRow> | undefined
  private sessionSettings: KvTable<SessionId, SessionSettingRow> | undefined
  private readonly maxTextChars: number
  private readonly recallMaxChars: number

  /**
   * @param ctx - Context carrying the storage-domain facility.
   * @param config - Optional memory and prompt limits.
   */
  constructor(ctx: Context, config: MemoryConfig = {}) {
    super(ctx, 'memory')
    this.maxTextChars = positiveInteger(config.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS, 'maxTextChars')
    this.recallMaxChars = positiveInteger(config.recallMaxChars ?? DEFAULT_RECALL_MAX_CHARS, 'recallMaxChars')
  }

  /** Open and own the durable memory domain. */
  protected async [Service.init](): Promise<void> {
    const domain = await this.ctx.storageDomain.open(tuiMemoryDomainSpec)
    this.ctx.effect(() => async () => { await domain.close() }, 'memory.domainClose')
    this.memories = domain.table('memories')
    this.sessionSettings = domain.table('session_settings')
  }

  /** Memories in creation order. */
  list(): readonly MemoryRecord[] {
    const records: MemoryRecord[] = []
    for (const [id, row] of this.requireMemories().entries()) records.push(snapshot(id, row))
    return records.sort(byCreation)
  }

  /**
   * Save one shared durable memory, returning the existing record for exact
   * duplicate text.
   * @param text - One self-contained fact or preference.
   * @param tags - Optional lookup tags.
   * @returns The stored immutable record.
   */
  async add(text: string, tags?: readonly string[]): Promise<MemoryRecord> {
    const normalizedText = this.validateText(text)
    const duplicate = this.list().find(record => record.text === normalizedText)
    if (duplicate !== undefined) return duplicate
    const now = Date.now()
    const id = randomUUID() as MemoryId
    const row: MemoryRow = {
      text: normalizedText,
      tags: normalizeTags(tags),
      createdAt: now,
      updatedAt: now,
    }
    await this.requireMemories().put(id, row)
    return snapshot(id, row)
  }

  /**
   * Replace one memory's text and/or tags.
   * @param id - Stable memory identity.
   * @param patch - Material fields to replace.
   * @returns The updated record, or `undefined` when the id is unknown.
   */
  async update(id: MemoryId, patch: { text?: string; tags?: readonly string[] }): Promise<MemoryRecord | undefined> {
    const table = this.requireMemories()
    const current = table.get(id)
    if (current === undefined) return undefined
    if (patch.text === undefined && patch.tags === undefined) {
      throw new Error('memory update must provide text or tags')
    }
    const text = patch.text === undefined ? current.text : this.validateText(patch.text)
    const duplicate = this.list().find(record => record.id !== id && record.text === text)
    if (duplicate !== undefined) throw new Error(`memory text already exists as ${String(duplicate.id)}`)
    const row: MemoryRow = {
      ...current,
      text,
      tags: patch.tags === undefined ? current.tags : normalizeTags(patch.tags),
      updatedAt: Math.max(Date.now(), current.updatedAt + 1),
    }
    await table.put(id, row)
    return snapshot(id, row)
  }

  /** Remove one durable memory by identity. */
  async remove(id: MemoryId): Promise<boolean> {
    return this.requireMemories().delete(id)
  }

  /**
   * Search text and tags using a case-insensitive substring.
   * @param query - Search text.
   * @param limit - Maximum returned records.
   * @returns Matches ordered by most recent update.
   */
  search(query: string, limit: number = DEFAULT_SEARCH_LIMIT): readonly MemoryRecord[] {
    const resolvedLimit = positiveInteger(limit, 'search limit')
    const needle = query.trim().toLocaleLowerCase()
    if (needle === '') return []
    return this.list()
      .filter(record => record.text.toLocaleLowerCase().includes(needle)
        || record.tags.some(tag => tag.includes(needle)))
      .sort(byRecent)
      .slice(0, resolvedLimit)
  }

  /**
   * Resolve one session's persisted switch or its assistant/project default.
   * @param sessionId - Session whose memory capability is being composed.
   * @returns Whether memory tools and automatic recall should be installed.
   */
  isEnabled(sessionId: SessionId): boolean {
    return this.requireSessionSettings().get(sessionId)?.enabled ?? memoryEnabledByDefault(sessionId)
  }

  /**
   * Persist one session's explicit memory switch.
   * @param sessionId - Session whose setting changes.
   * @param enabled - New explicit state.
   */
  async setEnabled(sessionId: SessionId, enabled: boolean): Promise<void> {
    await this.requireSessionSettings().put(sessionId, { enabled, updatedAt: Date.now() })
  }

  /**
   * Render the automatic recall section within its configured character budget.
   * @param budgetChars - Optional override used by diagnostics and tests.
   * @returns A complete prompt section, or an empty string when nothing fits.
   */
  recalledText(budgetChars: number = this.recallMaxChars): string {
    const budget = positiveInteger(budgetChars, 'recall budget')
    try {
      const header = 'Long-term memories about this user (most recent first):'
      const lines = [header]
      let used = codePointLength(header)
      for (const record of [...this.list()].sort(byRecent)) {
        const suffix = record.tags.length === 0 ? '' : ` [${record.tags.join(', ')}]`
        const line = `- ${record.text}${suffix}`
        const length = codePointLength(line) + 1
        if (used + length > budget) break
        lines.push(line)
        used += length
      }
      return lines.length === 1 ? '' : lines.join('\n')
    } catch {
      return ''
    }
  }

  /**
   * Install memory tools and prompt sections on one agent context.
   * @param agentCtx - Agent-scoped context carrying tools and system prompt.
   * @returns One disposer that removes every installed contribution.
   */
  installTools(agentCtx: Context): MemoryScopeDisposer {
    return agentCtx.effect(() => [
      agentCtx.systemPrompt.section({
        name: 'tool:memory',
        order: 101,
        text: MEMORY_TOOL_GUIDANCE,
      }),
      agentCtx.systemPrompt.section({
        name: 'memory:recalled',
        order: 50,
        text: () => this.recalledText(),
      }),
      agentCtx.tools.register(defineTool({
        name: 'memory_save',
        description: 'Save one durable fact or preference about the user to long-term memory.',
        parameters: {
          text: { type: 'string', required: true, description: 'One short, self-contained fact or preference.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Optional topic tags for later lookup.' },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', required: true },
              text: { type: 'string', required: true },
              tags: { type: 'array', items: { type: 'string' }, required: true },
            },
          },
          render: (_args, value) => [{ type: 'text', text: `Saved to memory: ${value.text}` }],
        },
        presentCall: (args): GenericCallView => ({
          card: 'generic',
          title: `Remember: ${parseSaveArgs(args).text.slice(0, 60)}`,
        }),
        isConcurrencySafe: () => false,
        execute: async (args) => {
          const input = parseSaveArgs(args)
          const record = await this.add(input.text, input.tags)
          return { id: String(record.id), text: record.text, tags: [...record.tags] }
        },
      })),
      agentCtx.tools.register(defineTool({
        name: 'memory_search',
        description: 'Search long-term memories about the user by keyword.',
        parameters: {
          query: { type: 'string', required: true, description: 'Keyword or phrase to find.' },
          limit: { type: 'number', description: `Maximum results. Defaults to ${DEFAULT_SEARCH_LIMIT}.` },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              query: { type: 'string', required: true },
              results: {
                type: 'array',
                required: true,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string', required: true },
                    text: { type: 'string', required: true },
                    tags: { type: 'array', items: { type: 'string' }, required: true },
                  },
                },
              },
              total: { type: 'integer', required: true },
            },
          },
          render: (_args, value) => [{
            type: 'text',
            text: value.results.length === 0
              ? `No memories matched "${value.query}".`
              : value.results.map((record, index) => `${String(index + 1)}. ${record.text}`).join('\n'),
          }],
        },
        presentCall: (args): GenericCallView => ({
          card: 'generic',
          title: `Search memory: ${parseSearchArgs(args).query.slice(0, 60)}`,
        }),
        isConcurrencySafe: () => true,
        execute: async (args) => {
          const input = parseSearchArgs(args)
          const query = input.query.trim()
          if (query === '') throw new Error('memory_search: query must contain a non-whitespace character')
          const all = this.search(query, Number.MAX_SAFE_INTEGER)
          const resultLimit = positiveInteger(input.limit ?? DEFAULT_SEARCH_LIMIT, 'search limit')
          const results = all.slice(0, resultLimit)
          return {
            query,
            results: results.map(record => ({
              id: String(record.id),
              text: record.text,
              tags: [...record.tags],
            })),
            total: all.length,
          }
        },
      })),
      agentCtx.tools.register(defineTool({
        name: 'memory_update',
        description: 'Correct an existing long-term memory after finding it with memory_search.',
        parameters: {
          id: { type: 'string', required: true, description: 'Memory id returned by memory_search.' },
          text: { type: 'string', description: 'Corrected self-contained fact or preference.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Replacement topic tags.' },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', required: true },
              text: { type: 'string', required: true },
              tags: { type: 'array', items: { type: 'string' }, required: true },
            },
          },
          render: (_args, value) => [{ type: 'text', text: `Updated memory: ${value.text}` }],
        },
        presentCall: (args): GenericCallView => ({
          card: 'generic',
          title: `Update memory: ${parseUpdateArgs(args).id}`,
        }),
        isConcurrencySafe: () => false,
        execute: async (args) => {
          const input = parseUpdateArgs(args)
          const record = await this.update(input.id as MemoryId, {
            ...input.text === undefined ? {} : { text: input.text },
            ...input.tags === undefined ? {} : { tags: input.tags },
          })
          if (record === undefined) throw new Error(`memory_update: unknown memory id "${input.id}"`)
          return { id: String(record.id), text: record.text, tags: [...record.tags] }
        },
      })),
      agentCtx.tools.register(defineTool({
        name: 'memory_delete',
        description: 'Delete one false or obsolete long-term memory after finding it with memory_search.',
        parameters: {
          id: { type: 'string', required: true, description: 'Memory id returned by memory_search.' },
        },
        output: {
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', required: true },
              removed: { type: 'boolean', required: true },
            },
          },
          render: (_args, value) => [{ type: 'text', text: `Deleted memory ${value.id}.` }],
        },
        presentCall: (args): GenericCallView => ({
          card: 'generic',
          title: `Delete memory: ${parseDeleteArgs(args).id}`,
        }),
        isConcurrencySafe: () => false,
        execute: async (args) => {
          const input = parseDeleteArgs(args)
          const removed = await this.remove(input.id as MemoryId)
          if (!removed) throw new Error(`memory_delete: unknown memory id "${input.id}"`)
          return { id: input.id, removed }
        },
      })),
    ], 'memory.agentScope')
  }

  private validateText(text: string): string {
    const trimmed = text.trim()
    if (trimmed === '') throw new Error('memory text must contain a non-whitespace character')
    const length = codePointLength(trimmed)
    if (length > this.maxTextChars) {
      throw new Error(`memory text is ${String(length)} characters; the limit is ${String(this.maxTextChars)}`)
    }
    return trimmed
  }

  private requireMemories(): KvTable<MemoryId, MemoryRow> {
    if (this.memories === undefined) throw new Error('memory: durable domain is not initialized')
    return this.memories
  }

  private requireSessionSettings(): KvTable<SessionId, SessionSettingRow> {
    if (this.sessionSettings === undefined) throw new Error('memory: durable domain is not initialized')
    return this.sessionSettings
  }
}

function codePointLength(value: string): number {
  return [...value].length
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`memory: ${name} must be a positive safe integer, got ${String(value)}`)
  }
  return value
}

function normalizeTags(tags: readonly string[] | undefined): readonly string[] {
  const normalized = new Set<string>()
  for (const tag of tags ?? []) {
    const value = tag.trim().toLocaleLowerCase()
    if (value !== '') normalized.add(value)
  }
  return Object.freeze([...normalized])
}

function snapshot(id: MemoryId, row: MemoryRow): MemoryRecord {
  return Object.freeze({ ...row, id, tags: Object.freeze([...row.tags]) })
}

function byCreation(left: MemoryRecord, right: MemoryRecord): number {
  return left.createdAt - right.createdAt || String(left.id).localeCompare(String(right.id))
}

function byRecent(left: MemoryRecord, right: MemoryRecord): number {
  return right.updatedAt - left.updatedAt || String(left.id).localeCompare(String(right.id))
}

function parseSaveArgs(args: unknown): SaveArgs {
  const value = args as SaveArgs
  return { text: String(value.text), ...value.tags === undefined ? {} : { tags: value.tags } }
}

function parseSearchArgs(args: unknown): SearchArgs {
  const value = args as SearchArgs
  return {
    query: String(value.query),
    ...value.limit === undefined ? {} : { limit: value.limit },
  }
}

function parseUpdateArgs(args: unknown): UpdateArgs {
  const value = args as UpdateArgs
  return {
    id: String(value.id),
    ...value.text === undefined ? {} : { text: String(value.text) },
    ...value.tags === undefined ? {} : { tags: value.tags },
  }
}

function parseDeleteArgs(args: unknown): DeleteArgs {
  return { id: String((args as DeleteArgs).id) }
}

export default TuiMemoryService
