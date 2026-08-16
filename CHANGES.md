# Terminal Workbench

The TUI uses one full-screen workbench for every live session. The left main area owns the compact identity header, transcript, tool output, inline dialogs, and editor. The right sidebar stays mounted while the active transcript changes, so navigation and operational state remain visible without duplicating them below the editor.

The sidebar contains four sections:

- Workspace shows the active project, Git branch, and working directory.
- Sessions shows every in-process live session in one compact row with its active and running markers.
- Current shows the active session's live activity or Idle.
- Status shows model, context usage, input/output tokens, cache hit rate when known, queue depth, permission preset, and plan mode.

The default sidebar width is 32 columns and `sidebarWidth` accepts values from 24 columns upward. At 65 columns or more, the layout keeps both the 24-column sidebar minimum and a usable main area. Below 65 columns, the sidebar hides so the editor and dialogs keep the full terminal width.

The root component always renders exactly the terminal height. Short transcripts leave flexible space above the editor. Long transcripts scroll inside their own viewport with Page Up and Page Down, while the header, editor, dialogs, and sidebar remain fixed. Each session retains its own transcript position; new rows do not pull an intentionally scrolled viewport back to the live tail.

F6 moves focus from the editor into Sessions. Up and Down change the selected live session, Enter activates it, and Left Arrow, F6, or Escape returns focus to the editor. Background session title, activity, and running-state changes refresh the list without requiring a switch.

An active inline dialog replaces the editor area. This keeps the question and its controls usable in very short terminals and restores the existing editor draft when the dialog closes.

The bundled profile opens the fixed `assistant` session. `/new` creates a coding session in the active workspace; `/new <path>` validates the requested directory and creates the session there. Session rows include the workspace name, and workspace-scoped file completion and skill discovery follow the active session.

Required source, artifact, clean-profile, and PTY checks are listed in [TESTING.md](TESTING.md).
