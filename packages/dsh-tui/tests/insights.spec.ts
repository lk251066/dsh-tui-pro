import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { agentsLines, jobsLines, settingsLines, writeExport } from '../src/chat/insights.ts'
import { createPalette } from '../src/components/theme.ts'

const plain = createPalette(false, 'dark')

describe('insight commands', () => {
  it('reads the rc.6 settings documentPath getter as a property', () => {
    let getterReads = 0
    const settings = {
      describe: () => [{ ns: 'ui', user: { theme: 'deepseek' } }],
      get documentPath() {
        getterReads += 1
        return 'C:\\Users\\test\\.dsh\\settings.json'
      },
    }
    const lines = settingsLines({ ctx: { get: () => settings }, palette: plain } as never)

    expect(getterReads).toBe(1)
    expect(lines.some(line => line.startsWith('* ui') && line.endsWith('user override'))).toBe(true)
    expect(lines).toContain('Settings file')
    expect(lines.some(line => line.includes('C:\\Users\\test\\.dsh\\settings.json'))).toBe(true)
  })

  it('groups subagent activity into a concise session summary', async () => {
    const lines = await agentsLines({
      palette: plain,
      agent: { session: { id: 'root' } },
      ctx: {
        get: () => ({
          listDescendants: () => Promise.resolve([
            { kind: 'child', id: 'one', label: 'Research', activity: 'running', mode: 'explore', depth: 1 },
            { kind: 'record', id: 'two', label: 'Archived' },
          ]),
        }),
      },
    } as never, new AbortController().signal)

    expect(lines[0]).toBe('2 subagents in this conversation')
    expect(lines).toContain('● Research · explore · depth 1')
    expect(lines).toContain('· Archived')
  })

  it('labels job columns and filters work to the active session', () => {
    const lines = jobsLines({
      palette: plain,
      agent: { session: { id: 'root' } },
      ctx: {
        get: () => ({
          list: () => [
            { id: 'build-1', status: 'running', label: 'Build package', ownerSession: 'root' },
            { id: 'other', status: 'done', label: 'Other session', ownerSession: 'other' },
          ],
        }),
      },
    } as never)

    expect(lines[0]).toBe('1 job owned by this session')
    expect(lines).toContain('State      ID             Description')
    expect(lines.join('\n')).toContain('running    build-1')
    expect(lines.join('\n')).not.toContain('Other session')
  })

  it('writes /export output to an explicitly chosen path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dsh-tui-export-'))
    const outputPath = join(directory, 'chosen.md')
    try {
      expect(writeExport(directory, { id: 'export-test', events: [] } as never, outputPath)).toBe(outputPath)
      expect(await readFile(outputPath, 'utf8')).toBe('# export-test — transcript export\n\n')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
