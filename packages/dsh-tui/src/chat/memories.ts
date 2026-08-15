/**
 * The `/memories` browser: the durable memory store rendered as rows for the
 * keyboard browser dialog. The command handler reads a compatible optional
 * memory service and degrades to a notice when absent.
 * @module @deepseek-ai/dsh-tui/chat/memories
 */

import type { Context } from '@deepseek-ai/cordis'
import type { MemoryRowView } from '../components/dialogs.ts'

/** One memory row exposed by an optional compatible memory service. */
export interface MemoryRecord {
  readonly id: string
  readonly text: string
  readonly tags: readonly string[]
  readonly updatedAt: number
}

/** The memory operations used by the TUI when a compatible service is mounted. */
export interface CompatibleMemoryService {
  list(): readonly MemoryRecord[]
  remove(id: string): Promise<boolean>
  installTools(agentCtx: Context): void
}

/** Read the optional dynamically mounted memory service without owning its package. */
export function optionalMemory(ctx: Context): CompatibleMemoryService | undefined {
  return (ctx as unknown as { get(name: 'memory'): CompatibleMemoryService | undefined }).get('memory')
}

/** Rows shown when the memory plugin is not mounted in this composition. */
export const MEMORY_UNAVAILABLE_LINES = [
  'Memory is not available in this composition.',
  'Mount a compatible memory plugin to give the assistant long-term memory.',
]

/**
 * Map the store's records to browser rows: the label is the full text (the
 * dialog truncates to width), the detail carries tags and the updated date.
 * @param records - the store's current records.
 * @returns the browser rows in first-creation order.
 */
export function memoryRows(records: readonly MemoryRecord[]): MemoryRowView[] {
  return records.map(record => ({
    id: String(record.id),
    label: record.text,
    detail: `${record.tags.length === 0 ? '' : `[#${record.tags.join(' #')}] `}updated ${new Date(record.updatedAt).toISOString().slice(0, 16).replace('T', ' ')}`,
  }))
}
