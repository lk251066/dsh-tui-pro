import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { settingsLines, writeExport } from '../src/chat/insights.ts'

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
    const lines = settingsLines({ ctx: { get: () => settings } } as never)

    expect(getterReads).toBe(1)
    expect(lines).toContain('* ui               user override')
    expect(lines.at(-1)).toContain('C:\\Users\\test\\.dsh\\settings.json')
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
