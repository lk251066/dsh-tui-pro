import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import * as tui from '../src/index.ts'

/** Real Loader export-path guard for the namespace TUI plugin. */
describe('dsh-tui plugin export shape', () => {
  it('preserves name, inject, Config, and apply through Loader unwrapping', () => {
    expect('default' in tui).toBe(false)
    expect(typeof tui.apply).toBe('function')

    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(tui) as Record<string, unknown>
    expect(unwrapped).toBe(tui)
    expect(unwrapped.name).toBe('ui-tui')
    expect(unwrapped.inject).toEqual([
      'agents',
      'sessions',
      'commands',
      'userQuestions',
      'tools',
      'llm',
      'systemPrompt',
      'tokenMeter',
      'tuiPrompt',
      'workspaceRegistry',
      'tuiWorkspaceStartup',
    ])
    expect(unwrapped.Config).toBeDefined()
    expect(typeof unwrapped.apply).toBe('function')
  })

  it('boots the bundle through the workspace-aware project launcher', () => {
    const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(patch).toMatch(/- id: agent-loop\s+disabled: true/u)
    expect(patch).toMatch(/- id: workspace-agent-loop\s+name: '@lk251066\/dsh-tui\/workspace-agent-loop'/u)
    expect(patch).toMatch(/- id: workspace\s+name: '@deepseek-ai\/dsh-workspace'/u)
    expect(patch).not.toMatch(/sessionId: assistant/u)
  })
})
