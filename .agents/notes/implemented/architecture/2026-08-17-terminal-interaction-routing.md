# Agent Note: Terminal interaction routing

Status: implemented

Supersedes the input and session-navigation portions of `2026-08-16-terminal-workbench-layout.md`.

## Problem

The workbench needs distinct controls for immediate input, next-turn input, complete session history, current-conversation branching, and active workspace switching. Treating these actions as one history picker or one submit path makes keyboard behavior ambiguous and can apply queued context to the wrong model turn.

## Decision

While the agent is idle, Enter starts a turn. While it is running, Enter sends next-step steering and Tab queues a next-turn message. Tab does nothing for empty input, an open completion menu, a disabled submission, or another focused interaction. Empty Up recalls the most recent Enter or Tab submission. Resubmitting an unchanged message that is still queued replaces that entry. With an empty editor, Esc restores the newest queued message before it can cancel the running turn. Any session-reference context follows the queued message through recovery and is applied when that message starts a turn. `/queue` is not registered.

Double Escape opens checkpoints from the current conversation only while the agent is idle, the editor is empty, and completion is closed. Left or Escape selects an older checkpoint, Right selects a newer checkpoint, Enter creates a branch before the selected turn and replaces the source in Active, and Ctrl+C or q closes the navigator. The source log remains available through complete history. `/sessions` remains the complete-history browser and workspace-membership editor. `/quit` and empty-input `Delete` close the selected project according to [session closing and assistant conversation reads](2026-08-18-session-quit-and-assistant-conversation-reads.md).

Guarded Alt+Left and Alt+Right cycle the manually maintained active workspace sessions; `/switch` and sidebar clicks use the same activation path. A stopped session resumes in the existing TUI process using its recorded cwd. Host handoff is available only when every live agent and compaction is idle. One open request per session may run at a time. Stopped active sessions load their persisted titles before activation.

Short selections use the fixed bottom interaction area. Complete history and built-in information commands use the chat main area. The outer frame, active-workspace sidebar, status display, and editor ownership remain fixed.

## Alternatives considered

A queue dialog duplicates Tab and Up while hiding the transcript behind another interaction state. Cancelling a turn before recovering queued input risks discarding the user's next instruction. Keeping both source and branch active after rewind makes repeated rollback grow the manually maintained Active list. Using terminal-wide navigation keys without editor guards conflicts with ordinary editing and terminal encodings.

## Consequences

Input intent is determined by the key and current agent state. Checkpoint navigation cannot be confused with complete history. Session switching preserves the active-workspace model, and terminal replacement remains owned by the host. Tests cover terminal key encodings, queue ordering, recovery and replacement, delayed reference context, checkpoint replacement, duplicate-open locking, persisted titles, and fixed-frame view placement.
