import { execFile } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { gitBranch, workspaceLabel } from '../src/chat/helpers.ts'

vi.mock('node:child_process', () => ({
  execFile: vi.fn((
    _file: string,
    _args: string[],
    _options: object,
    callback: (error: Error | null, stdout: string) => void,
  ) => { callback(null, 'main\n') }),
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('chat helpers', () => {
  it('scrubs ambient credentials and DSH names from the Git child', async () => {
    vi.stubEnv('TUI_TEST_PASSWORD', 'ambient-password')
    vi.stubEnv('DSH_TUI_TEST_FLAG', 'ambient-harness-state')
    await expect(gitBranch('/workspace')).resolves.toBe('main')
    const call = vi.mocked(execFile).mock.calls[0] as unknown as [
      string,
      string[],
      { env: NodeJS.ProcessEnv },
    ]
    expect(call[0]).toBe('git')
    expect(call[1]).toEqual(['branch', '--show-current'])
    expect(call[2].env).not.toHaveProperty('TUI_TEST_PASSWORD')
    expect(call[2].env).not.toHaveProperty('DSH_TUI_TEST_FLAG')
  })

  it('derives the workspace leaf name from a working directory', () => {
    expect(workspaceLabel('/workspace/project')).toBe('project')
    expect(workspaceLabel('D:\\work\\deepseekharness')).toBe('deepseekharness')
    expect(workspaceLabel('/workspace/project/')).toBe('project')
    expect(workspaceLabel('/')).toBe('/')
  })
})
