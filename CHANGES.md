# Persistent Workspace Sidebar

The TUI uses one shared two-column layout for every live session. The left pane stays mounted while the right pane switches between session transcripts, so navigation and operational status remain in a stable location.

The sidebar contains three sections:

- Workspace shows the active project name, working directory, and Git branch.
- Sessions shows every in-process live session with its title, workspace, activity age, active marker, and running state.
- Status shows the active agent state, model, context usage, input/output tokens, cache hit rate, queue depth, permission preset, and plan mode.

The default sidebar width is 32 columns and `sidebarWidth` accepts values from 24 columns upward. At 65 columns or more, the layout can keep both the 24-column sidebar minimum and the 40-column chat minimum. Below that width, the sidebar remains present at 24 columns while the chat uses the remaining columns; below 26 columns both panes shrink to keep the separator and one chat column visible. A terminal height of at least 24 rows is recommended so Workspace, Sessions, Status, and the editor remain visible together.

Left Arrow moves focus from the editor into Sessions. Up and Down change the selected live session, Enter activates it, and Right Arrow or Escape returns focus to the editor. Background session title, activity, and running-state changes refresh the list without requiring a switch.

Required interactive checks are listed in [TESTING.md](TESTING.md).

The packed plugin is verified through a real 140x32 PTY. A terminal-response driver completes startup negotiation, exercises session creation and switching, and replays the captured ANSI output to confirm that every sidebar section is present on screen.
