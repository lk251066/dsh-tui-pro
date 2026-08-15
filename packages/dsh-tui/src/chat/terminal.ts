/**
 * Terminal surface the chat-channel controllers write to: pi-tui's `Terminal`
 * narrowed to the one method the session channel drives (the progress bit).
 * Keeping the narrow local interface lets the channel depend on exactly what
 * it uses rather than the whole process terminal.
 * @module @deepseek-ai/dsh-tui/chat/terminal
 */

/** Write-only terminal façade for the per-session channel state machines. */
export interface TuiTerminalLike {
  /** Show or hide the terminal's busy/progress indicator. */
  setProgress(active: boolean): void
}
