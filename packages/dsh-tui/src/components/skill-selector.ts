/** Searchable bottom selector for user-invocable skills. */

import {
  Input,
  Key,
  SelectList,
  matchesKey,
  truncateToWidth,
  type Component,
  type SelectItem,
} from '@earendil-works/pi-tui'
import type { SkillSummary } from '@deepseek-ai/dsh-skill'
import { renderBottomInteraction } from './dialogs.ts'
import { dialogSelectTheme, type Palette } from './theme.ts'

/** Searchable skill catalog displayed in the fixed bottom interaction area. */
export class SkillSelector implements Component {
  private readonly filter = new Input()
  private skills: readonly SkillSummary[]
  private list: SelectList

  constructor(
    skills: readonly SkillSummary[],
    private readonly maxVisible: number,
    private readonly palette: Palette,
    private readonly done: (skill: SkillSummary) => void,
    private readonly cancel: () => void,
  ) {
    this.skills = skills
    this.list = this.buildList(undefined)
  }

  /** Replace catalog rows while preserving the search text and selected name when possible. */
  setSkills(skills: readonly SkillSummary[]): void {
    const selected = this.list.getSelectedItem()?.value
    this.skills = skills
    this.list = this.buildList(selected)
    this.invalidate()
  }

  private filteredSkills(): readonly SkillSummary[] {
    const query = this.filter.getValue().trim().toLocaleLowerCase()
    if (query === '') return this.skills
    return this.skills.filter(skill => [skill.name, skill.description, skill.whenToUse ?? '']
      .some(value => value.toLocaleLowerCase().includes(query)))
  }

  private buildList(selectedName: string | undefined): SelectList {
    const skills = this.filteredSkills()
    const items: SelectItem[] = skills.map(skill => ({
      value: skill.name,
      label: skill.name,
      description: `${skill.source.startsWith('project-') ? 'project' : 'user'} — ${skill.description}`,
    }))
    const list = new SelectList(items, this.maxVisible, dialogSelectTheme(this.palette))
    const selectedIndex = selectedName === undefined ? 0 : items.findIndex(item => item.value === selectedName)
    list.setSelectedIndex(Math.max(0, selectedIndex))
    list.onSelect = (item) => {
      const selected = skills.find(skill => skill.name === item.value)
      if (selected !== undefined) this.done(selected)
    }
    list.onCancel = this.cancel
    return list
  }

  invalidate(): void {
    this.filter.invalidate()
    this.list.invalidate()
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      if (this.filter.getValue() === '') this.cancel()
      else {
        this.filter.setValue('')
        this.list = this.buildList(undefined)
      }
    } else if (matchesKey(data, Key.up) || matchesKey(data, Key.down) || matchesKey(data, Key.enter)) {
      this.list.handleInput(data)
    } else {
      const previous = this.filter.getValue()
      this.filter.focused = true
      this.filter.handleInput(data)
      if (this.filter.getValue() !== previous) {
        this.list = this.buildList(this.list.getSelectedItem()?.value)
      }
    }
    this.invalidate()
  }

  render(width: number): string[] {
    const innerWidth = Math.max(1, width - 4)
    this.filter.focused = true
    const skills = this.filteredSkills()
    const filterContent = truncateToWidth(this.filter.render(innerWidth).join(''), innerWidth, '')
    return renderBottomInteraction('Select skill', [
      filterContent,
      '',
      ...skills.length === 0
        ? [this.palette.dim('  No skills match the filter')]
        : this.list.render(innerWidth),
      '',
      this.palette.dim('type to filter • ↑/↓ move • Enter select • Esc'),
    ], width, this.palette)
  }
}
