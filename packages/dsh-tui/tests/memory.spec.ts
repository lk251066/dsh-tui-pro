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
  it('uses the reviewed text and recall defaults', () => {
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

  it('keeps more than 200 memories across a service restart without eviction', async () => {
    const root = await freshRoot()
    const first = await harness(root)
    for (let index = 0; index < 201; index += 1) {
      await first.memory.add(`durable memory ${String(index)}`)
    }
    expect(first.memory.list()).toHaveLength(201)
    expect(first.memory.list()[0]?.text).toBe('durable memory 0')
    await first.ctx.fiber.dispose()

    const second = await harness(root)
    expect(second.memory.list()).toHaveLength(201)
    expect(second.memory.list().at(-1)?.text).toBe('durable memory 200')
    await second.ctx.fiber.dispose()
  })

  it('returns the existing record for exact duplicate text', async () => {
    const { ctx, memory } = await harness(await freshRoot())
    const first = await memory.add('prefers concise answers', ['style'])
    const duplicate = await memory.add('prefers concise answers', ['ignored'])

    expect(duplicate).toEqual(first)
    expect(memory.list()).toEqual([first])
    await ctx.fiber.dispose()
  })

  it('updates a record in place, preserves createdAt, and advances updatedAt', async () => {
    const { ctx, memory } = await harness(await freshRoot())
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const original = await memory.add('uses light mode', ['ui'])
    clock.mockReturnValue(2_000)

    const updated = await memory.update(original.id, {
      text: 'uses dark mode',
      tags: [' UI ', 'preference'],
    })

    expect(updated).toMatchObject({
      id: original.id,
      text: 'uses dark mode',
      tags: ['ui', 'preference'],
      createdAt: 1_000,
      updatedAt: 2_000,
    })
    expect(memory.list()).toEqual([updated])
    await ctx.fiber.dispose()
  })

  it('advances updatedAt when correction happens in the same clock millisecond', async () => {
    const { ctx, memory } = await harness(await freshRoot())
    vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const original = await memory.add('old fact')

    const updated = await memory.update(original.id, { text: 'correct fact' })

    expect(updated?.createdAt).toBe(1_000)
    expect(updated?.updatedAt).toBe(1_001)
    await ctx.fiber.dispose()
  })

  it('deletes a durable memory by id', async () => {
    const { ctx, memory } = await harness(await freshRoot())
    const record = await memory.add('obsolete preference')

    await expect(memory.remove(record.id)).resolves.toBe(true)
    await expect(memory.remove(record.id)).resolves.toBe(false)
    expect(memory.list()).toEqual([])
    await ctx.fiber.dispose()
  })

  it('shares memories and enforces configured Unicode character limits', async () => {
    const { ctx, memory } = await harness(await freshRoot(), {
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

    expect(memory.list().map(record => record.text)).toEqual(['甲乙丙丁', 'ABCD', 'WXYZ'])
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
    const invalidText = new Context()
    expect(() => new TuiMemoryService(invalidText, { maxTextChars: 0 })).toThrow('maxTextChars')
    await invalidText.fiber.dispose()
    const invalidRecall = new Context()
    expect(() => new TuiMemoryService(invalidRecall, { recallMaxChars: 0 })).toThrow('recallMaxChars')
    await invalidRecall.fiber.dispose()
    const ctx = new Context()
    const raw = new TuiMemoryService(ctx)
    expect(() => raw.list()).toThrow('durable domain is not initialized')
    await expect(raw.setEnabled(SessionId('project'), true)).rejects.toThrow('durable domain is not initialized')
    await ctx.fiber.dispose()
  })
})

describe('TUI memory agent scope', () => {
  it('installs and executes all four memory tools, then removes every contribution', async () => {
    const { ctx, memory } = await harness(await freshRoot())
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRegistry)

    const dispose = memory.installTools(ctx)
    expect(ctx.tools.schemas().map(schema => schema.name)).toEqual([
      'memory_save',
      'memory_search',
      'memory_update',
      'memory_delete',
    ])
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

    clock.mockReturnValue(3_000)
    const savedId = String((saved.value as { id: string }).id)
    const updated = await ctx.tools.execute({
      callId: CallId('memory-update'),
      name: 'memory_update',
      arguments: { id: savedId, text: 'likes filter coffee', tags: [' Brew '] },
      signal: new AbortController().signal,
    })
    expect(updated.isError).toBe(false)
    expect(updated.value).toEqual({ id: savedId, text: 'likes filter coffee', tags: ['brew'] })

    const deleted = await ctx.tools.execute({
      callId: CallId('memory-delete'),
      name: 'memory_delete',
      arguments: { id: savedId },
      signal: new AbortController().signal,
    })
    expect(deleted.isError).toBe(false)
    expect(deleted.value).toEqual({ id: savedId, removed: true })
    expect(memory.search('filter coffee')).toEqual([])
    expect((await ctx.systemPrompt.assemble()).sections.find(section => section.name === 'memory:recalled')?.text)
      .toContain('owns a coffee grinder')

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
