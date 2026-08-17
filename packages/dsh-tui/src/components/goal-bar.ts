/**
 * The goal dock: a one-line strip above the prompt while a durable goal is
 * armed (the terminal counterpart of the web GoalBar), plus the Ctrl+G action
 * sheet (pause / resume / complete / clear).
 * @module @deepseek-ai/dsh-tui/components/goal-bar
 */

import {
  Key,
  SelectList,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  type Component,
  type SelectItem,
} from '@earendil-works/pi-tui'
import { renderBottomInteraction } from './dialogs.ts'
import { dialogSelectTheme, type Palette } from './theme.ts'

/** The folded-goal slice the bar renders (see `foldGoal` in dsh-goal). */
export interface GoalBarState {
  readonly objective: string
  readonly phase: 'active' | 'paused' | 'blocked' | 'complete'
  readonly maxGoalRounds?: number
  readonly roundsStarted?: number
}

/** One-line goal dock rendered above the prompt; empty while no goal is armed. */
export class GoalBarComponent implements Component {
  private state: GoalBarState | undefined

  constructor(private readonly palette: Palette) {}

  /** Replace the rendered goal; `undefined` hides the bar. */
  update(state: GoalBarState | undefined): void {
    this.state = state
  }

  invalidate(): void {}

  render(width: number): string[] {
    const state = this.state
    if (state === undefined) return []
    const phase = state.phase === 'active'
      ? this.palette.success('●')
      : state.phase === 'paused'
        ? this.palette.warning('⏸')
        : state.phase === 'blocked'
          ? this.palette.error('■')
          : this.palette.success('✓')
    const rounds = state.maxGoalRounds === undefined
      ? `round ${state.roundsStarted ?? 0}`
      : `round ${state.roundsStarted ?? 0}/${state.maxGoalRounds}`
    const prefix = `Goal ${phase} `
    const suffix = this.palette.dim(` · ${rounds} · Ctrl+G`)
    const budget = Math.max(8, width - visibleWidth(prefix) - visibleWidth(suffix))
    const objective = truncateToWidth(state.objective, budget, '…')
    return [`${this.palette.bold(this.palette.accent('Goal'))} ${phase} ${objective}${suffix}`]
  }
}

/** One Ctrl+G action over the armed goal. */
export interface GoalAction {
  readonly id: 'pause' | 'resume' | 'complete' | 'clear'
  readonly label: string
}

/**
 * The Ctrl+G goal action sheet: pause/resume/complete/clear for the armed
 * goal. Esc/Ctrl+C dismiss without acting.
 */
export class GoalActionsDialog implements Component {
  private readonly list: SelectList
  private readonly headline: string

  constructor(
    objective: string,
    actions: readonly GoalAction[],
    private readonly palette: Palette,
    private readonly run: (action: GoalAction) => void,
    private readonly close: () => void,
  ) {
    const items: SelectItem[] = actions.map(action => ({
      value: action.id,
      label: action.label,
    }))
    this.list = new SelectList(items, Math.max(1, actions.length), dialogSelectTheme(palette))
    this.list.onSelect = (item) => {
      const action = actions.find(entry => entry.id === item.value)
      if (action !== undefined) this.run(action)
      this.close()
    }
    this.list.onCancel = this.close
    this.headline = palette.dim(truncateToWidth(objective, 72, '…'))
  }

  invalidate(): void {
    this.list.invalidate()
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.ctrl('c'))) {
      this.close()
    } else {
      this.list.handleInput(data)
    }
    this.invalidate()
  }

  render(width: number): string[] {
    const innerWidth = Math.max(1, width - 4)
    return renderBottomInteraction('Goal', [
      this.headline,
      '',
      ...this.list.render(innerWidth),
      '',
      this.palette.dim('↑/↓ move • Enter run • Esc close'),
    ], width, this.palette)
  }
}
