import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain'
import * as StorageJson from '@deepseek-ai/dsh-storage-json'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRegistry from '@deepseek-ai/dsh-tools'
import TuiMemoryService, {
  DEFAULT_MAX_MEMORIES,
  DEFAULT_MAX_TEXT_CHARS,
  DEFAULT_RECALL_MAX_CHARS,
  memoryEnabledByDefault,
  type MemoryConfig,
} from '../src/chat/memory.ts'

const roots: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function freshRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-tui-memory-'))
  roots.push(root)
  return root
}

async function harness(root: string, config: MemoryConfig = {}) {
  const ctx = new Context()
  await ctx.plugin(Storage)
  await ctx.plugin(StorageJson, { root })
  await ctx.plugin(StorageDomain, { backend: 'json' })
  await ctx.plugin(TuiMemoryService, config)
  return { ctx, memory: ctx.memory }
}

describe('TUI memory persistence', () => {
  it('uses the reviewed store, text, and recall defaults', () => {
    expect(DEFAULT_MAX_MEMORIES).toBe(200)
    expect(DEFAULT_MAX_TEXT_CHARS).toBe(2_000)
    expect(DEFAULT_RECALL_MAX_CHARS).toBe(4_000)
  })

  it('defaults the assistant on and projects off, then persists explicit overrides', async () => {
    const root = await freshRoot()
    const assistant = SessionId('assistant')
    const project = SessionId('project-session')
    expect(memoryEnabledByDefault(assistant)).toBe(true)
    expect(memoryEnabledByDefault(project)).toBe(false)

    const first = await harness(root)
    expect(first.memory.isEnabled(assistant)).toBe(true)
    expect(first.memory.isEnabled(project)).toBe(false)
    await first.memory.setEnabled(assistant, false)
    await first.memory.setEnabled(project, true)
    await first.memory.add('shared across sessions')
    await first.ctx.fiber.dispose()

    const second = await harness(root)
    expect(second.memory.isEnabled(assistant)).toBe(false)
    expect(second.memory.isEnabled(project)).toBe(true)
    expect(second.memory.search('shared').map(record => record.text)).toEqual(['shared across sessions'])
    await second.ctx.fiber.dispose()
  })

  it('applies the default text limit to Unicode code points', async () => {
    const { ctx, memory } = await harness(await freshRoot())
    await expect(memory.add('界'.repeat(DEFAULT_MAX_TEXT_CHARS))).resolves.toMatchObject({
      text: '界'.repeat(DEFAULT_MAX_TEXT_CHARS),
    })
    await expect(memory.add('界'.repeat(DEFAULT_MAX_TEXT_CHARS + 1))).rejects.toThrow('the limit is 2000')
    await ctx.fiber.dispose()
  })

  it('shares memories, enforces Unicode character limits, and evicts oldest records', async () => {
    const { ctx, memory } = await harness(await freshRoot(), {
      maxMemories: 2,
      maxTextChars: 4,
      recallMaxChars: 100,
    })
    const clock = vi.spyOn(Date, 'now')
    clock.mockReturnValueOnce(1_000)
    await memory.add('甲乙丙丁', [' PREF ', 'pref'])
    await expect(memory.add('甲乙丙丁戊')).rejects.toThrow('the limit is 4')
    clock.mockReturnValueOnce(2_000)
    await memory.add('ABCD')
    clock.mockReturnValueOnce(3_000)
    await memory.add('WXYZ')

    expect(memory.list().map(record => record.text)).toEqual(['ABCD', 'WXYZ'])
    expect(memory.search('abcd').map(record => record.text)).toEqual(['ABCD'])
    expect(memory.search('missing')).toEqual([])
    await ctx.fiber.dispose()
  })

  it('searches normalized tags and recalls complete records inside the budget', async () => {
    const { ctx, memory } = await harness(await freshRoot())
    const clock = vi.spyOn(Date, 'now')
    clock.mockReturnValueOnce(1_000)
    await memory.add('prefers dark mode', [' UI ', 'ui'])
    clock.mockReturnValueOnce(2_000)
    await memory.add('uses Chinese', ['language'])

    expect(memory.search('UI').map(record => record.text)).toEqual(['prefers dark mode'])
    expect(memory.recalledText()).toContain('- uses Chinese [language]')
    expect(memory.recalledText()).toContain('- prefers dark mode [ui]')
    expect(memory.recalledText(10)).toBe('')
    await ctx.fiber.dispose()
  })

  it('rejects invalid limits and uninitialized direct service use', async () => {
    const invalid = new Context()
    expect(() => new TuiMemoryService(invalid, { maxMemories: 0 })).toThrow('maxMemories')
    await invalid.fiber.dispose()
    const ctx = new Context()
    const raw = new TuiMemoryService(ctx)
    expect(() => raw.list()).toThrow('durable domain is not initialized')
    await expect(raw.setEnabled(SessionId('project'), true)).rejects.toThrow('durable domain is not initialized')
    await ctx.fiber.dispose()
  })
})

describe('TUI memory agent scope', () => {
  it('installs working save/search tools and removes every contribution through one disposer', async () => {
    const { ctx, memory } = await harness(await freshRoot())
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRegistry)

    const dispose = memory.installTools(ctx)
    expect(ctx.tools.schemas().map(schema => schema.name)).toEqual(['memory_save', 'memory_search'])
    expect((await ctx.systemPrompt.assemble()).sections.map(section => section.name))
      .toEqual(expect.arrayContaining(['tool:memory', 'memory:recalled']))

    const clock = vi.spyOn(Date, 'now')
    clock.mockReturnValueOnce(1_000)
    const saved = await ctx.tools.execute({
      callId: CallId('memory-save'),
      name: 'memory_save',
      arguments: { text: 'likes espresso', tags: [' Coffee '] },
      signal: new AbortController().signal,
    })
    expect(saved.isError).toBe(false)
    expect(saved.value).toMatchObject({ text: 'likes espresso', tags: ['coffee'] })
    clock.mockReturnValueOnce(2_000)
    await memory.add('owns a coffee grinder', ['coffee'])

    const searched = await ctx.tools.execute({
      callId: CallId('memory-search'),
      name: 'memory_search',
      arguments: { query: 'coffee', limit: 1 },
      signal: new AbortController().signal,
    })
    expect(searched.isError).toBe(false)
    expect(searched.value).toMatchObject({
      query: 'coffee',
      total: 2,
      results: [{ text: 'owns a coffee grinder', tags: ['coffee'] }],
    })
    expect((await ctx.systemPrompt.assemble()).sections.find(section => section.name === 'memory:recalled')?.text)
      .toContain('likes espresso')

    await dispose()
    expect(ctx.tools.schemas().map(schema => schema.name)).toEqual([])
    expect((await ctx.systemPrompt.assemble()).sections.map(section => section.name))
      .not.toEqual(expect.arrayContaining(['tool:memory', 'memory:recalled']))
    await expect(Promise.resolve(dispose())).resolves.toBeUndefined()
    await ctx.fiber.dispose()
  })

  it('keeps the shared store after one agent scope is disabled', async () => {
    const { ctx, memory } = await harness(await freshRoot())
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRegistry)
    const first = memory.installTools(ctx)
    await memory.add('survives scope disposal')
    await first()

    const second = memory.installTools(ctx)
    expect(memory.search('survives')).toHaveLength(1)
    expect((await ctx.systemPrompt.assemble()).sections.find(section => section.name === 'memory:recalled')?.text)
      .toContain('survives scope disposal')
    await second()
    await ctx.fiber.dispose()
  })
})
