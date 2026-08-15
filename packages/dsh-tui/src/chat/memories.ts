/**
 * The `/memories` browser: the durable memory store rendered as rows for the
 * keyboard browser dialog. Pure formatting — the command handler reads the
 * optional `ctx.memory` service and degrades to a notice when absent.
 * @module @deepseek-ai/dsh-tui/chat/memories
 */

import type { MemoryRecord } from '@deepseek-ai/dsh-memory'
import type { MemoryRowView } from '../components/dialogs.ts'

/** Rows shown when the memory plugin is not mounted in this composition. */
export const MEMORY_UNAVAILABLE_LINES = [
  'Memory is not available in this composition.',
  'Mount @deepseek-ai/dsh-memory (the tui profile does) to give the assistant long-term memory.',
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
