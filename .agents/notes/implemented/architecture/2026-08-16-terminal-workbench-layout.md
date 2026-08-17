# Agent Note: Terminal workbench layout

Status: implemented

## Problem

The released root layout treats workspace and session information as a pane beside the chat while operational values also appear below the editor. This reduces the transcript area, duplicates state, and lets the input drift upward when the transcript is short.

## Decision

One workbench component owns the terminal root. The transcript, tool output, inline dialogs, and editor render in the left main area. Workspace, Active sessions grouped by workspace, and Status render in a persistent right sidebar. Session switches replace only the transcript component.

The root renders exactly the terminal height. The editor stays at the bottom of short content, and long transcripts scroll inside the main area with Page Up and Page Down. Each transcript retains its own position when sessions switch. An active inline dialog replaces the editor area and restores the editor state when it closes. Session navigation uses guarded shortcuts, direct commands, or sidebar clicks; ordinary arrow keys remain editor input.

The sidebar renders when the terminal can preserve a 40-column main area and a 24-column sidebar. Narrower terminals hide the sidebar and give the full width to the editor and dialogs.

The bottom status line owns cwd, branch, model, and context. The sidebar Status section owns agent state, plan mode, token and cache totals, and permission. A new untitled conversation uses the large welcome view; conversations with content use the compact version-and-title header.

## Alternatives considered

Keeping the existing split component and reversing its panes preserved code that modeled the wrong ownership: session navigation and transcript switching remained coupled to the root layout. Letting the root exceed the terminal height moved the sidebar and editor into terminal scrollback. Keeping dialogs above a permanently visible editor made short terminals unusable.

## Consequences

The workbench preserves terminal dimensions, transcript scrolling, right-sidebar alignment, session switching, and dialog priority. Component tests cover these rules, headless-terminal tests cover assembled rendering and keyboard paging, and the PTY check verifies the compact title plus left-main and right-sidebar placement from the packed plugin.
