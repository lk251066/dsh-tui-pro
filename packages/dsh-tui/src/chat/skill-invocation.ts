/**
 * Manual `/skill <name> [instructions]` parsing and model-visible rendering for
 * the terminal front door.
 * @module @deepseek-ai/dsh-tui/chat/skill-invocation
 */

import { assertNever } from '@deepseek-ai/dsh-llm'
import type { SkillDefinition, SkillResourceBase } from '@deepseek-ai/dsh-skill'

/** Parsed `/skill <name> [instructions]` arguments; `name` is empty when no argument was typed. */
export interface ParsedSkillArguments {
  /** Skill name typed as the first argument. */
  name: string
  /** Trimmed text after the name; empty when none was typed. */
  instructions: string
}

/**
 * Split `/skill` arguments into the exact skill name and trailing instructions.
 * @param rawInput - raw text after the `/skill` command name.
 * @returns the skill name and any trailing instructions.
 */
export function parseSkillArguments(rawInput: string): ParsedSkillArguments {
  const rest = rawInput.trim()
  const separatorIndex = rest.search(/\s/u)
  if (separatorIndex === -1) return { name: rest, instructions: '' }
  return { name: rest.slice(0, separatorIndex), instructions: rest.slice(separatorIndex + 1).trim() }
}

/** Model-visible line locating a manually invoked skill's relative resources, or `undefined` when the provider has no base. */
function skillResourceReference(base: SkillResourceBase | undefined): string | undefined {
  if (base === undefined) return undefined
  switch (base.kind) {
    case 'directory':
      return `References in this skill are relative to ${base.path}.`
    case 'url':
      return `References in this skill are relative to ${base.url}.`
    case 'opaque':
      return base.description
    default:
      return assertNever(base, 'SkillResourceBase.kind')
  }
}

/**
 * Render a manually invoked skill into the model-visible user-message text. The
 * `<skill>` block carries the body and, when the provider supplies one, its
 * resource base; the trimmed `instructions` follow the block as the user's
 * request for this turn. The name is registry-validated kebab-case
 * (the skill registry rejects any other) and the resource base is trusted
 * same-process provider prose, so — unlike the model-facing `dsh-tool-skill`
 * result, which escapes for a tool channel — this user turn is assembled raw.
 * @param skill - the loaded skill definition.
 * @param instructions - trimmed text typed after `/skill <name>`; empty when absent.
 * @returns the user-message text delivered to the agent.
 */
export function renderSkillInvocation(skill: SkillDefinition, instructions: string): string {
  const lines = [`<skill name="${skill.name}">`]
  const reference = skillResourceReference(skill.resourceBase)
  if (reference !== undefined) lines.push(reference, '')
  lines.push(skill.content, '</skill>')
  const block = lines.join('\n')
  return instructions === '' ? block : `${block}\n\n${instructions}`
}
