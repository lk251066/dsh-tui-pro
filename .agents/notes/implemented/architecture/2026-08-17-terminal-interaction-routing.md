# Agent Note: Terminal interaction routing

Status: implemented

Supersedes the input and session-navigation portions of `2026-08-16-terminal-workbench-layout.md`.

## Problem

The workbench needs distinct controls for immediate input, next-turn input, complete session history, current-conversation branching, and active workspace switching. Treating these actions as one history picker or one submit path makes keyboard behavior ambiguous and can apply queued context to the wrong model turn.

## Decision

While the agent is idle, Enter starts a turn. While it is running, Enter sends next-step steering and Tab queues a next-turn message. Tab does nothing for empty input, an open completion menu, a disabled submission, or another focused interaction. Empty Up recalls the most recent Enter or Tab submission. Resubmitting an unchanged message that is still queued replaces that entry. Any session-reference context attached to a queued message is applied when the queued turn starts.

Double Escape opens checkpoints from the current conversation only while the agent is idle, the editor is empty, and completion is closed. Left or Escape selects an older checkpoint, Right selects a newer checkpoint, Enter creates and activates a branch before the selected turn, and Ctrl+C or q closes the navigator. The original session remains unchanged. `/sessions` remains the complete-history browser and workspace-membership editor.

Ctrl+PageUp and Ctrl+PageDown cycle the manually maintained active workspace sessions. A stopped session in the current workspace resumes in the existing TUI process. A session in another workspace uses the host handoff path. One open request per session may run at a time. Stopped active sessions load their persisted titles before activation.

Short selections use the fixed bottom interaction area. Complete history and built-in information commands use the chat main area. The outer frame, active-workspace sidebar, status display, and editor ownership remain fixed.

## Consequences

Input intent is determined by the key and current agent state. Checkpoint navigation cannot be confused with complete history. Session switching preserves the active-workspace model, and cross-workspace replacement remains owned by the host. Tests cover both terminal key encodings, queue ordering and replacement, delayed reference context, checkpoint branching, duplicate-open locking, persisted titles, and fixed-frame view placement.
