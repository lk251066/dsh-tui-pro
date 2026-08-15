import { describe, expect, it } from 'vitest'
import { progressiveTitle, settledTitle } from '../src/chat/tool-verbs.ts'

describe('tool verb titles', () => {
  it('rewrites known leading verbs into their progressive form', () => {
    expect(progressiveTitle('read', { card: 'generic', title: 'Read src/index.ts' })).toBe('Reading src/index.ts')
    expect(progressiveTitle('edit', { card: 'diff', title: 'Edit packages/ui/tui/src/index.ts' })).toBe('Editing packages/ui/tui/src/index.ts')
    expect(progressiveTitle('write', { card: 'diff', title: 'Write foo.txt' })).toBe('Writing foo.txt')
    expect(progressiveTitle('todo_write', { card: 'generic', title: 'Update todo list' })).toBe('Updating todo list')
  })

  it('passes unknown leading words and empty titles through', () => {
    expect(progressiveTitle('custom', { card: 'generic', title: 'Frobnicate the widget' })).toBe('Frobnicate the widget')
    expect(progressiveTitle('custom', { card: 'generic', title: '' })).toBe('Custom')
  })

  it('headlines a terminal description and falls back to the command', () => {
    expect(progressiveTitle('bash', { card: 'terminal', title: 'git status', description: 'Check the working tree' }))
      .toBe('Check the working tree')
    expect(progressiveTitle('bash', { card: 'terminal', title: 'git status' })).toBe('Running git status')
    // A very long command truncates instead of blowing the header row.
    const long = progressiveTitle('bash', { card: 'terminal', title: 'echo ' + 'x'.repeat(200) })
    expect(long.length).toBeLessThan(70)
  })

  it('settled terminal cards render Claude-Code style Bash(command) labels', () => {
    expect(settledTitle('bash', { card: 'terminal', title: 'git status', description: 'Check the working tree' }))
      .toBe('Check the working tree')
    expect(settledTitle('bash', { card: 'terminal', title: 'git status' })).toBe('Bash(git status)')
  })

  it('settled cards keep the presenter title, result titles included', () => {
    expect(settledTitle('read', { card: 'generic', title: 'Read 3 files' })).toBe('Read 3 files')
    expect(settledTitle('custom', { card: 'generic' })).toBe('Custom')
  })
})
